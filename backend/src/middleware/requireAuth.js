import { verifyToken } from '../utils/jwt.js';

/**
 * Middleware Express de autenticação JWT.
 * Lê o header Authorization (Bearer token), verifica o JWT e injeta `req.userId`.
 * Retorna 401 se o token estiver ausente, inválido ou expirado.
 *
 * @param {import('express').Request & { userId?: number|string }} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token de autenticação ausente' });
  }

  try {
    req.userId = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Token de autenticação inválido ou expirado' });
  }
}
