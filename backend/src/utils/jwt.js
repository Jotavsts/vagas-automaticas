import jwt from 'jsonwebtoken';

const EXPIRES_IN = '7d';

/**
 * Gera um token JWT assinado para o userId fornecido.
 *
 * @param {number|string} userId - ID do usuário (salvo como `sub` no payload)
 * @returns {string} Token JWT com validade de 7 dias
 */
export function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: EXPIRES_IN });
}

/**
 * Verifica e decodifica um token JWT, retornando o userId.
 * Lança exceção se o token for inválido ou expirado.
 *
 * @param {string} token
 * @returns {number|string} userId extraído do campo `sub`
 */
export function verifyToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  return payload.sub;
}
