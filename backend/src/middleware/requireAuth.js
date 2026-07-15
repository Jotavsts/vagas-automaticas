import { verifyToken } from '../utils/jwt.js';

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
