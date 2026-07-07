# Plano — Fase 1 (MVP): Vagas Automáticas

## Fase 0 — Descoberta (concluída)

Pesquisa feita via subagentes, com fontes reais verificadas (não presumidas):

| Fonte | Status | Motivo |
|---|---|---|
| **Indeed** | ❌ Removido do escopo | `robots.txt` bloqueia `/jobs/` e `/job/` para bots genéricos; alto risco de CAPTCHA/bloqueio em uso repetido |
| **Remotar.com.br** | ✅ Incluído via Playwright | SPA Next.js renderizada no client (`__NEXT_DATA__` vazio) — `axios+cheerio` não funciona, precisa de headless browser |
| **Arbeitnow API** | ✅ Confirmado funcionando | `GET https://www.arbeitnow.com/api/job-board-api` → JSON `{ data: [...] }`, sem paginação nesta resposta. Campos: `slug, company_name, title, description, remote, url, tags, job_types, location, created_at` |
| **We Work Remotely RSS** | ✅ Confirmado funcionando | `GET https://weworkremotely.com/categories/remote-programming-jobs.rss` → XML válido. Campos por `<item>`: `title, region, category, description (HTML), pubDate, guid, link` |
| **RemoteOK API** | ⚠️ Best-effort | `GET https://remoteok.com/api` retornou 403 no teste (sem header de navegador). Implementar com `User-Agent` realista + try/catch isolado; se falhar em produção, não deve quebrar a coleta das outras fontes |

**Decisões travadas com o usuário:**
1. Indeed substituído por fontes abertas (Arbeitnow, WWR, RemoteOK best-effort) — sem risco de ToS
2. Remotar coletado via Playwright (headless Chromium)
3. "Envio" = semi-automático: gera PDF do CV adaptado + abre a URL de candidatura da vaga. Usuário faz o clique/upload final no site. Nenhuma automação de login/formulário nos job boards (evita fragilidade e risco de ToS).

---

## Fase 1 — Banco de dados (PostgreSQL)

**Arquivo:** `backend/src/db/schema.sql` + `backend/src/utils/db.js` (pool de conexão com `pg`)

```sql
CREATE TABLE cv_base (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  contact JSONB NOT NULL,        -- {phone, email, location, linkedin, github}
  summary TEXT NOT NULL,
  experience JSONB NOT NULL,     -- [{company, role, location, start_date, end_date, bullets: []}]
  education JSONB NOT NULL,
  skills JSONB NOT NULL,         -- {languages: [], ai: [], cloud: [], tools: []}
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE preferences (
  id SERIAL PRIMARY KEY,
  keywords TEXT[] DEFAULT '{}',          -- ex: ['python','node','aws','llm','backend','fastapi']
  excluded_companies TEXT[] DEFAULT '{}',
  min_relevance_score INT DEFAULT 40,    -- 0-100, usado para filtrar vagas irrelevantes
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE job_source AS ENUM ('arbeitnow','weworkremotely','remoteok','remotar');
CREATE TYPE job_status AS ENUM ('new','adapted','approved','discarded');

CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  source job_source NOT NULL,
  external_id TEXT NOT NULL,      -- slug/guid da fonte, usado pra dedupe
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  description TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  url TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT now(),
  status job_status DEFAULT 'new',
  relevance_score INT,
  UNIQUE(source, external_id)
);

CREATE TABLE cv_adaptations (
  id SERIAL PRIMARY KEY,
  job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
  adapted_content JSONB NOT NULL,  -- mesma forma do cv_base, reordenado/reescrito
  match_score INT,
  match_notes TEXT,                -- nota interna "por que combina", não vai pro PDF
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
  cv_adaptation_id INT REFERENCES cv_adaptations(id),
  pdf_path TEXT,
  approved_at TIMESTAMPTZ DEFAULT now(),
  opened_url TEXT
);
```

