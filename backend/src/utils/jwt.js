import jwt from 'jsonwebtoken';

const EXPIRES_IN = '7d';

export function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  return payload.sub;
}
