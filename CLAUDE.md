# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Vagas Automáticas" — a multi-user tool that scrapes remote/Brazil tech job postings, ranks them per-user, adapts the user's résumé to each job via Claude (never inventing facts), generates a PDF, and hands off a one-click "apply" (downloads PDF + opens the job posting — it deliberately does **not** auto-submit forms; see Product decisions below).

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

`jobScheduler.js` (cron, default every 3h via `COLLECT_CRON` in `.env`, `'off'` disables) and the manual "Buscar vagas agora" button both call `runCollection()`, which holds an in-memory `isCollecting` lock shared between the two triggers — they can never run concurrently and double-spend AI calls on the same new postings. `runCollection` → `jobCollector.collectJobs()` iterates the 4 active sources in `backend/src/services/jobSources/` (`remotar.js`, `vagascombr.js`, `empregaju.js`, `solides.js` — Brazil-only; international sources were deliberately removed), skips `external_id`s already in the DB *before* summarizing (so re-runs are cheap), then batches new postings through `jobSummarizer.js` with limited concurrency.

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
- **PDF filenames are human-readable with no numeric IDs** (`slugify(title)-abbreviateCompany(company).pdf`, `cvPdfGenerator.js`) — a deliberate UX choice. Known unresolved edge case: two different users approving the *same* shared job get colliding filenames and overwrite each other's file on disk; not yet fixed (would need a per-user output path).
- Job source scrapers must respect each site's `robots.txt`.
