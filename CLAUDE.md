# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Adapta Aí" — a multi-user tool that scrapes remote/Brazil tech job postings, ranks them per-user, adapts the user's résumé to each job via Claude (never inventing facts), generates a PDF, and hands off a one-click "apply" (downloads PDF + opens the job posting — it deliberately does **not** auto-submit forms; see Product decisions below).

## Commit messages

No tool-attribution trailers. Write commit messages the way the repo owner would: short title, plain first-person body only when it adds real context, no exhaustive "tested X/Y" or reasoning essays.

## Commands

```bash
# Database (Postgres in Docker)
docker-compose up -d
# Apply/reset schema (no migration runner — schema.sql is hand-maintained;
# changes to a live DB are applied as manual ALTER statements, not re-run automatically)
docker exec -i <postgres-container> psql -U postgres -d vagas_automaticas < backend/src/db/schema.sql

# Backend (Express, ESM, port 5000)
cd backend
npm install
cp .env.example .env   # fill in CLAUDE_API_KEY, JWT_SECRET, DATABASE_URL
npm run dev             # nodemon (see note below — do not switch back to `node --watch`)
npm start                # no watch, for prod-like runs

# Frontend (React + Vite + Tailwind, port 5173)
cd frontend
npm install
npm run dev
```

There is no test suite (`npm test` is a stub) and no lint config in either package.

**Dev server note:** `backend/package.json`'s `dev` script uses `nodemon`, not `node --watch`. `node --watch` has no debounce and would enter a restart loop when several files change in quick succession (e.g. a multi-file edit) — sometimes never completing boot. Keep `nodemonConfig` (1s delay, ignores `generated-cvs/`) if touching that script.

## Architecture

### Job pool is global; ranking is per-user, computed at read time

`jobs` is one shared table scraped once for everyone — it is **not** partitioned by user, and there is no `status` column on it. Per-user state (has this user adapted/approved this job? what's their relevance score?) is derived in `jobsController.listJobs` via correlated subqueries against `cv_adaptations`/`applications` filtered by `user_id`, plus `computeRelevanceScore(job, userKeywords)` from `jobCollector.js` run against that user's own `preferences.keywords`. **Do not add a `status` or `relevance_score`-as-source-of-truth column back onto `jobs`** — that would leak one user's approval/adaptation state to every other user viewing the same shared job.

### Job descriptions are never persisted — only AI-derived summaries

Raw scraped job text is held in memory only during collection. Before insert, `jobSummarizer.js` calls Claude to produce `summary` (2-3 sentences), `keywords[]`, `modality` (remoto/presencial/hibrido), and `state` (UF) — with a non-AI fallback (`title` + existing `tags`) if the call fails, never inventing data. `cvAdapter.js` and `computeRelevanceScore` consume `summary`/`keywords`, not raw text. This was a deliberate copyright-risk decision — don't reintroduce a `description` column without revisiting why it was removed.

### Job collection pipeline

`jobScheduler.js` (cron, default every 3h via `COLLECT_CRON` in `.env`, `'off'` disables) and the manual "Buscar vagas agora" button both call `runCollection()`, which holds an in-memory `isCollecting` lock shared between the two triggers — they can never run concurrently and double-spend AI calls on the same new postings. `runCollection` → `jobCollector.collectJobs()` iterates the 5 active sources in `backend/src/services/jobSources/` (`remotar.js`, `vagascombr.js`, `empregaju.js`, `solides.js`, `infojobs.js` — Brazil-only; international sources were deliberately removed), skips `external_id`s already in the DB *before* summarizing (so re-runs are cheap), then batches new postings through `jobSummarizer.js` with limited concurrency.

Each source paginates to its actual end rather than a single page (added 2026-07-15): `vagascombr.js` walks `?pagina=N` up to the site's own `data-total` (capped at `MAX_PAGES=30` as a safety net); `solides.js` walks `page=N` up to the API's `totalPages`; `remotar.js` scrolls its infinite-scroll listing until the card count stops growing.

### Demand-driven category activation (`active_job_areas`)

Job-source category filtering is not hardcoded to tech — it's driven by the `active_job_areas` table (seeded with a `tecnologia` row: `vagascombr_slug='tecnologia'`, `remotar_category_ids='{4,7,13,14,8,9}'`) and grown on demand as users upload résumés in other fields (e.g. a veterinary medicine student, per the original motivating case). Whenever a CV is extracted (`authController.register` or `cvController.addCv`, both via `cvExtractor.extractCv()`), `jobAreaResolver.ensureAreaForLabel(cv.label, userId)` fires **without being awaited** — either it matches the label to an already-active area (no-op), or it proposes new per-source params and inserts a row. This is deliberately off the signup/add-CV critical path: awaiting it would double signup latency (there's already one serial Haiku call for `extractCv` itself), and the accepted tradeoff is that a brand-new area only gets scraped starting the *next* `runCollection()` cycle (cron default ~3h), not immediately.

