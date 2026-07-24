/**
 * Converte uma string qualquer em slug URL-safe (minúsculo, sem acentos, separado por hífens).
 * Limitado a 60 caracteres para uso em nomes de arquivo e URLs.
 *
 * @param {string|any} value - Valor a converter
 * @returns {string} Slug normalizado
 */
export function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
