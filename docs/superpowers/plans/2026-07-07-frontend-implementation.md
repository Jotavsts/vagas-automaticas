# Frontend (Dashboard, Modal, Histórico, Configurações) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o frontend React funcional do "Vagas Automáticas" (dashboard único com lista de vagas, modal de adaptação de CV, histórico e configurações), aplicando o sistema visual definido em `DESIGN.md`, e fechar as duas lacunas de backend (aprovação + histórico) identificadas no spec de design.

**Architecture:** SPA React (Vite) sem router — uma única página com troca de aba via state local (`activeTab`). Backend Express já existente ganha 3 endpoints novos (approve, get-adaptation, list-applications). Tailwind CSS configurado via `tailwind.config.js` com os tokens do DESIGN.md como cores nomeadas, substituindo o CDN script solto que está no `index.html` hoje.

**Tech Stack:** React 18 + Vite + Tailwind CSS (build real via PostCSS, não CDN) + axios. Backend: Express + `pg` (já existentes).

## Global Constraints

- Projeto **não tem test runner configurado** (`"test": "echo ... && exit 1"` no package.json do backend, nada no frontend). Verificação em cada tarefa é feita com execução real: `curl`/PowerShell contra o backend rodando, `docker exec ... psql` pra conferir o banco, e os preview tools (screenshot, inspect, snapshot) pro frontend. Isso segue o padrão já usado nas Fases 1-4 deste projeto — não inventar um framework de teste novo.
- Paleta de cores (de `DESIGN.md`, usar exatamente estes hex): `bg #FAF9FC`, `surface #FFFFFF`, `border #E3E0EC`, `border-hover #C9BAF0`, `primary #6B5F94`, `primary-hover #5A4F80`, `ink #2E2A3D`, `ink-secondary #615A78`, `tag #EAE7F2`/`tag-ink #544A73`, `muted #F0F0F3`/`muted-ink #5C5C68`, `success #E3F3E6`/`success-ink #227A3B`, `warning #FBF8EF`/`warning-ink #6B5A26`, `danger #FBEAEA`/`danger-ink #A23838`.
- Tipografia: **Sora** (única família, pesos 400/500/600/700) em tudo; **IBM Plex Mono** (peso 500) **só** nos números de score/match. Nunca Inter/Roboto/Arial/system-ui como fonte principal (decisão explícita registrada em DESIGN.md).
- Card de vaga: borda simples em repouso, sombra só aparece no `:hover` (nunca as duas juntas em repouso — é o padrão "ghost card" que foi explicitamente rejeitado).
- Badge de score é funcional: sólido (`primary`) para match ≥50%, claro (`tag`/`tag-ink`) para 25-49%, neutro (`muted`/`muted-ink`) para <25%.
- Backend roda em `http://localhost:5000`, frontend em `http://localhost:5173` (configurado em `vite.config.js`). CORS já habilitado no backend (`app.use(cors())`).
- Banco Postgres via docker-compose, container `vagas-automaticas-postgres-1`, já tem vagas reais coletadas (incluindo job id 134 com adaptação salva de sessões anteriores — útil pra testar sem gastar chamada de API nova).

---

## Task 1: Configurar Tailwind de verdade (tirar o CDN)

Hoje o Tailwind funciona só via `<script src="https://cdn.tailwindcss.com">` no `index.html` — os pacotes `tailwindcss`/`postcss`/`autoprefixer` já estão instalados no `package.json` mas não têm arquivo de config, então não fazem nada. Isso impede usar cores customizadas (`bg-primary`, etc.) de forma confiável.

**Files:**
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Modify: `frontend/index.html` (remover CDN, adicionar Google Fonts)
- Modify: `frontend/src/index.css` (remover tema escuro hardcoded)

**Interfaces:**
- Produces: classes Tailwind customizadas (`bg-primary`, `text-ink`, `border-border`, `font-mono` = IBM Plex Mono, `font-sans` = Sora) disponíveis pra todos os componentes das tarefas seguintes.