**Nota de design:** sem `user_id` de propósito — Fase 1 é uso único. Na Fase 2 (multi-usuário), adiciona-se `user_id` em `cv_base`, `preferences` e `applications`; `jobs` continua compartilhado entre usuários (a vaga em si não é específica de ninguém).

**Seed:** popular `cv_base` uma vez com os dados reais do currículo já extraído (João Vitor — resumo, experiência Disc.AI/Compass UOL/Gesso Decor, skills). Isso vira o dado de entrada para toda adaptação.

**Verificação:** `psql` rodando as queries `SELECT * FROM cv_base;` e `\d jobs` confirmando tipos/constraints.

---

## Fase 2 — Coleta de vagas (job sources)

**Arquivos:**
- `backend/src/services/jobSources/arbeitnow.js`
- `backend/src/services/jobSources/weworkremotely.js` (usar `rss-parser` — adicionar ao package.json)
- `backend/src/services/jobSources/remoteok.js` (best-effort, headers de navegador)
- `backend/src/services/jobSources/remotar.js` (Playwright — adicionar `playwright` ao package.json)
- `backend/src/services/jobCollector.js` (orquestrador)

**Interface comum** — cada módulo exporta:
```js
async function fetchJobs() {
  // retorna array de NormalizedJob:
  // { source, externalId, title, company, location, description, tags, url, postedAt }
}
```

**remoteok.js** — usar header realista pra evitar o 403 observado:
```js
axios.get('https://remoteok.com/api', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
})
```
Envolver em `try/catch` que loga o erro e retorna `[]` — nunca deixar essa fonte derrubar a coleta inteira.

**remotar.js** — Playwright:
```js
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://remotar.com.br', { waitUntil: 'networkidle' });
// esperar seletor dos cards de vaga renderizarem, então extrair via page.evaluate()
await browser.close();
```
Reutilizar a mesma instância de browser entre chamadas (não abrir um browser novo por vaga). Adicionar timeout de 15s e um retry único.

**jobCollector.js** — orquestrador:
1. Chama as 4 fontes em paralelo (`Promise.allSettled`, não `Promise.all` — uma fonte falhando não derruba as outras)
2. Normaliza todas pro formato comum
3. Calcula `relevance_score` (0-100): % de matches entre `tags`/`title`/`description` da vaga e `preferences.keywords` do usuário (não filtro rígido — alinhado com "não quero ficar preso a uma stack só"). **Ajuste de senioridade** (`seniorityAdjustment()`): -30 pra títulos sênior/lead/principal, +15 pra júnior/estágio/entry — o candidato é júnior, então vagas do nível dele sobem e sênior afunda (mas sem sumir). Keywords cobrem backend/IA **e** frontend/fullstack. Repontuar vagas antigas com `node src/db/rescore.js` sempre que keywords ou lógica mudarem.
4. Insere no banco com `INSERT ... ON CONFLICT (source, external_id) DO NOTHING` (dedupe automático)
5. Retorna `{ found: N, new: M }` pro endpoint que chamou

**Anti-padrões a evitar:**
- Não fazer scraping do Indeed sob nenhuma forma
- Não abrir uma instância de browser Playwright por vaga (custo alto) — uma instância por *execução* de coleta
- Não deixar uma fonte falhando quebrar a resposta inteira do endpoint

**Verificação:** rodar `POST /api/jobs/collect` manualmente e conferir no banco que vagas de pelo menos Arbeitnow + WWR foram inseridas (RemoteOK e Remotar são melhor-esforço).

---

## Fase 3 — Adaptação de CV via Claude API

**Arquivo:** `backend/src/services/cvAdapter.js`

**Modelo:** `claude-haiku-4-5` (custo baixo, adequado pra reescrita estruturada — não precisa de raciocínio profundo)

