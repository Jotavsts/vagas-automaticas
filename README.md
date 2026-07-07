# 🚀 Vagas Automáticas

Ferramenta inteligente para automação de envio de currículos adaptados a vagas de tecnologia remota.

## 📋 Features (Fase 1)

- ✅ Busca automática de vagas (Indeed + Remotar.com.br)
- ✅ Adaptação inteligente de CV usando IA (Claude API)
- ✅ Dashboard para visualizar vagas
- ✅ Aprovação e envio em 1 clique
- ✅ Histórico de aplicações

## 🛠️ Stack

- **Backend**: Node.js + Express
- **Frontend**: React + Vite + Tailwind CSS
- **Banco**: PostgreSQL
- **IA**: Claude API

## 🚀 Quick Start

### 1. Instalar dependências

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configurar variáveis de ambiente

```bash
# Backend
cp .env.example .env
# Editar .env com suas credenciais
```

### 3. Iniciar desenvolvimento

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Backend rodará em `http://localhost:5000`  
Frontend rodará em `http://localhost:5173`

## 📁 Estrutura do Projeto

```
vagas-automaticas/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Lógica dos endpoints
│   │   ├── services/        # Lógica de negócio
│   │   ├── models/          # Modelos do banco
│   │   ├── routes/          # Rotas da API
│   │   ├── utils/           # Funções utilitárias
│   │   └── index.js         # Entrada do backend
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   ├── pages/           # Páginas
│   │   ├── services/        # Chamadas API
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
│
└── README.md
```

## 🎯 Próximos Passos

1. [ ] Setup do banco PostgreSQL
2. [ ] Criar modelos de dados (User, Job, Application, CV)
3. [ ] Implementar scraping Indeed + Remotar
4. [ ] Integrar Claude API para adaptação de CV
5. [ ] Criar endpoints da API
6. [ ] Desenvolver frontend
7. [ ] Implementar autenticação
8. [ ] Deploy

## 📝 Notas

- Este é um projeto em desenvolvimento
- Fase 1: MVP funcional (você usar sozinho)
- Fase 2: Multi-usuário com automação 24/7

---

**Desenvolvido com ❤️ por João Vitor**
