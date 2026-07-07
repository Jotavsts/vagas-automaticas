import { pool } from '../utils/db.js';

const fullName = 'João Vitor Vieira Santos';

const contact = {
  phone: '(79) 99151-7345',
  email: 'joaoanajoao47@gmail.com',
  location: 'Aracaju, Sergipe, Brasil',
  linkedin: 'linkedin.com/in/jotavsts',
  github: 'github.com/jotavsts',
};

const summary =
  'Desenvolvedor de Software focado em resolver problemas complexos através de código limpo, arquitetura escalável e Inteligência Artificial. Tenho forte base em desenvolvimento backend tradicional e vivência prática na construção e deploy de agentes autônomos, integrações com LLMs e pipelines na AWS. Trabalho com alta autonomia e senso de responsabilidade sobre minhas entregas, aliando sólidos fundamentos de engenharia ao uso estratégico de ferramentas modernas. Meu objetivo hoje é integrar um time colaborativo e sênior, onde eu possa trocar experiências, contribuir ativamente com a qualidade técnica de projetos de larga escala e crescer construindo produtos de alto impacto.';

const experience = [
  {
    company: 'Disc.AI',
    role: 'Desenvolvedor Backend (Foco em IA)',
    location: 'Aracaju, SE (Remoto)',
    start_date: '2025-12',
    end_date: null,
    bullets: [
      'Desenvolvimento de agentes autônomos de Inteligência Artificial (24/7) focados em potencializar operações de negócios e captação de leads em múltiplos nichos.',
      'Arquitetura e criação de landing pages e sistemas web modernos integrados a serviços de automação e modelos generativos.',
      'Responsável pelas decisões técnicas de arquitetura, garantindo escalabilidade, resiliência de infraestrutura e aplicação de boas práticas de engenharia de software.',
    ],
  },
  {
    company: 'Compass UOL',
    role: 'Desenvolvedor / Estagiário em Inteligência Artificial com AWS',
    location: 'Remoto',
    start_date: '2024-12',
    end_date: '2025-05',
    bullets: [
      'Desenvolvimento de soluções inteligentes utilizando Python e Node.js, realizando a integração de modelos de NLP (Processamento de Linguagem Natural) a chatbots e sistemas.',
      'Criação e manutenção de pipelines serverless utilizando AWS Lambda, otimizando o custo computacional e assegurando a escalabilidade das aplicações.',
      'Manipulação e tratamento de dados não estruturados via Amazon Textract e Comprehend, refinando os dados para consumo de APIs e modelos.',
      'Construção de integrações via API Gateway, S3 e CloudWatch, operando em ambiente ágil (Scrum) com uso intensivo de Docker e EC2 para deploys controlados.',
    ],
  },
  {
    company: 'Gesso Decor Aju',
    role: 'Analista de Projetos e Software',
    location: 'Aracaju, SE',
    start_date: '2021-04',
    end_date: '2023-03',
    bullets: [
      'Automação de processos operacionais internos, desenvolvimento de controles de materiais e relatórios utilizando lógica de programação e scripts (JavaScript/VBA).',
      'Manutenção de sistemas web internos e apoio na transição de processos manuais para fluxos digitais estruturados.',
      'Gestão de infraestrutura de TI, configuração de VPNs para acesso remoto seguro e resolução de incidentes de software/hardware.',
    ],
  },
];

const education = [
  {
    institution: 'Faculdade Maurício de Nassau',
    location: 'Aracaju, SE',
    degree: 'Graduação em Análise e Desenvolvimento de Sistemas (Cursando 3º/4º período)',
    expected_completion: '2026-12',
  },
];

const skills = {
  languages: ['Python', 'Node.js', 'JavaScript', 'conceitos de Django', 'FastAPI'],
  ai: [
    'Integração de LLMs',
    'NLP',
    'Agentes Autônomos',
    'IA Generativa',
    'RAG',
    'LangChain',
    'Vector Databases',
    'Pinecone',
    'Milvus',
    'ChromaDB',
    'Hugging Face',
    'Prompt Engineering',
    'Agentic AI',
  ],
  cloud: [
    'AWS Lambda',
    'AWS S3',
    'AWS EC2',
    'API Gateway',
    'Amazon Textract',
    'Amazon Comprehend',
    'Docker',
    'Kubernetes',
    'Terraform',
    'CI/CD',
    'GitHub Actions',
  ],
  tools: [
    'Git',
    'Scrum',
    'MongoDB',
    'OpenSearch',
    'SQL',
    'NoSQL',
    'Microsserviços',
    'System Design',
    'RESTful APIs',
  ],
};

// Leque amplo de propósito: backend/IA (foco principal) + frontend/fullstack
// (áreas adjacentes que o João quer alcançar). O relevance_score é ranking, não
// filtro — então incluir termos de frontend faz essas vagas subirem, sem excluir nada.
const preferenceKeywords = [
  // Linguagens e base
  'python',
  'node.js',
  'javascript',
  'typescript',
  // Frontend
  'react',
  'next.js',
  'frontend',
  'front-end',
  'html',
  'css',
  'tailwind',
  // Fullstack / API
  'fullstack',
  'full stack',
  'backend',
  'back-end',
  'api',
  'rest',
  'fastapi',
  'django',
  'express',
  // Infra / dados
  'aws',
  'docker',
  'sql',
  'postgresql',
  'mongodb',
  // IA
  'llm',
  'nlp',
  'langchain',
  'rag',
  'inteligência artificial',
  'machine learning',
  // Prática
  'git',
];

async function seed() {
  try {
    await pool.query(
      `INSERT INTO cv_base (full_name, contact, summary, experience, education, skills)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        fullName,
        JSON.stringify(contact),
        summary,
        JSON.stringify(experience),
        JSON.stringify(education),
        JSON.stringify(skills),
      ]
    );

    await pool.query(
      `INSERT INTO preferences (keywords)
       VALUES ($1)`,
      [preferenceKeywords]
    );

    console.log('Seed concluído com sucesso: cv_base e preferences populados.');
  } catch (err) {
    console.error('Erro ao executar o seed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