- [ ] **Step 1: Criar `frontend/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#FAF9FC',
        surface: '#FFFFFF',
        border: '#E3E0EC',
        'border-hover': '#C9BAF0',
        primary: '#6B5F94',
        'primary-hover': '#5A4F80',
        ink: '#2E2A3D',
        'ink-secondary': '#615A78',
        tag: '#EAE7F2',
        'tag-ink': '#544A73',
        muted: '#F0F0F3',
        'muted-ink': '#5C5C68',
        success: '#E3F3E6',
        'success-ink': '#227A3B',
        warning: '#FBF8EF',
        'warning-ink': '#6B5A26',
        danger: '#FBEAEA',
        'danger-ink': '#A23838',
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Criar `frontend/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 3: Reescrever `frontend/index.html`** (remove o `<script src="https://cdn.tailwindcss.com">`, adiciona as fontes)

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vagas Automáticas</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Reescrever `frontend/src/index.css`** (remove o fundo escuro fixo, deixa o Tailwind cuidar do resto)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}
```

- [ ] **Step 5: Verificar que o Tailwind customizado está funcionando**

Rode o dev server via preview tool (`preview_start`), depois:

```
preview_eval: document.body.style.fontFamily || getComputedStyle(document.body).fontFamily
```

Espere ver `"Sora"` na lista de fontes computadas assim que os componentes das próximas tarefas usarem `font-sans`/classes Tailwind. Por enquanto, como o `App.jsx` ainda não foi tocado, uma verificação suficiente aqui é: `preview_logs` não mostra erro de "tailwindcss module not found" nem de PostCSS, e o servidor sobe normalmente.

- [ ] **Step 6: Commit**

```bash
git add frontend/tailwind.config.js frontend/postcss.config.js frontend/index.html frontend/src/index.css
git commit -m "Configurar Tailwind via PostCSS com tokens do DESIGN.md (remove CDN)"
```

---

## Task 2: Backend — endpoint de aprovação (`POST /api/jobs/:id/approve`)

Fecha a lacuna 1 do spec: gerar o PDF, gravar em `applications`, marcar a vaga como `approved`. Reaproveita `generatePdf` (já existe, `backend/src/services/cvPdfGenerator.js`).

**Files:**
- Modify: `backend/src/controllers/cvController.js` (adicionar `approveJob`)
- Modify: `backend/src/routes/jobs.js` (adicionar rota)

**Interfaces:**
- Consumes: `pool` de `../utils/db.js`, `generatePdf(adaptedContent, jobId)` de `../services/cvPdfGenerator.js` (retorna `{ filePath, fileName }`)
- Produces: `POST /api/jobs/:id/approve` retorna `{ application, downloadUrl, jobUrl }` em sucesso (200), `{ error }` em 404 se não houver adaptação ou vaga.

- [ ] **Step 1: Adicionar `approveJob` em `backend/src/controllers/cvController.js`**

Adicionar ao final do arquivo (mantendo os imports e funções existentes intactos):

```js
/**
 * POST /api/jobs/:id/approve - gera o PDF, grava em applications e marca a vaga como aprovada.
 */
export async function approveJob(req, res) {
  const { id } = req.params;
  try {
    const adaptationResult = await pool.query(
      'SELECT * FROM cv_adaptations WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );
    if (adaptationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Nenhuma adaptação encontrada para esta vaga. Chame /adapt primeiro.',
      });
    }
    const adaptation = adaptationResult.rows[0];

    const jobResult = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }
    const job = jobResult.rows[0];

    const { fileName } = await generatePdf(adaptation.adapted_content, id);
    const downloadUrl = `/generated-cvs/${fileName}`;

    const insert = await pool.query(
      `INSERT INTO applications (job_id, cv_adaptation_id, pdf_path, opened_url)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, adaptation.id, downloadUrl, job.url]
    );

    await pool.query("UPDATE jobs SET status = 'approved' WHERE id = $1", [id]);

    return res.json({ application: insert.rows[0], downloadUrl, jobUrl: job.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao aprovar candidatura', details: err.message });
  }
}
```

- [ ] **Step 2: Registrar a rota em `backend/src/routes/jobs.js`**

```js
import { Router } from 'express';
import { collect, listJobs } from '../controllers/jobsController.js';
import { adaptForJob, generatePdfForJob, approveJob } from '../controllers/cvController.js';

const router = Router();
router.post('/collect', collect);
router.get('/', listJobs);
router.post('/:id/adapt', adaptForJob);
router.post('/:id/generate-pdf', generatePdfForJob);
router.post('/:id/approve', approveJob);

export default router;
```

- [ ] **Step 3: Sintaxe**

```bash
cd backend && node -c src/controllers/cvController.js && node -c src/routes/jobs.js
```

Esperado: nenhum erro (sem output = OK).

- [ ] **Step 4: Verificação real — aprovar o job 134 (já tem adaptação salva de sessão anterior)**

Subir o servidor:

```bash
cd backend && node src/index.js &
```

Confirmar que o job 134 tem adaptação:

```bash
docker exec vagas-automaticas-postgres-1 psql -U postgres -d vagas_automaticas -c "SELECT id FROM cv_adaptations WHERE job_id = 134 ORDER BY created_at DESC LIMIT 1;"
```

Se não retornar linha, chamar `POST http://localhost:5000/api/jobs/134/adapt` primeiro (só nesse caso — não repetir se já existir, pra não gastar chamada de API à toa).

Chamar o endpoint novo:

```bash
curl -s -X POST http://localhost:5000/api/jobs/134/approve
```

Esperado: JSON com `application.id`, `downloadUrl` tipo `/generated-cvs/134-....pdf`, `jobUrl` igual à URL real da vaga.

Confirmar no banco:

```bash
docker exec vagas-automaticas-postgres-1 psql -U postgres -d vagas_automaticas -c "SELECT job_id, pdf_path, opened_url FROM applications WHERE job_id = 134;"
docker exec vagas-automaticas-postgres-1 psql -U postgres -d vagas_automaticas -c "SELECT status FROM jobs WHERE id = 134;"
```

Esperado: uma linha em `applications`, e `status = 'approved'` em `jobs`.

Encerrar o servidor:

```bash
netstat -ano | grep ":5000" | grep LISTENING
taskkill //F //PID <pid-encontrado>
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/cvController.js backend/src/routes/jobs.js
git commit -m "Adicionar endpoint POST /api/jobs/:id/approve (fecha lacuna do fluxo de aprovacao)"
```

---

## Task 3: Backend — endpoints de leitura (`GET /:id/adaptation` e `GET /api/applications`)

Fecha a lacuna 2 do spec (histórico) e evita que o frontend precise chamar `/adapt` de novo (gastando API à toa) só pra **ver** uma adaptação que já existe.

**Files:**
- Modify: `backend/src/controllers/cvController.js` (adicionar `getAdaptationForJob`)
- Modify: `backend/src/routes/jobs.js` (adicionar rota)
- Create: `backend/src/controllers/applicationsController.js`
- Create: `backend/src/routes/applications.js`
- Modify: `backend/src/index.js` (registrar o router novo)

**Interfaces:**
- Produces: `GET /api/jobs/:id/adaptation` → `{ adaptation }` (200) ou `{ error }` (404). `GET /api/applications` → array de `{ id, approved_at, pdf_path, opened_url, title, company, job_url, source }`.

- [ ] **Step 1: Adicionar `getAdaptationForJob` em `backend/src/controllers/cvController.js`**

```js
/**
 * GET /api/jobs/:id/adaptation - retorna a adaptação já salva (sem reprocessar via IA).
 */
export async function getAdaptationForJob(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM cv_adaptations WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhuma adaptação encontrada para esta vaga.' });
    }
    res.json({ adaptation: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao buscar adaptação', details: err.message });
  }
}
```

- [ ] **Step 2: Criar `backend/src/controllers/applicationsController.js`**

```js
import { pool } from '../utils/db.js';

/**
 * GET /api/applications - histórico de candidaturas aprovadas (join applications + jobs).
 */
export async function listApplications(req, res) {
  try {
    const result = await pool.query(`
      SELECT a.id, a.approved_at, a.pdf_path, a.opened_url,
             j.title, j.company, j.url AS job_url, j.source
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      ORDER BY a.approved_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao listar histórico', details: err.message });
  }
}
```

- [ ] **Step 3: Criar `backend/src/routes/applications.js`**

```js
import { Router } from 'express';
import { listApplications } from '../controllers/applicationsController.js';

