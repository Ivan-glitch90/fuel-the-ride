import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { User, Session } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { createGoogleVerifier } from './google.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './tokens.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function createAuthService(config) {
  // Compared against when the email doesn't exist, so login takes the same time either way
  const dummyHash = bcrypt.hashSync('timing-safe-dummy-password', config.bcryptCost);
  // Tests pass a fake verifier through config; otherwise verify with Google for real
  const verifyGoogleIdToken = config.verifyGoogleIdToken ?? createGoogleVerifier(config.googleClientIds);

  async function issueSession(userId, { userAgent } = {}) {
    const jti = randomUUID();
    await Session.create({
      userId,
      jti,
      expiresAt: new Date(Date.now() + config.refreshTokenTtlDays * DAY_MS),
      userAgent: userAgent?.slice(0, 200),
    });
    return {
      accessToken: signAccessToken(config, userId),
      refreshToken: signRefreshToken(config, userId, jti),
    };
  }

  async function register({ email, password, name }, meta) {
    if (await User.exists({ email })) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'An account with that email already exists');
    }
    const passwordHash = await bcrypt.hash(password, config.bcryptCost);
    const user = await User.create({ email, passwordHash, name });
    return { user, tokens: await issueSession(user._id, meta) };
  }

  async function login({ email, password }, meta) {
    const user = await User.findOne({ email }).select('+passwordHash');
    const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
    if (!user || !ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    return { user, tokens: await issueSession(user._id, meta) };
  }

  /**
   * Sign in (or sign up) with a Google ID token.
   * An email that already has a password account is NOT merged automatically: emails aren't verified
   * at signup, so someone could pre-register a victim's address and wait for them to use Google.
   */
  async function loginWithGoogle(credential, meta) {
    if (!verifyGoogleIdToken) throw new HttpError(404, 'GOOGLE_DISABLED', 'Google sign-in is not available');

    let payload;
    try {
      payload = await verifyGoogleIdToken(credential);
    } catch {
      throw new HttpError(401, 'INVALID_GOOGLE_TOKEN', 'Google sign-in failed. Please try again.');
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new HttpError(401, 'GOOGLE_EMAIL_UNVERIFIED', 'Your Google account email is not verified');
    }

    let user = await User.findOne({ googleId: payload.sub });
    let created = false;
    if (!user) {
      const email = payload.email.toLowerCase();
      if (await User.exists({ email })) {
        throw new HttpError(
          409,
          'EMAIL_REGISTERED_WITH_PASSWORD',
          'An account with this email already exists. Log in with your email and password.',
        );
      }
      user = await User.create({ email, googleId: payload.sub, name: payload.name?.trim() || email.split('@')[0] });
      created = true;
    }
    return { user, created, tokens: await issueSession(user._id, meta) };
  }

  async function refresh(refreshToken, meta) {
    if (!refreshToken) throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Please log in again');
    const payload = verifyRefreshToken(config, refreshToken);

    // Atomically revoke the presented token so it can only be used once
    const session = await Session.findOneAndUpdate(
      { jti: payload.jti, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    if (!session) {
      const known = await Session.exists({ jti: payload.jti });
      if (known) {
        // A revoked token was reused: assume it was stolen and end every session for this user
        await Session.updateMany({ userId: payload.sub, revokedAt: null }, { $set: { revokedAt: new Date() } });
        throw new HttpError(401, 'REFRESH_TOKEN_REUSED', 'Please log in again');
      }
      throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Please log in again');
    }
    return issueSession(session.userId, meta);
  }

  async function logout(refreshToken) {
    if (!refreshToken) return;
    try {
      const payload = verifyRefreshToken(config, refreshToken);
      await Session.updateOne({ jti: payload.jti, revokedAt: null }, { $set: { revokedAt: new Date() } });
    } catch {
      // Invalid or expired token: nothing to revoke, logout still succeeds
    }
  }

  return { register, login, loginWithGoogle, refresh, logout, googleEnabled: Boolean(verifyGoogleIdToken) };
}
