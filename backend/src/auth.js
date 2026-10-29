import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as users from './users.js';

const secret = () => {
  if (!process.env.JWT_SECRET) {
    const err = new Error('JWT_SECRET is not set on the server');
    err.status = 500;
    throw err;
  }
  return process.env.JWT_SECRET;
};

export const hashPassword = (password) => bcrypt.hash(password, 10);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

export const signToken = (user) =>
  jwt.sign({ sub: user.id }, secret(), { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });

const unauthorized = (res) => res.status(401).json({ error: 'Authentication required' });

// Sets req.user = { id, role, ... }. The user is re-read so deleted users lose access.
export async function requireAuth(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) return unauthorized(res);
    let payload;
    try { payload = jwt.verify(token, secret()); } catch (e) {
      if (e.status) throw e;
      return unauthorized(res);
    }
    const user = await users.findById(payload.sub);
    if (!user) return unauthorized(res);
    req.user = user;
    next();
  } catch (e) { next(e); }
}