const router = Router();
router.get('/', listApplications);

export default router;
```

- [ ] **Step 4: Atualizar `backend/src/routes/jobs.js`** (adicionar a rota de adaptation)

```js
import { Router } from 'express';
import { collect, listJobs } from '../controllers/jobsController.js';
import {
  adaptForJob,
  generatePdfForJob,
  approveJob,
  getAdaptationForJob,
} from '../controllers/cvController.js';

const router = Router();
router.post('/collect', collect);
router.get('/', listJobs);
router.post('/:id/adapt', adaptForJob);
router.get('/:id/adaptation', getAdaptationForJob);
router.post('/:id/generate-pdf', generatePdfForJob);
router.post('/:id/approve', approveJob);

export default router;
```

- [ ] **Step 5: Atualizar `backend/src/index.js`** (registrar `/api/applications`)

```js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jobsRouter from './routes/jobs.js';
import cvRouter from './routes/cv.js';
import applicationsRouter from './routes/applications.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend rodando ✅' });
});

app.use('/api/jobs', jobsRouter);
app.use('/api/cv', cvRouter);
app.use('/api/applications', applicationsRouter);
app.use('/generated-cvs', express.static(path.join(__dirname, '..', 'generated-cvs')));

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
```

- [ ] **Step 6: Sintaxe**

```bash
cd backend && node -c src/controllers/cvController.js && node -c src/controllers/applicationsController.js && node -c src/routes/jobs.js && node -c src/routes/applications.js && node -c src/index.js
```

- [ ] **Step 7: Verificação real**

```bash
cd backend && node src/index.js &
curl -s http://localhost:5000/api/jobs/134/adaptation
curl -s http://localhost:5000/api/applications
```

Esperado: primeiro comando retorna `{ adaptation: {...} }` com os dados salvos (mesmo `id` da Task 2); segundo retorna um array com pelo menos 1 item (o job 134 aprovado na Task 2), com campos `title`, `company`, `job_url`, `pdf_path`, `approved_at`.

Encerrar o servidor (mesmo processo de `taskkill` da Task 2).

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/cvController.js backend/src/controllers/applicationsController.js backend/src/routes/jobs.js backend/src/routes/applications.js backend/src/index.js
git commit -m "Adicionar GET /api/jobs/:id/adaptation e GET /api/applications"
```

---

## Task 4: Frontend — cliente de API

**Files:**
- Create: `frontend/src/services/api.js`

**Interfaces:**
- Produces: `getJobs()`, `collectJobs()`, `adaptJob(jobId)`, `getAdaptation(jobId)`, `approveJob(jobId)`, `getApplications()`, `getCv()` — todas `async`, todas retornam o `data` já desembrulhado do axios. Consumido pelas Tasks 6-9.

