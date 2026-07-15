import Anthropic from '@anthropic-ai/sdk';
import { parseJsonFromText } from '../utils/jsonExtract.js';
import { slugify } from '../utils/slugify.js';
import { pool } from '../utils/db.js';

const MODEL = 'claude-haiku-4-5';

// Categorias do Remotar cujo id numérico (?c=N) foi CONFIRMADO ao vivo (ver
// CLAUDE.md e remotar.js). O site tem ~21 categorias no total, mas só essas
// 6 tiveram o id verificado por inspeção real — os demais nomes de categoria
// existem na UI, porém sem id confirmado não entram aqui, pra evitar que o
// resolver aponte pra um número que na real é outra categoria (nunca
// verificado, então nunca inventado). Se quiser ampliar a cobertura no
// Remotar, confirme o id clicando o filtro no site e lendo o "?c=" da URL
// resultante antes de adicionar aqui.
const REMOTAR_CATEGORIES = [
  { id: 4, name: 'Data Science / Analytics' },
  { id: 7, name: 'DevOps' },
  { id: 8, name: 'QA' },
  { id: 9, name: 'SysAdmin' },
  { id: 13, name: 'Programação' },
  { id: 14, name: 'Programação Mobile' },
];
const REMOTAR_VALID_IDS = new Set(REMOTAR_CATEGORIES.map((c) => c.id));

const SYSTEM_PROMPT = `Você mapeia a área de um currículo pra parâmetros de busca de vagas em fontes de coleta.

Regras:
1. Primeiro verifique se a área do currículo já é coberta por alguma das áreas ATIVAS informadas (mesmo que o texto seja diferente, ex: "Veterinária" e "Medicina Veterinária" são a mesma área). Se sim, responda com matched_area_id apontando pro id existente e ignore os outros campos.
2. Se for uma área genuinamente nova, proponha:
   - vagascombr_slug: um slug curto em português sem acento, no formato usado em vagas.com.br/vagas-de-{slug} (ex: "veterinaria", "enfermagem", "atendimento").
   - remotar_category_ids: escolha SOMENTE ids da lista de categorias do Remotar fornecida, que sejam um match plausível. O Remotar é um board 100% remoto — se a área é uma profissão presencial por natureza (ex: veterinária clínica, saúde presencial, trabalho de loja física), responda [] (lista vazia), NUNCA force um id que não faça sentido.
   - solides_query: um termo de busca curto em português pra essa área (ex: "veterinário", "enfermeiro").
3. Nunca invente um id de categoria do Remotar que não esteja na lista fornecida.
4. Responda APENAS com um único objeto JSON válido, sem texto fora do JSON.`;

function buildUserMessage(cvLabel, activeAreas) {
  const areasList = activeAreas
    .map((a) => `- id ${a.id} | "${a.label}" | slug: ${a.vagascombr_slug} | remotar: [${(a.remotar_category_ids || []).join(', ')}]`)
    .join('\n');
  const categoriesList = REMOTAR_CATEGORIES.map((c) => `${c.id}=${c.name}`).join(', ');

  return `LABEL DO CURRÍCULO: ${cvLabel}

ÁREAS JÁ ATIVAS:
${areasList || '(nenhuma)'}

CATEGORIAS DISPONÍVEIS NO REMOTAR: ${categoriesList}

Responda com JSON no formato: { "matched_area_id": number|null, "vagascombr_slug": string, "remotar_category_ids": [number], "solides_query": string, "reason": string }`;
}

/**
 * Fallback determinístico usado quando a chamada à IA falha — nunca inventa
 * categoria do Remotar, só derruba pro slug bruto do label.
 */
function fallbackResolution(cvLabel) {
  return {
    matched_area_id: null,
    vagascombr_slug: slugify(cvLabel),
    remotar_category_ids: [],
    solides_query: String(cvLabel || '').toLowerCase().trim(),
  };
}

/**
 * Resolve o label de um currículo pra parâmetros de busca por fonte, ou
 * pro id de uma área já ativa que já cobre essa área.
 *
 * @param {string} cvLabel
 * @param {Array<{id:number, label:string, vagascombr_slug:string, remotar_category_ids:number[]}>} activeAreas
 * @returns {Promise<{matched_area_id: number|null, vagascombr_slug: string, remotar_category_ids: number[], solides_query: string}>}
 */
export async function resolveJobArea(cvLabel, activeAreas) {
  if (!cvLabel || !String(cvLabel).trim()) {
    return fallbackResolution(cvLabel);
  }

  const validAreaIds = new Set(activeAreas.map((a) => a.id));

  try {
    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(cvLabel, activeAreas) }],
    });
    const block = response.content && response.content[0];
    const text = block && block.type === 'text' ? block.text : '';
    const parsed = parseJsonFromText(text);

    if (!parsed) return fallbackResolution(cvLabel);

    if (parsed.matched_area_id !== null && parsed.matched_area_id !== undefined) {
      if (validAreaIds.has(parsed.matched_area_id)) {
        return { matched_area_id: parsed.matched_area_id, vagascombr_slug: null, remotar_category_ids: [], solides_query: '' };
      }
      // id inventado fora da lista — trata como "não achou" em vez de confiar cegamente
    }

    const remotarIds = Array.isArray(parsed.remotar_category_ids)
      ? parsed.remotar_category_ids.filter((id) => REMOTAR_VALID_IDS.has(id))
      : [];

    return {
      matched_area_id: null,
      vagascombr_slug: slugify(parsed.vagascombr_slug) || slugify(cvLabel),
      remotar_category_ids: remotarIds,
      solides_query: typeof parsed.solides_query === 'string' ? parsed.solides_query.trim() : String(cvLabel).toLowerCase().trim(),
    };
  } catch (err) {
    console.error(`[jobAreaResolver] falha ao resolver área "${cvLabel}" (fallback):`, err.message);
    return fallbackResolution(cvLabel);
  }
}

/**
 * Garante que exista uma área ativa cobrindo o label de um currículo —
 * ou casa com uma área já existente, ou insere uma nova. Best-effort: nunca
 * lança, e quem chama deve tratar isso como fire-and-forget (não bloqueia
 * cadastro/upload de CV, só afeta a partir do próximo ciclo de coleta).
 *
 * @param {string} cvLabel
 * @param {number} userId
 * @returns {Promise<{created: boolean, areaId: number|null}>}
 */
export async function ensureAreaForLabel(cvLabel, userId) {
  const { rows: activeAreas } = await pool.query(
    'SELECT id, label, vagascombr_slug, remotar_category_ids FROM active_job_areas WHERE active = true ORDER BY id'
  );

  const resolved = await resolveJobArea(cvLabel, activeAreas);

  if (resolved.matched_area_id) {
    return { created: false, areaId: resolved.matched_area_id };
  }

  const insert = await pool.query(
    `INSERT INTO active_job_areas (label, vagascombr_slug, remotar_category_ids, solides_query, source_label, created_by_user_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (vagascombr_slug) DO NOTHING
     RETURNING id`,
    [cvLabel, resolved.vagascombr_slug, resolved.remotar_category_ids, resolved.solides_query, cvLabel, userId]
  );

  if (insert.rows.length > 0) {
    return { created: true, areaId: insert.rows[0].id };
  }

  // Conflito de slug (corrida ou área equivalente já inserida por outro usuário nesse meio-tempo)
  const existing = await pool.query('SELECT id FROM active_job_areas WHERE vagascombr_slug = $1', [
    resolved.vagascombr_slug,
  ]);
  return { created: false, areaId: existing.rows[0]?.id ?? null };
}
