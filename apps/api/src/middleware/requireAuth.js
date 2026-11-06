import { HttpError } from '../utils/httpError.js';
import { ACCESS_COOKIE, verifyAccessToken } from '../services/tokens.js';

/**
 * Accepts the access token from the httpOnly cookie (web) or an
 * `Authorization: Bearer` header (mobile). Sets req.user = { id }.
 */
export const requireAuth = (config) => (req, _res, next) => {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.[ACCESS_COOKIE];
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in');
  const payload = verifyAccessToken(config, token);
  req.user = { id: payload.sub };
  next();
};