- [ ] **Step 1: Criar `frontend/src/services/api.js`**

```js
import axios from 'axios'

const API_BASE = 'http://localhost:5000/api'

export async function getJobs() {
  const { data } = await axios.get(`${API_BASE}/jobs`)
  return data
}

export async function collectJobs() {
  const { data } = await axios.post(`${API_BASE}/jobs/collect`)
  return data
}

export async function adaptJob(jobId) {
  const { data } = await axios.post(`${API_BASE}/jobs/${jobId}/adapt`)
  return data
}

export async function getAdaptation(jobId) {
  const { data } = await axios.get(`${API_BASE}/jobs/${jobId}/adaptation`)
  return data
}

export async function approveJob(jobId) {
  const { data } = await axios.post(`${API_BASE}/jobs/${jobId}/approve`)
  return data
}

export async function getApplications() {
  const { data } = await axios.get(`${API_BASE}/applications`)
  return data
}

export async function getCv() {
  const { data } = await axios.get(`${API_BASE}/cv`)
  return data
}
```

- [ ] **Step 2: Verificação de sintaxe**

```bash
cd frontend && node -c src/services/api.js
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.js
git commit -m "Adicionar cliente de API do frontend"
```

---

## Task 5: Frontend — primitivas visuais e JobCard

**Files:**
- Create: `frontend/src/components/Button.jsx`
- Create: `frontend/src/components/Badge.jsx`
- Create: `frontend/src/components/Tag.jsx`
- Create: `frontend/src/components/JobCard.jsx`
- Modify: `frontend/src/App.jsx` (renderizar 1 JobCard fixo temporariamente, só pra verificar visual — será substituído na Task 6)

**Interfaces:**
- Consumes: nada (componentes puros de apresentação)
- Produces: `<Button variant="primary"|"secondary">`, `<Badge score={number}>`, `<Tag variant="relevant"|"neutral"|"success"|"danger">`, `<JobCard job={...} onAdapt={fn} onViewAdaptation={fn}>` — usados pela Task 6 (Dashboard) e Task 7 (Modal).

- [ ] **Step 1: Criar `frontend/src/components/Button.jsx`**

```jsx
function Button({ variant = 'primary', className = '', children, ...props }) {
  const base = 'px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover',
    secondary: 'bg-transparent text-ink-secondary border border-border hover:border-primary hover:text-primary font-medium',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export default Button
```

- [ ] **Step 2: Criar `frontend/src/components/Badge.jsx`**

```jsx
function Badge({ score }) {
  const value = score ?? 0
  let classes
  if (value >= 50) {
    classes = 'bg-primary text-white'
  } else if (value >= 25) {
    classes = 'bg-tag text-tag-ink'
  } else {
    classes = 'bg-muted text-muted-ink'
  }
  return (
    <span className={`font-mono text-xs font-medium px-2.5 py-1 rounded-md whitespace-nowrap ${classes}`}>
      {value}%
    </span>
  )
}

export default Badge
```

- [ ] **Step 3: Criar `frontend/src/components/Tag.jsx`**

```jsx
function Tag({ variant = 'neutral', children }) {
  const variants = {
    relevant: 'bg-tag text-tag-ink font-semibold',
    neutral: 'bg-muted text-muted-ink',
    success: 'bg-success text-success-ink font-semibold',
    danger: 'bg-danger text-danger-ink font-semibold',
  }
  return (
    <span className={`text-[11px] px-2 py-1 rounded-md ${variants[variant]}`}>
      {children}
    </span>
  )
}

export default Tag
```

- [ ] **Step 4: Criar `frontend/src/components/JobCard.jsx`**

```jsx
import Badge from './Badge'
import Tag from './Tag'
import Button from './Button'

const SENIOR_REGEX = /senior|s[êe]nior|lead|principal|staff/i

function JobCard({ job, onAdapt, onViewAdaptation }) {
  const isSenior = SENIOR_REGEX.test(job.title)
  const isAdapted = job.status === 'adapted' || job.status === 'approved'

  return (
    <div className="bg-surface rounded-xl p-4 border border-border transition-all duration-150 hover:border-border-hover hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5">
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="font-semibold text-ink text-[15px]">{job.title}</div>
          <div className="text-ink-secondary text-[13px] mt-0.5">
            {job.company || 'Empresa não informada'}
            {job.location ? ` · ${job.location}` : ''}
          </div>
        </div>
        <Badge score={job.relevance_score} />
      </div>

      <div className="mt-2.5 flex gap-1.5 flex-wrap">
        {(job.tags || []).slice(0, 3).map((tag) => (
          <Tag key={tag} variant="relevant">{tag}</Tag>
        ))}
        <Tag variant="neutral">{job.source}</Tag>
        {isSenior && <Tag variant="danger">Sênior</Tag>}
        {isAdapted && <Tag variant="success">✓ Adaptado</Tag>}
      </div>

      <div className="mt-3 flex gap-2">
        {isAdapted ? (
          <Button variant="secondary" className="flex-1" onClick={() => onViewAdaptation(job)}>
            Ver CV adaptado
          </Button>
        ) : (
          <Button variant="primary" className="flex-1" onClick={() => onAdapt(job)}>
            Adaptar CV
          </Button>
        )}
        <Button variant="secondary" onClick={() => window.open(job.url, '_blank')}>
          Ver vaga ↗
        </Button>
      </div>
    </div>
  )
}

export default JobCard
```

