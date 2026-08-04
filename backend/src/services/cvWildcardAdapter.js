import { parseJsonFromText } from '../utils/jsonExtract.js';
import { validateNoHallucination } from './cvAdapter.js';
import { generateText } from './aiClient.js';

const SYSTEM_PROMPT = `Você adapta currículos para que fiquem otimizados de forma AMPLA para múltiplas vagas dentro de uma área de atuação. O candidato é um desenvolvedor JÚNIOR.

O currículo tem um CORPO PADRÃO (estrutura fixa) — você NUNCA muda a estrutura, só o CONTEÚDO dentro dela.
Isso significa: "education" é e continua sendo um ARRAY (lista), mesmo que tenha 1 item só — nunca vire um objeto solto. "experience" é e continua sendo um ARRAY de objetos, na mesma quantidade de itens do original. "contact" é e continua sendo um OBJETO com as mesmas chaves. "skills" é e continua sendo um OBJETO com as mesmas categorias (languages, ai, cloud, tools). Nunca adicione, remova ou troque o tipo de nenhum campo do schema — copie a estrutura exatamente e só altere o texto/ordem dentro dela.

Regras:
1. NUNCA invente experiência, empresa, cargo, tecnologia ou data que não exista no currículo original.
2. Você PODE: reordenar itens, reescrever o resumo profissional de forma mais abrangente para a área indicada, reordenar/destacar habilidades já existentes conforme as palavras-chave fornecidas, ajustar o tom para ser polivalente.
3. Toda informação factual (empresas, cargos, datas, formação) deve ficar IDÊNTICA ao original, inclusive o TIPO de dado (array continua array, objeto continua objeto).
4. NÍVEL DE SENIORIDADE: o candidato é JÚNIOR e o CV deve sempre se apresentar como tal — nunca alegue ser pleno, sênior, lead ou especialista.
5. O OBJETIVO é gerar um CV "coringa" — genérico o suficiente para funcionar bem em diversas vagas da área, mas específico o bastante para não parecer raso. Destaque versatilidade e disposição para aprender.
6. O resumo profissional deve ser escrito de forma ampla, mencionando as principais competências do candidato e sua área de interesse, sem focar em uma vaga específica.
7. Responda APENAS com JSON válido no schema fornecido, sem texto fora do JSON.`;

const OUTPUT_SCHEMA_DOC = `Schema JSON de saída esperado (responda APENAS com um único objeto JSON neste formato):
{
  "full_name": string (idêntico ao original),
  "title": string|null (idêntico ao original, nunca reescreva),
  "contact": object (idêntico ao original),
  "summary": string (reescrito de forma abrangente para a área, mas verdadeiro e nível júnior),
  "experience": [ { "company","role","location","start_date","end_date","bullets":[...] } ] (company/role/start_date/end_date IDÊNTICOS ao original; bullets podem ser reordenados/reescritos sem inventar),
  "education": [ { ... } ] (SEMPRE um array/lista de objetos, copie exatamente os mesmos objetos do CURRÍCULO BASE abaixo, na mesma quantidade — NUNCA transforme em um objeto solto),
  "skills": object (mesmas skills, reordenadas por relevância para a área),
  "projects": array (idêntico ao original, copie exatamente — nunca reescreva ou reordene os projetos),
  "languages": array (idêntico ao original, copie exatamente)
}`;

/**
 * Constrói a mensagem do usuário com as keywords/área e o CV base completo.
 *
 * @param {string[]} keywords - Palavras-chave de interesse do usuário
 * @param {string} areaLabel - Rótulo do CV base (ex: "Desenvolvimento Backend")
 * @param {object} cvBase - Dados completos do CV base
 * @returns {string}
 */
function buildUserMessage(keywords, areaLabel, cvBase) {
  return `PERFIL DE INTERESSE DO CANDIDATO
Área de atuação: ${areaLabel || 'Tecnologia'}
Palavras-chave de interesse: ${keywords.length > 0 ? keywords.join(', ') : 'não informadas'}

O candidato busca oportunidades diversas dentro dessa área. Adapte o currículo para ser competitivo em MÚLTIPLAS vagas desse perfil, sem focar em uma vaga específica.

CURRÍCULO BASE (JSON completo do candidato):
${JSON.stringify(cvBase, null, 2)}

${OUTPUT_SCHEMA_DOC}`;
}

/**
 * Adapta o CV base de forma genérica para múltiplas vagas da área do usuário.
 *
 * @param {object} cvBase - Linha da tabela cv_base
 * @param {string[]} keywords - Palavras-chave de interesse do usuário
 * @returns {Promise<object>} resultado da adaptação
 */
export async function adaptWildcard(cvBase, keywords) {
  const areaLabel = cvBase.label || '';
  const baseUserMessage = buildUserMessage(keywords, areaLabel, cvBase);
  let modelUsed;

  async function callApi(userMessage) {
    const { text, provider, model } = await generateText({ system: SYSTEM_PROMPT, prompt: userMessage, maxTokens: 4096 });
    modelUsed = `${provider}:${model}`;
    return text;
  }

  let parsed;
  try {
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
      };
    }
  } catch (err) {
    return {
      adapted: false,
      reason: `erro na API: ${err.message}`,
      content: cvBase,
    };
  }

  // Validação anti-alucinação (mesma do adaptador por vaga)
  const validation = validateNoHallucination(parsed, cvBase);
  if (!validation.ok) {
    return {
      adapted: false,
      reason: `divergência factual detectada: ${validation.reason}`,
      content: cvBase,
    };
  }

  return {
    adapted: true,
    content: parsed,
    model_used: modelUsed,
  };
}