**System prompt (regras invioláveis):**
```
Você adapta currículos para vagas específicas. O candidato é um desenvolvedor JÚNIOR.
Regras:
1. NUNCA invente experiência, empresa, cargo, tecnologia ou data que não exista no currículo original.
2. Você PODE: reordenar itens, reescrever o resumo profissional pra destacar o que é relevante,
   reordenar/destacar habilidades já existentes, ajustar o tom (mais backend/mais IA/mais frontend)
   conforme a vaga pedir.
3. Toda informação factual (empresas, cargos, datas, formação) deve ficar IDÊNTICA ao original.
4. NÍVEL DE SENIORIDADE: o candidato é JÚNIOR e o CV deve sempre se apresentar como tal —
   nunca alegue ser pleno, sênior, lead ou especialista. Você DEVE, porém, espelhar o TOM e o
   vocabulário da vaga (ex: se a vaga valoriza "autonomia", "colaboração" ou uma stack específica,
   destaque essas qualidades reais do candidato) — sem jamais mentir sobre o nível.
5. Responda APENAS com JSON válido no schema fornecido, sem texto fora do JSON.
```

> **Decisão do usuário (2026-07-06):** candidato é júnior. Na coleta (Fase 2, já implementada),
> vagas sênior/lead/principal são rebaixadas no `relevance_score` (mas continuam visíveis) e
> vagas júnior recebem boost — ver `seniorityAdjustment()` em `jobCollector.js`. Na adaptação,
> o CV sempre se enquadra como júnior espelhando o tom da vaga (regra 4 acima).

**User message:** título da vaga + descrição completa + tags + o JSON completo de `cv_base`.

**Schema de saída esperado:** mesma forma do `cv_base` (summary reescrito, experience com bullets reordenados/reescritos dentro dos limites factuais, skills reordenados) + `match_score` (0-100) + `match_notes` (1-2 frases, uso interno).

**Validação pós-resposta (crítico — evita alucinação):**
- Parsear JSON; se falhar, retry único com lembrete mais forte da regra 3
- Comparar `company`, `role`, `start_date`, `end_date` de cada item de `experience` no JSON retornado contra o `cv_base` original — devem ser string-idênticos. Se algum campo factual mudou, rejeitar a resposta e usar o CV original sem adaptação (com aviso na UI: "não foi possível adaptar com segurança, mostrando CV original")

**Verificação:** chamar `adapt()` com uma vaga real (ex: uma vaga backend Python coletada da Arbeitnow) e conferir manualmente que os dados factuais batem com o currículo original.

---

## Fase 4 — Geração de PDF (reaproveitando Playwright)

**Arquivo:** `backend/src/services/cvPdfGenerator.js`

Já temos Playwright como dependência (Fase 2, para Remotar) — reaproveitar em vez de adicionar `pdfkit`/`puppeteer` como dependência extra:
```js
const page = await browser.newPage();
await page.setContent(renderCvHtml(adaptedContent)); // template HTML fiel ao layout de referência
const pdfBuffer = await page.pdf({ format: 'A4' });
```
Salvar em `backend/generated-cvs/{jobId}-{timestamp}.pdf` (pasta gitignored).

**Layout de referência (fixo, independe de pessoa/vaga — decisão do usuário em 2026-07-07):**
o template reproduz a estrutura visual do currículo original do usuário (`Curriculo Ia J.Vitor.pdf`):
1. Nome completo — centralizado, grande, negrito
2. Linha de contato centralizada: telefone | email | localização
3. Linha de links centralizada: LinkedIn | GitHub
4. Seção **RESUMO PROFISSIONAL** (título em maiúsculas com regra horizontal abaixo) — parágrafo do `summary`
5. Seção **EXPERIÊNCIA PROFISSIONAL** — para cada item de `experience`: linha com empresa (negrito, esquerda) e location (direita); linha seguinte com role (itálico, esquerda) e `start_date`–`end_date` (direita, "Presente" se `end_date` for null); lista de `bullets`
6. Seção **FORMAÇÃO ACADÊMICA** — mesmo padrão (institution/location, degree/expected_completion)
7. Seção **COMPETÊNCIAS E TECNOLOGIAS** — uma linha por categoria de `skills` (label em negrito + lista separada por vírgula): Linguagens e Frameworks (`languages`), Inteligência Artificial (`ai`), Cloud e Infraestrutura (`cloud`), Ferramentas e Práticas (`tools`)

