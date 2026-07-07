import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `Você adapta currículos para vagas específicas. O candidato é um desenvolvedor JÚNIOR.
Regras:
1. NUNCA invente experiência, empresa, cargo, tecnologia ou data que não exista no currículo original.
2. Você PODE: reordenar itens, reescrever o resumo profissional pra destacar o que é relevante, reordenar/destacar habilidades já existentes, ajustar o tom (mais backend/mais IA/mais frontend) conforme a vaga pedir.
3. Toda informação factual (empresas, cargos, datas, formação) deve ficar IDÊNTICA ao original.
4. NÍVEL DE SENIORIDADE: o candidato é JÚNIOR e o CV deve sempre se apresentar como tal — nunca alegue ser pleno, sênior, lead ou especialista. Você DEVE, porém, espelhar o TOM e o vocabulário da vaga (ex: se a vaga valoriza "autonomia", "colaboração" ou uma stack específica, destaque essas qualidades reais do candidato) — sem jamais mentir sobre o nível.
5. Responda APENAS com JSON válido no schema fornecido, sem texto fora do JSON.`;

const OUTPUT_SCHEMA_DOC = `Schema JSON de saída esperado (responda APENAS com um único objeto JSON neste formato):
{
  "full_name": string (idêntico ao original),
  "contact": object (idêntico ao original),
  "summary": string (reescrito pra vaga, mas verdadeiro e nível júnior),
  "experience": [ { "company","role","location","start_date","end_date","bullets":[...] } ] (company/role/start_date/end_date IDÊNTICOS ao original; bullets podem ser reordenados/reescritos sem inventar),
  "education": array (idêntico ao original),
  "skills": object (mesmas skills, reordenadas por relevância),
  "match_score": number 0-100,
  "match_notes": string (1-2 frases em pt-BR, uso interno)
}`;

/**
 * Constrói a mensagem do usuário com os dados da vaga e o CV base completo.
 */
function buildUserMessage(job, cvBase) {
  const tags = Array.isArray(job.tags) ? job.tags.join(', ') : (job.tags || '');
  return `VAGA
Título: ${job.title || ''}
Empresa: ${job.company || ''}
Tags: ${tags}

Descrição completa da vaga:
${job.description || ''}

CURRÍCULO BASE (JSON completo do candidato):
${JSON.stringify(cvBase, null, 2)}

${OUTPUT_SCHEMA_DOC}`;
}

/**
 * Extrai um objeto JSON de forma robusta a partir do texto retornado pela API.
 * Trata cercas de código ```json e texto extra pegando do primeiro { ao último }.
 */
function parseJsonFromText(text) {
  if (typeof text !== 'string') return null;
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  const candidate = text.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/**
 * Valida que a adaptação não introduziu alucinações factuais.
 * Retorna { ok: true } ou { ok: false, reason: '...' }.
 */
function validateNoHallucination(adapted, cvBase) {
  const origExp = Array.isArray(cvBase.experience) ? cvBase.experience : [];
  const newExp = Array.isArray(adapted.experience) ? adapted.experience : [];

  // full_name idêntico
  if ((adapted.full_name || '').trim() !== (cvBase.full_name || '').trim()) {
    return { ok: false, reason: 'full_name divergente do original' };
  }

  // quantidade de experiências não pode aumentar
  if (newExp.length > origExp.length) {
    return {
      ok: false,
      reason: `quantidade de experiências aumentou (original: ${origExp.length}, adaptado: ${newExp.length})`,
    };
  }

  const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());

  // Cada experiência adaptada deve casar com o item correspondente do original (mesma empresa)
  for (const item of newExp) {
    const company = norm(item.company);
    const match = origExp.find((o) => norm(o.company) === company);
    if (!match) {
      return { ok: false, reason: `empresa não existe no original: "${company}"` };
    }
    if (norm(item.role) !== norm(match.role)) {
      return { ok: false, reason: `cargo alterado em "${company}"` };
    }
    if (norm(item.start_date) !== norm(match.start_date)) {
      return { ok: false, reason: `start_date alterado em "${company}"` };
    }
    if (norm(item.end_date) !== norm(match.end_date)) {
      return { ok: false, reason: `end_date alterado em "${company}"` };
    }
  }

  // education deve bater com o original
  if (JSON.stringify(adapted.education) !== JSON.stringify(cvBase.education)) {
    return { ok: false, reason: 'formação (education) divergente do original' };
  }

  return { ok: true };
}

/**
 * Adapta o CV base para uma vaga específica usando a API da Claude.
 *
 * @param {object} job - Linha da tabela jobs
 * @param {object} cvBase - Linha da tabela cv_base
 * @returns {Promise<object>} resultado da adaptação
 */
export async function adaptCv(job, cvBase) {
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  const baseUserMessage = buildUserMessage(job, cvBase);

  async function callApi(userMessage) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = response.content && response.content[0];
    return block && block.type === 'text' ? block.text : '';
  }

  let parsed;
  try {
    // Primeira tentativa
    let text = await callApi(baseUserMessage);
    parsed = parseJsonFromText(text);

    // Retry único com lembrete mais forte se o parse falhar
    if (!parsed) {
      const retryMessage =
        baseUserMessage +
        '\n\nSua resposta anterior não era JSON válido. Responda ESTRITAMENTE com um único objeto JSON válido, nada mais.';
      text = await callApi(retryMessage);
      parsed = parseJsonFromText(text);
    }

    if (!parsed) {
      return {
        adapted: false,
        reason: 'resposta não-JSON da API',
        content: cvBase,
        match_score: null,
        match_notes: null,
      };
    }
  } catch (err) {
    return {
      adapted: false,
      reason: `erro na API: ${err.message}`,
      content: cvBase,
      match_score: null,
      match_notes: null,
    };
  }

  // Validação anti-alucinação
  const validation = validateNoHallucination(parsed, cvBase);
  if (!validation.ok) {
    return {
      adapted: false,
      reason: `divergência factual detectada: ${validation.reason}`,
      content: cvBase,
      match_score: null,
      match_notes: null,
    };
  }

  const matchScore =
    typeof parsed.match_score === 'number' ? parsed.match_score : null;
  const matchNotes =
    typeof parsed.match_notes === 'string' ? parsed.match_notes : null;

  // Remove os campos match_* do conteúdo do CV adaptado
  const { match_score, match_notes, ...content } = parsed;

  return {
    adapted: true,
    content,
    match_score: matchScore,
    match_notes: matchNotes,
    model_used: MODEL,
  };
}
