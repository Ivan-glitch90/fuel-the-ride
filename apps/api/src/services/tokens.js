import jwt from 'jsonwebtoken';
import { HttpError } from '../utils/httpError.js';

const ALGORITHM = 'HS256';

export const ACCESS_COOKIE = 'ftr_access';
export const REFRESH_COOKIE = 'ftr_refresh';

export function signAccessToken(config, userId) {
  return jwt.sign({ typ: 'access' }, config.jwtSecret, {
    subject: String(userId),
    expiresIn: config.accessTokenTtlSec,
    algorithm: ALGORITHM,
  });
}

export function signRefreshToken(config, userId, jti) {
  return jwt.sign({ typ: 'refresh' }, config.jwtRefreshSecret, {
    subject: String(userId),
    jwtid: jti,
    expiresIn: config.refreshTokenTtlDays * 24 * 60 * 60,
    algorithm: ALGORITHM,
  });
}

function verify(token, secret, typ, errorCode) {
  try {
    const payload = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
    if (payload.typ !== typ) throw new Error('wrong token type');
    return payload;
  } catch {
    throw new HttpError(401, errorCode, 'Please log in again');
  }
}

export const verifyAccessToken = (config, token) => verify(token, config.jwtSecret, 'access', 'UNAUTHENTICATED');
export const verifyRefreshToken = (config, token) =>
  verify(token, config.jwtRefreshSecret, 'refresh', 'INVALID_REFRESH_TOKEN');