`jobCollector.collectJobs()` loads all `active=true` rows and passes them to every source's `fetchJobs(areas)`. The three filterable sources scale differently:
- `vagascombr.js` re-queries **per area** (`/vagas-de-{slug}`, one paginated crawl per slug) — cost scales linearly with the number of distinct areas. Confirmed by live testing that the site's "category" behaves like a keyword search rather than a curated taxonomy (`/vagas-de-veterinaria` returns real, if loosely-matched, results) — good enough since `jobSummarizer.js` + per-user `computeRelevanceScore` do the real precision filtering downstream.
- `remotar.js` **merges** every active area's `remotar_category_ids` into one combined `?c=` query — cost scales with the *size of the merged category set* (capped at Remotar's fixed taxonomy), not per area — and returns `[]` outright if the merged set is empty rather than falling back to an unfiltered listing (empty filter = all ~650 postings across every field on a 100%-remote board, exactly the blowup this design exists to avoid). Only 6 of Remotar's ~21 category IDs have been confirmed by live inspection (`jobAreaResolver.js` → `REMOTAR_CATEGORIES` — Data Science=4, DevOps=7, QA=8, SysAdmin=9, Programação=13, Programação Mobile=14); the resolver only ever proposes IDs from that confirmed list, never guesses an unverified one. Remotar is also a 100%-remote job board, so on-site-only professions (veterinary medicine, in-person healthcare, retail floor work) legitimately resolve to `remotar_category_ids: []` — that's correct, not a bug.
- `solides.js` loops per area's `solides_query` (a free-text title search) — currently low-impact since the portal returns 0 jobs for any query.
- `empregaju.js` is unaffected — it has no category concept and ignores the `areas` argument passed to it.

All three filterable sources dedup by `externalId` across areas before returning, since the same posting can plausibly surface under two slugs/queries.

### InfoJobs has a fixed geo rule instead of the dynamic area system

