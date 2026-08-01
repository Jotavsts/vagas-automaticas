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
- **IA**: Anthropic Claude API (extração e adaptação de currículo)
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
# preencher CLAUDE_API_KEY, credenciais do banco, etc.
```

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