- [ ] **Step 5: Renderizar temporariamente 1 card fixo em `frontend/src/App.jsx`** (só pra verificação visual desta task — a Task 6 substitui isso pelo Dashboard de verdade)

```jsx
import JobCard from './components/JobCard'

const FAKE_JOB = {
  id: 999,
  title: 'Backend Developer Jr.',
  company: 'Empresa Teste',
  location: 'Remoto',
  tags: ['Python', 'Junior'],
  source: 'arbeitnow',
  relevance_score: 72,
  status: 'new',
  url: 'https://example.com',
}

function App() {
  return (
    <div className="min-h-screen bg-bg p-6 max-w-md">
      <JobCard job={FAKE_JOB} onAdapt={() => {}} onViewAdaptation={() => {}} />
    </div>
  )
}

export default App
```

- [ ] **Step 6: Verificação visual real**

```
preview_start (se não estiver rodando)
preview_screenshot
```

Confira visualmente: card branco com borda fina lilás clara, badge "72%" sólido roxo (score ≥50), tags claras, botão "Adaptar CV" roxo sólido.

Confirme a cor exata do botão primário:

```
preview_inspect selector=".bg-primary" styles=["background-color"]
```

Esperado: `rgb(107, 95, 148)` (equivalente a `#6B5F94`).

Passe o mouse no card (`preview_eval` disparando um evento de hover ou usando `preview_click` seguido de `preview_screenshot` não é necessário — confirme visualmente que existe `hover:` nas classes já commitadas é suficiente aqui, já que simular `:hover` via automação é limitado).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Button.jsx frontend/src/components/Badge.jsx frontend/src/components/Tag.jsx frontend/src/components/JobCard.jsx frontend/src/App.jsx
git commit -m "Adicionar componentes visuais base (Button, Badge, Tag, JobCard)"
```

---

## Task 6: Frontend — Dashboard com lista real e filtros

**Files:**
- Create: `frontend/src/components/FilterBar.jsx`
- Create: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/App.jsx` (remove o card fake da Task 5, renderiza `<Dashboard>`)

**Interfaces:**
- Consumes: `getJobs()`, `collectJobs()` de `../services/api.js`; `JobCard` da Task 5
- Produces: `<Dashboard onAdapt={fn} onViewAdaptation={fn}>` — consumido por `App.jsx` na Task 8 (que adiciona o modal)

- [ ] **Step 1: Criar `frontend/src/components/FilterBar.jsx`**

```jsx
function FilterBar({ search, onSearchChange, source, onSourceChange, status, onStatusChange, sources }) {
  return (
    <div className="flex gap-2 flex-wrap mb-5">
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Buscar por título, empresa, tecnologia..."
        className="flex-1 min-w-[200px] px-3.5 py-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <select
        value={source}
        onChange={(e) => onSourceChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-border bg-surface text-sm text-ink"
      >
        <option value="">Todas as fontes</option>
        {sources.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-border bg-surface text-sm text-ink"
      >
        <option value="">Todos os status</option>
        <option value="new">Novo</option>
        <option value="adapted">Adaptado</option>
        <option value="approved">Aprovado</option>
      </select>
    </div>
  )
}

export default FilterBar
```

- [ ] **Step 2: Criar `frontend/src/pages/Dashboard.jsx`**

```jsx
import { useState, useEffect, useMemo } from 'react'
import { getJobs, collectJobs } from '../services/api'
import JobCard from '../components/JobCard'
import FilterBar from '../components/FilterBar'
import Button from '../components/Button'

function Dashboard({ onAdapt, onViewAdaptation }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('')

  async function loadJobs() {
    setLoading(true)
    const data = await getJobs()
    setJobs(data)
    setLoading(false)
  }

  useEffect(() => {
    loadJobs()
  }, [])

  async function handleCollect() {
    setCollecting(true)
    await collectJobs()
    await loadJobs()
    setCollecting(false)
  }

  const sources = useMemo(() => [...new Set(jobs.map((j) => j.source))].sort(), [jobs])

  const filtered = useMemo(() => {
    return jobs
      .filter((j) => (source ? j.source === source : true))
      .filter((j) => (status ? j.status === status : true))
      .filter((j) => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          j.title.toLowerCase().includes(q) ||
          (j.company || '').toLowerCase().includes(q) ||
          (j.tags || []).some((t) => t.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))
  }, [jobs, source, status, search])

  return (
    <div>
      <div className="flex justify-between items-baseline mb-5">
        <div>
          <div className="text-[19px] font-bold text-ink">Vagas Automáticas</div>
          <div className="text-xs text-ink-secondary mt-0.5">{jobs.length} vagas coletadas</div>
        </div>
        <Button variant="primary" onClick={handleCollect} disabled={collecting}>
          {collecting ? 'Buscando...' : '↻ Buscar vagas agora'}
        </Button>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        source={source}
        onSourceChange={setSource}
        status={status}
        onStatusChange={setStatus}
        sources={sources}
      />

      {loading ? (
        <p className="text-ink-secondary text-sm">Carregando vagas...</p>
      ) : filtered.length === 0 ? (
        <p className="text-ink-secondary text-sm">Nenhuma vaga encontrada com esses filtros.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} onAdapt={onAdapt} onViewAdaptation={onViewAdaptation} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Dashboard
```