`infojobs.js` deliberately **ignores** the `areas` argument `jobCollector` passes to every source — it has its own hardcoded business rule instead: Aracaju gets *every* posting (presencial + remoto, since that's where the user is based), while everywhere else only remote (`home office`) postings are collected. This isn't a placeholder — it was explicitly requested this way.

The site has no single URL for "all remote jobs in Brazil" — the `home office` filter is always scoped to a search city, and confirmed by live inspection that a city's remote results only include postings from companies based in that city's state (searching "remoto" in São Paulo never surfaced a Rio-based remote posting). Full national remote coverage would mean crawling all 27 state capitals; instead `REMOTE_HUB_CITY_SLUGS` covers 10 (São Paulo, Rio, Belo Horizonte, Curitiba, Porto Alegre, Brasília, Salvador, Recife, Maceió, Fortaleza) as an explicit coverage/cost tradeoff — this is partial by design, not a bug, and the list can grow if a gap turns out to matter.

Aracaju itself uses Playwright with infinite-scroll (like `remotar.js`), not a single-page `axios` fetch like the hub cities — confirmed live that scrolling reaches the site's exact stated total with zero padding, whereas a single unscrolled page only captures the first ~40 of what can be 200+ real postings. Every card carries a `data-typesimilar` attribute; a non-empty value means the site injected a "similar posting" as filler once real results ran out, and those are filtered out everywhere (both the scroll and single-page paths) — without that filter, scrolling past the real result count silently pulls in off-topic postings from other cities/fields.
### Anti-hallucination is a running theme across every AI call

`cvAdapter.js` (adapt CV to a job), `cvExtractor.js` (extract structured CV from an uploaded PDF/DOCX), and `jobSummarizer.js` (summarize a scraped posting) all follow the same shape: strict system prompt forbidding invention, JSON-only output parsed via the shared `utils/jsonExtract.js` helper, and a validation/fallback step that never fabricates a field it can't ground in the source. `cvAdapter.js` additionally runs `validateNoHallucination()` — a structural diff confirming company/role/dates/education/contact are byte-identical to the original CV before accepting an "adaptation." Extend new AI-touching features in this same pattern rather than trusting raw model output.

### Multi-CV per user, AI-selected

`cv_base` has no unique-per-user constraint — a user can hold up to `FREE_TIER_MAX_CVS` (constant in `cvController.js`, currently 2 — the intended hook for a future paid tier) résumés, each with an AI-generated `label` (e.g. "Desenvolvimento Backend", "Atendimento ao Cliente"). When adapting to a job, `cvSelector.js` picks the most relevant `cv_base_id` automatically (skipped entirely if the user has only one CV); `cvAdapter.js` then adapts *that* CV. The choice is recorded on `cv_adaptations.cv_base_id` and surfaced to the user ("CV usado: ...") rather than hidden.

### Auth and multi-tenancy

JWT (`utils/jwt.js`, 7-day expiry) + bcrypt. `requireAuth` middleware guards everything under `/api/jobs`, `/api/cv`, `/api/applications`; only `/api/auth/*` and `/api/health` are public. Signup is one step: email + password + résumé upload — `cvExtractor.js` structures the résumé and creates `cv_base` + a `preferences` row (keywords auto-derived from extracted skills) inside a DB transaction, so there is no account without a usable CV.

### Frontend routing vs. in-page tabs — don't conflate the two

React Router only distinguishes `/login`, `/signup`, and the single protected `/` route (`ProtectedRoute.jsx` checks for a token in `localStorage`). Inside `/`, `AppShell` (in `App.jsx`) switches between Dashboard/History/Settings via local `activeTab` state, not sub-routes — there's no `/history` or `/settings` URL. `services/api.js` wraps axios with a request interceptor (attaches the stored JWT) and a response interceptor (401 → clear storage, redirect to `/login`).

### Design system is documented, not improvised

`DESIGN.md` and `PRODUCT.md` at the repo root define the palette ("dusty lavender", `#6B5F94` primary), typography (Sora + IBM Plex Mono for scores only), component rules (no "ghost card" shadow+border combos, no decorative eyebrows, functional-not-decorative badge coloring), and explicit anti-patterns to avoid ("generic AI dashboard" aesthetics). Read them before touching frontend styling — the existing components (`JobCard`, `Badge`, `Tag`, `AdaptModal`) already follow these rules; match them rather than introducing a new visual language.

## Product decisions (already made — don't relitigate without asking)

- **No auto-apply, ever.** Approving a job generates the PDF, downloads it, and opens the job's URL in a new tab — it never fills or submits a form on the job site. This was deliberate (competitor auto-apply tools have poor user trust/reviews); the "one click" in the README refers to *preparing* the application, not sending it.
- **No hidden/invisible text or keyword-stuffing in generated PDFs.**
- **Never inflate seniority.** Adapted CVs must present the candidate at their true level even when the target job asks for more.
- **PDF filenames are human-readable with no numeric IDs** (`slugify(title)-abbreviateCompany(company).pdf`, `cvPdfGenerator.js`) — a deliberate UX choice. Filenames can still collide when two users approve the *same* shared job (same title/company slug), so PDFs are written to a per-user subdirectory (`generated-cvs/{userId}/...`) rather than deduplicated in the name itself.
- Job source scrapers must respect each site's `robots.txt`.
