# Frontend — Vagas Automáticas (Design Spec)

Data: 2026-07-07. Sistema de visual/tokens em `DESIGN.md`, contexto estratégico em `PRODUCT.md` (raiz do projeto). Este documento cobre a estrutura funcional das telas e o que falta no backend pra sustentá-las.

## Navegação

**Dashboard único** — sem multi-páginas. Ações abrem em modal por cima da lista de vagas (decisão do usuário, prioriza velocidade de uso no dia a dia).

## Telas

### 1. Dashboard (tela principal)
- Header: nome do app, contador de vagas coletadas, timestamp da última busca, botão "Buscar vagas agora" (`POST /api/jobs/collect`)
- Barra de filtros: busca por texto (título/empresa/tecnologia), filtro por fonte (das 7 fontes), filtro por status (novo/adaptado/aprovado), tudo client-side sobre o resultado de `GET /api/jobs`
- Grid de cards de vaga (2 colunas), ordenado por `relevance_score` desc por padrão
- Cada card: título, empresa, local, badge de match (cor funcional: sólido=alto, claro=médio, neutro=baixo/sênior), tags (skills + fonte), botão primário contextual:
  - Status `new` → "Adaptar CV" (`POST /api/jobs/:id/adapt`)
  - Status `adapted` → "Ver CV adaptado" (reabre o modal com a adaptação já salva)
  - Botão secundário sempre: "Ver vaga ↗" (abre a URL original em nova aba)

### 2. Modal de adaptação de CV
- Abre ao clicar "Adaptar CV" (chama a API na hora, sem pré-carregar — decisão do usuário: controle sobre quando gastar a chamada)
- Mostra: título/empresa da vaga, badge de match, resumo reescrito, skills priorizadas, nota honesta da IA (`match_notes`) com destaque visual (ícone 💬 + fundo `--warning-bg`, sem rótulo maiúsculo)
- Se `adapted: false` (validação anti-alucinação rejeitou): mostra aviso "não foi possível adaptar com segurança" + CV original, sem os botões de aprovar
- Botões: "Aprovar e preparar envio" (ver Fluxo de aprovação abaixo) / "Descartar" (fecha o modal, não muda nada)

### 3. Fluxo de aprovação ("Aprovar e preparar envio")
Ao clicar, em sequência:
1. Chama `POST /api/jobs/:id/generate-pdf` (gera o PDF a partir da adaptação salva)
2. **[GAP DE BACKEND — não existe ainda]** grava um registro em `applications` (job_id, cv_adaptation_id, pdf_path, opened_url) e atualiza `jobs.status` para `'approved'`
3. Frontend dispara o download do PDF retornado
4. Frontend abre a URL da vaga original em nova aba (`window.open(job.url, '_blank')`)

### 4. Histórico
**[GAP DE BACKEND — endpoint não existe ainda]** precisa de `GET /api/applications` (join `applications` + `jobs`) retornando: título da vaga, empresa, data de aprovação, link do PDF gerado, status.
- Tela simples: tabela/lista cronológica (mais recente primeiro) das vagas aprovadas, com link pra reabrir o PDF e pra vaga original
- Segue o mesmo sistema visual do DESIGN.md (sem mockup dedicado — reaproveita padrões de card/tabela já definidos)

### 5. Configurações
- Edição do CV base (`GET`/`PUT /api/cv` — o PUT ainda não existe, só GET)
- Edição de preferências/keywords (`preferences` — hoje só editável via SQL direto, sem endpoint)
- Tela simples de formulário, sem mockup dedicado — prioridade baixa (fase 1 é uso pessoal, editar via seed/SQL é aceitável por enquanto se o tempo apertar)

## Sistema visual
Ver `DESIGN.md` para paleta (lavanda empoeirado #6B5F94), tipografia (Sora + IBM Plex Mono só pra números), e regras de componente (card sem "ghost border+shadow", badge de score funcional, sem eyebrows decorativos).

## Lacunas de backend identificadas (entram no plano de implementação)
1. `POST /api/jobs/:id/approve` (ou estender `generate-pdf`) — gravar em `applications`, atualizar status pra `approved`
2. `GET /api/applications` — histórico
3. `PUT /api/cv` — editar CV base (opcional, pode ficar pra depois)
4. `GET`/`PUT /api/preferences` — editar keywords (opcional, pode ficar pra depois)

## Stack de implementação
React + Vite + Tailwind (config já existe em `frontend/`, hoje com tema escuro placeholder — será substituído pelos tokens do DESIGN.md). Sem biblioteca de rotas (não precisa, é dashboard único). `axios` ou `fetch` puro pra chamadas — decidir na hora do plano.