- [ ] **Step 3: Atualizar `frontend/src/App.jsx`** (substitui o card fake pelo Dashboard real)

```jsx
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <div className="min-h-screen bg-bg p-6">
      <Dashboard onAdapt={() => {}} onViewAdaptation={() => {}} />
    </div>
  )
}

export default App
```

- [ ] **Step 4: Verificação real ponta a ponta**

Suba backend E frontend:

```bash
cd backend && node src/index.js &
```

```
preview_start
preview_navigate http://localhost:5173
preview_snapshot
```

Espere ver: "247 vagas coletadas" (ou número real atual), cards de vaga reais (títulos que você já viu no banco, tipo "Junior Front End Developer"), botão "↻ Buscar vagas agora".

Teste os filtros:

```
preview_fill input[placeholder*="Buscar"] "python"
preview_snapshot
```

Confirme que a lista filtra pra vagas com "python" no título/empresa/tags.

Teste o botão de coleta:

```
preview_click button:has-text("Buscar vagas agora")
```

Espere o texto mudar pra "Buscando..." e depois voltar, com o contador de vagas atualizado (ou igual, se não houver vaga nova).

Confira erros:

```
preview_console_logs level=error
```

Esperado: vazio (sem erro de CORS, sem erro de fetch).

Encerre o backend ao final.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FilterBar.jsx frontend/src/pages/Dashboard.jsx frontend/src/App.jsx
git commit -m "Implementar Dashboard com lista real de vagas e filtros"
```

---

## Task 7: Frontend — Modal de adaptação de CV

**Files:**
- Create: `frontend/src/components/AdaptModal.jsx`
- Modify: `frontend/src/App.jsx` (adiciona state do modal, passa `onAdapt`/`onViewAdaptation` de verdade pro Dashboard)

**Interfaces:**
- Consumes: `adaptJob(jobId)`, `getAdaptation(jobId)`, `approveJob(jobId)` de `../services/api.js`; `Button`, `Badge`, `Tag` da Task 5
- Produces: `<AdaptModal job={job} onClose={fn} onApproved={fn}>` — consumido por `App.jsx`

- [ ] **Step 1: Criar `frontend/src/components/AdaptModal.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { adaptJob, getAdaptation, approveJob } from '../services/api'
import Button from './Button'
import Badge from './Badge'
import Tag from './Tag'

