# 🚀 Adapta Aí

Ferramenta de automação de candidaturas a vagas de tecnologia remota: busca
oportunidades, adapta o currículo pra cada vaga com IA e deixa o candidato
revisar e enviar com um clique.

## 📋 Features

- Busca automática de vagas (Indeed, Remotar.com.br e outras fontes) com filtro de relevância
- Adaptação de currículo por vaga usando IA, com validação anti-alucinação (nunca inventa empresa, cargo ou tecnologia que não esteja no currículo original)
- Geração de PDF do currículo adaptado
- Dashboard de vagas, histórico de candidaturas com status (enviado, em processo, oferta, rejeitado)
- Notificações via Telegram
- Autenticação de usuário, suporte a múltiplos currículos base por usuário

## 🛠️ Stack

- **Backend**: Node.js + Express, PostgreSQL
- **Frontend**: React + Vite + Tailwind CSS
- **IA**: multi-provedor com fallback automático (Anthropic, Groq, NVIDIA NIM, Google Gemini, OpenRouter, Cerebras, Cohere, Mistral) — se um provedor falhar ou ficar sem crédito, tenta o próximo sozinho
- **PDF**: Playwright (renderização HTML → PDF)
- **Infra**: Docker Compose (Postgres)

## 🚀 Quick Start

### 1. Banco de dados

```bash
docker compose up -d
```

Aplica o schema (primeira vez ou após alterações em `backend/src/db/schema.sql`):

```bash
docker exec -i <container_postgres> psql -U postgres -d vagas_automaticas < backend/src/db/schema.sql
```

### 2. Instalar dependências

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configurar variáveis de ambiente

```bash
cd backend
cp .env.example .env
# preencher credenciais do banco e pelo menos 1 provedor de IA (ver seção abaixo)
```

## 🔑 Provedores de IA (grátis, sem cartão)

O projeto tenta os provedores na ordem definida em `AI_PROVIDERS` (env, separado
por vírgula) e cai pro próximo automaticamente se um falhar/acabar limite —
não precisa pagar nada pra rodar. Configure pelo menos 1, quanto mais tiver
na fila mais resiliente fica.

**Groq** (recomendado, mais rápido de configurar)
Link: https://console.groq.com/keys
Instrução: login com email → key gerada na hora, sem cartão.

**NVIDIA NIM**
Link: https://build.nvidia.com
Instrução: login → avatar no canto superior direito → API Keys → Generate API Key. Pede verificação de telefone.

**Google Gemini (AI Studio)**
Link: https://aistudio.google.com/apikey
Instrução: login com conta Google → Create API key → escolhe ou cria um projeto.

**OpenRouter**
Link: https://openrouter.ai/keys
Instrução: signup → Create Key. Pra usar os modelos `:free` precisa ativar "Enable free endpoints that may train on inputs" em Settings → Privacy.

**Cerebras**
Link: https://cloud.cerebras.ai
Instrução: signup → API Keys.

**Cohere**
Link: https://dashboard.cohere.com/api-keys
Instrução: signup → gera key direto no dashboard.

**Mistral**
Link: https://console.mistral.ai/api-keys
Instrução: signup → Create new key.

**Anthropic** (paga, opcional como reserva)
Link: https://console.anthropic.com
Instrução: só precisa se quiser Claude na fila — exige crédito em Plans & Billing.

Depois de criar a key, cola no `.env`:

```bash
AI_PROVIDERS=groq,nvidia,google,openrouter,cohere,mistral
GROQ_API_KEY=...
NVIDIA_API_KEY=...
GOOGLE_API_KEY=...
OPENROUTER_API_KEY=...
COHERE_API_KEY=...
MISTRAL_API_KEY=...
```

Cada provedor tem key própria e nome de env próprio (`{NOME}_API_KEY`), ver
[.env.example](backend/.env.example) pra lista completa com nomes de modelo
padrão. Não precisa gerar key nova quando o limite estourar — ele reseta
sozinho (por minuto/dia/mês, depende do provedor) e o sistema volta a tentar
automaticamente.

### 4. Rodar

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Backend em `http://localhost:5000`, frontend em `http://localhost:5173`.

## 📁 Estrutura do Projeto

```
vagas-automaticas/
├── backend/
│   └── src/
│       ├── controllers/     # auth, cv, jobs, applications, channels
│       ├── services/        # coleta de vagas, extração/adaptação de CV, geração de PDF, notificações
│       ├── db/               # schema.sql, conexão
│       ├── routes/
│       ├── middleware/
│       └── assets/icons/    # ícones do template de currículo
│
└── frontend/
    └── src/
        ├── pages/            # Dashboard, History, Settings, Login, Signup
        ├── components/
        └── services/
```

## 🎯 Próximos passos

- [ ] Deploy em produção
- [ ] Plano pago (hoje limitado a 2 currículos base por usuário)
- [ ] Mais fontes de vaga

---

**João Vitor**