**Decisão explícita do usuário (2026-07-07): SEM texto invisível/oculto.** O currículo de referência tinha um bloco de palavras-chave em texto branco/invisível no final (técnica de "keyword stuffing" pra ATS). Isso foi identificado e **rejeitado deliberadamente** — não implementar texto oculto de nenhuma forma; a otimização pra ATS acontece de forma honesta, através da própria seção de Competências já vindo reordenada/priorizada pela Fase 3 (`cvAdapter.js`), que é visível.

**Verificação:** gerar um PDF de teste (com um CV adaptado real da Fase 3) e abrir manualmente pra conferir formatação — abrir o PDF e também extrair o texto dele (ex: copiar o texto renderizado) pra confirmar que NENHUM conteúdo extra além do visível existe no arquivo.

---

## Fase 5 — Endpoints Express

**Arquivos:** `backend/src/routes/jobs.js`, `backend/src/routes/applications.js`, `backend/src/routes/cv.js`, `backend/src/controllers/*`

| Método | Rota | Ação |
|---|---|---|
| GET | `/api/jobs?status=new` | Lista vagas coletadas |
| POST | `/api/jobs/collect` | Dispara coleta manual (chama `jobCollector`) |
| GET | `/api/jobs/:id` | Detalhe da vaga |
| POST | `/api/jobs/:id/adapt` | Gera adaptação via Claude, salva em `cv_adaptations`, status → `adapted` |
| POST | `/api/jobs/:id/approve` | Gera PDF, cria registro em `applications`, retorna `{ pdfPath, openUrl }` |
| POST | `/api/jobs/:id/discard` | Status → `discarded` |
| GET | `/api/applications` | Histórico (join `jobs` + `applications`) |
| GET/PUT | `/api/cv` | Ver/editar CV base |
| GET/PUT | `/api/preferences` | Ver/editar keywords e exclusões |

**Verificação:** testar cada rota via `curl`/Postman com uma vaga real ponta a ponta (collect → adapt → approve → applications mostra o registro).

---

## Fase 6 — Frontend (React)

**Arquivos:** `frontend/src/pages/{Dashboard,History,Settings}.jsx`, `frontend/src/components/{JobCard,AdaptationModal}.jsx`

1. **Dashboard**: lista vagas (`GET /jobs`), botão "Buscar vagas agora" (`POST /collect`), cada card com botão "Adaptar CV"
2. **AdaptationModal**: mostra preview do CV adaptado + `match_notes`, botões "Aprovar e Preparar Envio" / "Descartar"
3. Ao aprovar: front dispara download do PDF retornado + `window.open(openUrl, '_blank')` automaticamente
4. **History**: tabela com `GET /applications`
5. **Settings**: form simples pra editar `cv_base` e `preferences`

**Verificação:** rodar o fluxo completo no navegador (Fase de Verificação final abaixo).

---

## Fase Final — Verificação end-to-end

1. `POST /api/jobs/collect` → confirmar vagas novas no dashboard
2. Escolher 1 vaga real → "Adaptar CV" → conferir que dados factuais não mudaram
3. "Aprovar e Preparar Envio" → confirmar que PDF baixa e a aba da vaga abre
4. Conferir registro em `/api/applications`
5. Rodar coleta uma segunda vez → confirmar que vagas já vistas NÃO duplicam (dedupe funcionando)

---

## Dependências novas a instalar

```bash
cd backend
npm install rss-parser playwright
npx playwright install chromium
```