function AdaptModal({ job, onClose, onApproved }) {
  const [loading, setLoading] = useState(true)
  const [adaptation, setAdaptation] = useState(null)
  const [rejected, setRejected] = useState(null)
  const [approving, setApproving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      let result
      if (job.status === 'new') {
        result = await adaptJob(job.id)
      } else {
        const existing = await getAdaptation(job.id)
        result = { adapted: true, adaptation: existing.adaptation }
      }
      if (cancelled) return
      if (result.adapted) {
        setAdaptation(result.adaptation)
      } else {
        setRejected(result)
      }
      setLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [job.id, job.status])

  async function handleApprove() {
    setApproving(true)
    const result = await approveJob(job.id)
    const link = document.createElement('a')
    link.href = `http://localhost:5000${result.downloadUrl}`
    link.download = ''
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.open(result.jobUrl, '_blank')
    setApproving(false)
    onApproved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl p-6 max-w-md w-full border border-border shadow-2xl shadow-primary/20"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && <p className="text-ink-secondary text-sm">Adaptando currículo para esta vaga...</p>}

        {!loading && rejected && (
          <div>
            <p className="text-sm text-danger-ink mb-3">
              Não foi possível adaptar com segurança: {rejected.reason}. Mostrando o CV original.
            </p>
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        )}

        {!loading && adaptation && (
          <div>
            <div className="flex justify-between items-start mb-3.5">
              <div className="text-base font-bold text-ink pr-3">{job.title}</div>
              <Badge score={adaptation.match_score} />
            </div>

            <p className="text-[13px] text-ink leading-relaxed mb-3.5">
              {adaptation.adapted_content.summary}
            </p>

            <div className="flex gap-1.5 flex-wrap mb-4">
              {Object.values(adaptation.adapted_content.skills || {})
                .flat()
                .slice(0, 6)
                .map((skill) => (
                  <Tag key={skill} variant="relevant">
                    {skill}
                  </Tag>
                ))}
            </div>

            {adaptation.match_notes && (
              <div className="flex gap-2 p-2.5 bg-warning rounded-lg mb-4">
                <span className="text-sm">💬</span>
                <p className="text-xs text-warning-ink leading-snug">{adaptation.match_notes}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={handleApprove} disabled={approving}>
                {approving ? 'Preparando...' : 'Aprovar e preparar envio'}
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Descartar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdaptModal
```

- [ ] **Step 2: Atualizar `frontend/src/App.jsx`** (liga o modal de verdade)

```jsx
import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import AdaptModal from './components/AdaptModal'

function App() {
  const [modalJob, setModalJob] = useState(null)

  return (
    <div className="min-h-screen bg-bg p-6">
      <Dashboard onAdapt={setModalJob} onViewAdaptation={setModalJob} />
      {modalJob && (
        <AdaptModal job={modalJob} onClose={() => setModalJob(null)} onApproved={() => {}} />
      )}
    </div>
  )
}

export default App
```

- [ ] **Step 3: Verificação real ponta a ponta**

Backend rodando (`node src/index.js &`), frontend rodando via preview.

```
preview_navigate http://localhost:5173
preview_click button:has-text("Adaptar CV")  (no primeiro card visível)
preview_snapshot
```

Espere: "Adaptando currículo para esta vaga..." aparece brevemente, depois o modal mostra resumo real, skills, badge de score, e (se aplicável) a nota honesta com 💬. Isso vai gastar 1 chamada real de API — normal e esperado aqui.

Teste "Ver CV adaptado" numa vaga que já tenha `status = 'adapted'` (ex: a vaga que acabou de ser adaptada no passo anterior — recarregue a página com `preview_eval: window.location.reload()` pra pegar o status atualizado, depois clique de novo no mesmo job agora mostrando "Ver CV adaptado"):

```
preview_eval: window.location.reload()
preview_click button:has-text("Ver CV adaptado")
preview_network filter=all
```

Confirme na lista de rede que essa segunda chamada foi um **GET** pra `/adaptation` (não um novo POST pra `/adapt`) — prova que não gastou API de novo.

Encerre o backend ao final.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AdaptModal.jsx frontend/src/App.jsx
git commit -m "Implementar modal de adaptacao de CV"
```

---

## Task 8: Frontend — fluxo de aprovação real + Histórico

**Files:**
- Create: `frontend/src/pages/History.jsx`
- Modify: `frontend/src/App.jsx` (abas Dashboard/Histórico/Configurações + estado `activeTab`)

**Interfaces:**
- Consumes: `getApplications()` de `../services/api.js`
- Produces: `<History>` — consumido por `App.jsx`

- [ ] **Step 1: Criar `frontend/src/pages/History.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { getApplications } from '../services/api'

function History() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getApplications().then((data) => {
      setApplications(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-ink-secondary text-sm">Carregando histórico...</p>
  if (applications.length === 0) {
    return <p className="text-ink-secondary text-sm">Nenhuma candidatura aprovada ainda.</p>
  }

  return (
    <div className="flex flex-col gap-2.5">
      {applications.map((app) => (
        <div
          key={app.id}
          className="bg-surface rounded-xl p-4 border border-border flex justify-between items-center"
        >
          <div>
            <div className="font-semibold text-ink text-[15px]">{app.title}</div>
            <div className="text-ink-secondary text-[13px] mt-0.5">
              {app.company} · aprovado em {new Date(app.approved_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div className="flex gap-3">
            <a
              href={`http://localhost:5000${app.pdf_path}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-primary hover:text-primary-hover"
            >
              Ver PDF
            </a>
            <a
              href={app.job_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-ink-secondary hover:text-primary"
            >
              Ver vaga ↗
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}

export default History
```

- [ ] **Step 2: Atualizar `frontend/src/App.jsx`** (abas + conclusão do fluxo de aprovação)

```jsx
import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import AdaptModal from './components/AdaptModal'

const TABS = [
  { id: 'dashboard', label: 'Vagas' },
  { id: 'history', label: 'Histórico' },
]

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [modalJob, setModalJob] = useState(null)
  const [historyKey, setHistoryKey] = useState(0)

  function handleApproved() {
    setHistoryKey((k) => k + 1)
  }

  return (
    <div className="min-h-screen bg-bg">
      <nav className="flex gap-1 px-6 pt-5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-surface text-primary border border-border border-b-surface'
                : 'text-ink-secondary hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="bg-surface border-t border-border p-6 min-h-[calc(100vh-64px)]">
        {activeTab === 'dashboard' && <Dashboard onAdapt={setModalJob} onViewAdaptation={setModalJob} />}
        {activeTab === 'history' && <History key={historyKey} />}
      </main>

      {modalJob && (
        <AdaptModal job={modalJob} onClose={() => setModalJob(null)} onApproved={handleApproved} />
      )}
    </div>
  )
}

export default App
```

- [ ] **Step 3: Verificação real ponta a ponta (fluxo completo)**

Backend rodando, frontend rodando.

```
preview_navigate http://localhost:5173
preview_click button:has-text("Adaptar CV")
```

No modal, clique em "Aprovar e preparar envio":

```
preview_click button:has-text("Aprovar e preparar envio")
```

Confirme via `preview_network` que houve um `POST /api/jobs/{id}/approve` com resposta 200. Confirme que uma nova aba/download foi disparado (verificável indiretamente: `preview_network` mostra um `GET /generated-cvs/....pdf`).

Troque pra aba Histórico:

```
preview_click button:has-text("Histórico")
preview_snapshot
```

Espere ver a vaga recém-aprovada listada, com "Ver PDF" e "Ver vaga ↗".

Confirme no banco:

```bash
docker exec vagas-automaticas-postgres-1 psql -U postgres -d vagas_automaticas -c "SELECT count(*) FROM applications;"
```

Encerre o backend ao final.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/History.jsx frontend/src/App.jsx
git commit -m "Implementar fluxo de aprovacao completo e tela de Historico"
```

---

## Task 9: Frontend — Configurações (mínima)

Prioridade baixa por decisão do spec — só exibição do CV base, sem formulário de edição (edição continua via `seed.js`/SQL direto por enquanto).

**Files:**
- Create: `frontend/src/pages/Settings.jsx`
- Modify: `frontend/src/App.jsx` (adiciona aba Configurações)

**Interfaces:**
- Consumes: `getCv()` de `../services/api.js`
- Produces: `<Settings>` — consumido por `App.jsx`

- [ ] **Step 1: Criar `frontend/src/pages/Settings.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { getCv } from '../services/api'

function Settings() {
  const [cv, setCv] = useState(null)

  useEffect(() => {
    getCv().then(setCv)
  }, [])

  if (!cv) return <p className="text-ink-secondary text-sm">Carregando CV...</p>

  return (
    <div className="bg-surface rounded-xl p-5 border border-border">
      <div className="font-semibold text-ink text-base mb-1">{cv.full_name}</div>
      <p className="text-ink-secondary text-sm mb-4">
        {cv.contact?.email} · {cv.contact?.location}
      </p>
      <p className="text-[13px] text-ink leading-relaxed mb-4">{cv.summary}</p>
      <p className="text-xs text-ink-secondary">
        Edição de CV e preferências ainda não tem formulário nesta fase — ajuste direto no banco
        (tabelas <code>cv_base</code> e <code>preferences</code>) e rode{' '}
        <code>node src/db/seed.js</code> novamente com os dados atualizados.
      </p>
    </div>
  )
}

export default Settings
```

- [ ] **Step 2: Atualizar `frontend/src/App.jsx`** (adiciona a aba)

```jsx
import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Settings from './pages/Settings'
import AdaptModal from './components/AdaptModal'

const TABS = [
  { id: 'dashboard', label: 'Vagas' },
  { id: 'history', label: 'Histórico' },
  { id: 'settings', label: 'Configurações' },
]

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [modalJob, setModalJob] = useState(null)
  const [historyKey, setHistoryKey] = useState(0)

  function handleApproved() {
    setHistoryKey((k) => k + 1)
  }

  return (
    <div className="min-h-screen bg-bg">
      <nav className="flex gap-1 px-6 pt-5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-surface text-primary border border-border border-b-surface'
                : 'text-ink-secondary hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="bg-surface border-t border-border p-6 min-h-[calc(100vh-64px)]">
        {activeTab === 'dashboard' && <Dashboard onAdapt={setModalJob} onViewAdaptation={setModalJob} />}
        {activeTab === 'history' && <History key={historyKey} />}
        {activeTab === 'settings' && <Settings />}
      </main>

      {modalJob && (
        <AdaptModal job={modalJob} onClose={() => setModalJob(null)} onApproved={handleApproved} />
      )}
    </div>
  )
}

export default App
```

- [ ] **Step 3: Verificação real**

```
preview_navigate http://localhost:5173
preview_click button:has-text("Configurações")
preview_snapshot
```

Espere ver o nome real do candidato (João Vitor Vieira Santos), email, resumo profissional real vindo de `GET /api/cv`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Settings.jsx frontend/src/App.jsx
git commit -m "Adicionar tela de Configuracoes (visualizacao do CV base)"
```

---

## Task 10: Verificação final e screenshot de entrega

**Files:** nenhum arquivo novo — só verificação.

- [ ] **Step 1: Rodar o fluxo completo do zero**

Backend + frontend rodando. Navegue pelo app inteiro:

```
preview_navigate http://localhost:5173
preview_screenshot
```

Confirme visualmente: paleta lavanda empoeirado aplicada (fundo `#FAF9FC`, botões `#6B5F94`), fonte Sora carregada (sem fallback pra Arial), cards sem sombra em repouso, badges de score com cores diferentes conforme o valor.

- [ ] **Step 2: Checar console e rede por erros**

```
preview_console_logs level=error
preview_network filter=failed
```

Esperado: ambos vazios.

- [ ] **Step 3: Encerrar servidores de teste**

```bash
netstat -ano | grep ":5000" | grep LISTENING
taskkill //F //PID <pid>
```

(o preview do frontend pode ficar rodando via `preview_stop` se não for mais precisar, ou deixar pro usuário continuar usando).

- [ ] **Step 4: Commit final (se houver ajustes pendentes de correções encontradas na verificação)**

```bash
git add -A
git commit -m "Ajustes finais de verificacao do frontend"
git push origin master
```
