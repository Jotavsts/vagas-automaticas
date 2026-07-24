/**
 * Extrai um objeto JSON de forma robusta a partir do texto retornado pela API.
 * Trata cercas de código ```json e texto extra pegando do primeiro { ao último }.
 *
 * @param {string} text - Texto bruto retornado pelo modelo
 * @returns {object|null} Objeto JSON parseado, ou null se falhar
 */
export function parseJsonFromText(text) {
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
