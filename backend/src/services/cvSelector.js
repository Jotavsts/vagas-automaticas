import Anthropic from '@anthropic-ai/sdk';
import { parseJsonFromText } from '../utils/jsonExtract.js';

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `Você escolhe qual currículo (dentre os que a pessoa cadastrou) é a melhor BASE para adaptar a uma vaga específica.

A pessoa pode ter currículos de áreas bem diferentes (ex: um de tecnologia, um de atendimento) porque na vida real busca oportunidades em frentes distintas. Sua tarefa é só escolher o CV base mais alinhado à vaga — a adaptação em si acontece depois, num passo separado.

Regras:
1. Escolha exatamente UM currículo, o mais relevante para a vaga.
2. Baseie-se no foco/área de cada currículo (label + skills) versus o que a vaga pede.
3. Responda APENAS com um único objeto JSON válido, sem texto fora do JSON.`;

function buildUserMessage(job, cvs) {
  const cvList = cvs
    .map((cv) => {
      const skills = cv.skills
        ? Object.values(cv.skills).filter(Array.isArray).flat().slice(0, 15).join(', ')
        : '';
      return `- id ${cv.id} | "${cv.label || 'sem rótulo'}" | skills: ${skills}`;
    })
    .join('\n');

  return `VAGA
Título: ${job.title || ''}
Resumo: ${job.summary || ''}
Palavras-chave: ${(job.keywords || []).join(', ')}

CURRÍCULOS DISPONÍVEIS:
${cvList}

Responda com JSON no formato: { "cv_base_id": number, "reason": string (1 frase curta em pt-BR) }`;
}

/**
 * Escolhe o CV base mais relevante para uma vaga.
 * Se só houver 1 CV, retorna direto sem chamar a IA.
 *
 * @param {object} job - { title, summary, keywords }
 * @param {Array<{id:number, label:string, skills:object}>} cvs
 * @returns {Promise<{cv_base_id: number, reason: string|null}>}
 */
export async function selectCv(job, cvs) {
  if (!Array.isArray(cvs) || cvs.length === 0) {
    return { cv_base_id: null, reason: null };
  }
  if (cvs.length === 1) {
    return { cv_base_id: cvs[0].id, reason: null };
  }

  const validIds = new Set(cvs.map((c) => c.id));

  try {
    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(job, cvs) }],
    });
    const block = response.content && response.content[0];
    const text = block && block.type === 'text' ? block.text : '';
    const parsed = parseJsonFromText(text);

    if (parsed && validIds.has(parsed.cv_base_id)) {
      return {
        cv_base_id: parsed.cv_base_id,
        reason: typeof parsed.reason === 'string' ? parsed.reason.trim() : null,
      };
    }
  } catch (err) {
    console.error('[cvSelector] falha ao selecionar CV, usando o primeiro:', err.message);
  }

  // Fallback: primeiro CV da lista
  return { cv_base_id: cvs[0].id, reason: null };
}
