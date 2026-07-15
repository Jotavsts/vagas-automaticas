import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import { parseJsonFromText } from '../utils/jsonExtract.js';

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `Você extrai dados estruturados de um currículo (PDF ou texto) para um schema JSON fixo.

Regras:
1. Extraia APENAS o que está literalmente presente no documento. NUNCA invente empresa, cargo, tecnologia, data, formação ou qualquer outro dado que não esteja no currículo.
2. Se um campo não estiver presente no documento, use null (para campos de texto) ou [] (para listas) — nunca preencha com um valor genérico ou inventado.
3. NUNCA infira ou atribua um nível de senioridade (júnior/pleno/sênior) que não esteja escrito explicitamente no documento — apenas copie títulos de cargo como estão escritos.
4. Datas devem ser normalizadas para o formato "YYYY-MM" quando possível (ex: "Janeiro de 2023" vira "2023-01"); se não for possível determinar o mês, use null.
5. Responda APENAS com JSON válido no schema fornecido, sem texto fora do JSON.`;

const OUTPUT_SCHEMA_DOC = `Schema JSON de saída esperado (responda APENAS com um único objeto JSON neste formato):
{
  "label": string (rótulo curto de 1-3 palavras resumindo o foco deste currículo, ex: "Desenvolvimento Backend", "Atendimento ao Cliente", "Medicina Veterinária" — baseado na área/cargo predominante do documento),
  "full_name": string,
  "contact": { "phone": string|null, "email": string|null, "location": string|null, "linkedin": string|null, "github": string|null },
  "summary": string|null,
  "experience": [ { "company": string, "role": string, "location": string|null, "start_date": string|null, "end_date": string|null, "bullets": [string] } ],
  "education": [ { "institution": string, "location": string|null, "degree": string, "expected_completion": string|null } ],
  "skills": { "languages": [string], "ai": [string], "cloud": [string], "tools": [string] }
}`;

function buildTextMessage(resumeText) {
  return `CURRÍCULO (texto extraído do documento):\n${resumeText}\n\n${OUTPUT_SCHEMA_DOC}`;
}

/**
 * Extrai texto puro de um arquivo DOCX.
 */
async function extractDocxText(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

/**
 * Valida que a extração produziu um currículo plausível, não apenas um objeto vazio/inventado.
 * Retorna { ok: true } ou { ok: false, reason: '...' }.
 */
function validateExtractionShape(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'resposta não é um objeto JSON válido' };
  }
  if (!parsed.full_name || typeof parsed.full_name !== 'string' || !parsed.full_name.trim()) {
    return { ok: false, reason: 'full_name ausente ou vazio' };
  }
  const hasSummary = typeof parsed.summary === 'string' && parsed.summary.trim().length > 0;
  const hasExperience = Array.isArray(parsed.experience) && parsed.experience.length > 0;
  const hasSkills =
    parsed.skills &&
    typeof parsed.skills === 'object' &&
    Object.values(parsed.skills).some((list) => Array.isArray(list) && list.length > 0);

  if (!hasSummary && !hasExperience && !hasSkills) {
    return { ok: false, reason: 'nenhum conteúdo relevante extraído (documento pode não ser um currículo)' };
  }

  return { ok: true };
}

/**
 * Achata as listas de skills extraídas numa lista única de keywords em minúsculas,
 * usada pra popular preferences.keywords automaticamente no cadastro.
 */
export function deriveKeywordsFromSkills(skills = {}) {
  const all = Object.values(skills)
    .filter(Array.isArray)
    .flat()
    .map((s) => String(s).toLowerCase().trim())
    .filter(Boolean);
  return Array.from(new Set(all));
}

/**
 * Extrai o CV estruturado de um arquivo enviado (PDF ou DOCX) usando a API da Claude.
 *
 * @param {Buffer} fileBuffer
 * @param {string} mimetype
 * @returns {Promise<object>} { extracted: true, content } ou { extracted: false, reason }
 */
export async function extractCv(fileBuffer, mimetype) {
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  let userMessageContent;
  if (mimetype === 'application/pdf') {
    userMessageContent = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: fileBuffer.toString('base64'),
        },
      },
      { type: 'text', text: OUTPUT_SCHEMA_DOC },
    ];
  } else {
    let resumeText;
    try {
      resumeText = await extractDocxText(fileBuffer);
    } catch (err) {
      return { extracted: false, reason: `falha ao ler o arquivo DOCX: ${err.message}` };
    }
    if (!resumeText || !resumeText.trim()) {
      return { extracted: false, reason: 'não foi possível extrair texto do arquivo DOCX' };
    }
    userMessageContent = buildTextMessage(resumeText);
  }

  async function callApi(content) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });
    const block = response.content && response.content[0];
    return block && block.type === 'text' ? block.text : '';
  }

  let parsed;
  try {
    let text = await callApi(userMessageContent);
    parsed = parseJsonFromText(text);

    if (!parsed) {
      const retryContent =
        typeof userMessageContent === 'string'
          ? userMessageContent +
            '\n\nSua resposta anterior não era JSON válido. Responda ESTRITAMENTE com um único objeto JSON válido, nada mais.'
          : [
              ...userMessageContent,
              {
                type: 'text',
                text: 'Sua resposta anterior não era JSON válido. Responda ESTRITAMENTE com um único objeto JSON válido, nada mais.',
              },
            ];
      text = await callApi(retryContent);
      parsed = parseJsonFromText(text);
    }

    if (!parsed) {
      return { extracted: false, reason: 'resposta não-JSON da API' };
    }
  } catch (err) {
    return { extracted: false, reason: `erro na API: ${err.message}` };
  }

  const validation = validateExtractionShape(parsed);
  if (!validation.ok) {
    return { extracted: false, reason: validation.reason };
  }

  // Garante um label não-vazio: usa o da IA, senão o 1º cargo/formação, senão genérico.
  if (typeof parsed.label !== 'string' || !parsed.label.trim()) {
    parsed.label =
      parsed.experience?.[0]?.role ||
      parsed.education?.[0]?.degree ||
      'Currículo';
  }

  return { extracted: true, content: parsed };
}
