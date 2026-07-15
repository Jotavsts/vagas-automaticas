import Anthropic from '@anthropic-ai/sdk';
import { parseJsonFromText } from '../utils/jsonExtract.js';

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `Você resume vagas de emprego pra uso interno de um sistema de matching de currículos.

Regras:
1. Escreva um resumo curto (2-3 frases, em pt-BR) com o essencial: o que a vaga pede, principais responsabilidades e requisitos.
2. Extraia uma lista de palavras-chave (tecnologias, skills, requisitos, modalidade de trabalho) mencionadas explicitamente no texto.
3. Determine a modalidade de trabalho: "remoto" (remoto/home office/100% remoto), "hibrido" (híbrido/parcialmente presencial) ou "presencial" (presencial/local específico). Se não der pra determinar, use null.
4. Extraia o estado (UF, sigla de 2 letras maiúsculas, ex: "SP", "RJ") a partir da localização. Se for remoto/nacional/sem cidade definida, use null.
5. NUNCA invente informação que não está no texto original — só resuma e extraia o que está lá.
6. Responda APENAS com um único objeto JSON válido, sem texto fora do JSON.`;

function buildUserMessage(job) {
  return `Título: ${job.title || ''}
Empresa: ${job.company || ''}
Localização: ${job.location || ''}
Tags: ${(job.tags || []).join(', ')}

Descrição da vaga:
${job.description || ''}

Responda com JSON no formato: { "summary": string, "keywords": [string], "modality": "remoto"|"hibrido"|"presencial"|null, "state": string|null }`;
}

/**
 * Fallback determinístico usado quando a chamada à IA falha — não inventa nada,
 * só reaproveita título e tags já estruturados pela fonte.
 */
function fallbackSummary(job) {
  return {
    summary: job.title || '',
    keywords: Array.isArray(job.tags) ? job.tags : [],
    modality: null,
    state: null,
  };
}

const VALID_MODALITIES = new Set(['remoto', 'hibrido', 'presencial']);

function normalizeModality(value) {
  if (typeof value !== 'string') return null;
  const v = value.toLowerCase().trim();
  return VALID_MODALITIES.has(v) ? v : null;
}

function normalizeState(value) {
  if (typeof value !== 'string') return null;
  const v = value.toUpperCase().trim();
  return /^[A-Z]{2}$/.test(v) ? v : null;
}

/**
 * Resume uma vaga recém-coletada em summary + keywords via IA, sem nunca
 * persistir o texto original da descrição.
 *
 * @param {object} job - { title, company, location, description, tags }
 * @returns {Promise<{summary: string, keywords: string[], modality: string|null, state: string|null}>}
 */
export async function summarizeJob(job) {
  if (!job.description || !job.description.trim()) {
    return fallbackSummary(job);
  }

  try {
    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(job) }],
    });
    const block = response.content && response.content[0];
    const text = block && block.type === 'text' ? block.text : '';
    const parsed = parseJsonFromText(text);

    if (
      !parsed ||
      typeof parsed.summary !== 'string' ||
      !parsed.summary.trim() ||
      !Array.isArray(parsed.keywords)
    ) {
      return fallbackSummary(job);
    }

    return {
      summary: parsed.summary.trim(),
      keywords: parsed.keywords.filter((k) => typeof k === 'string' && k.trim()),
      modality: normalizeModality(parsed.modality),
      state: normalizeState(parsed.state),
    };
  } catch (err) {
    console.error(`[jobSummarizer] falha ao resumir "${job.title}", usando fallback:`, err.message);
    return fallbackSummary(job);
  }
}
