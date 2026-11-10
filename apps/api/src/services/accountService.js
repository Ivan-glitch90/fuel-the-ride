import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ActionToken, CheckIn, Event, Food, Ride, Session, User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { createEmailSender, resetPasswordMessage, verifyEmailMessage } from './email.js';

const HOUR_MS = 60 * 60 * 1000;
const TTL = { 'verify-email': 24 * HOUR_MS, 'reset-password': HOUR_MS };
const PATHS = { 'verify-email': '/verify-email', 'reset-password': '/reset-password' };

const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const invalidLink = () => new HttpError(400, 'INVALID_TOKEN', 'This link is invalid or has expired. Ask for a new one.');

/**
 * Account basics: confirm email, forgot/reset password, delete account.
 * Email links point at PUBLIC_APP_URL, never at the request's Host header (outside production the
 * caller's origin is accepted as a fallback, so local dev works without configuration).
 */
export function createAccountService(config) {
  const sendEmail = createEmailSender(config);

  function appUrl(fallbackOrigin) {
    if (config.publicAppUrl) return config.publicAppUrl;
    if (!config.isProd && fallbackOrigin) return fallbackOrigin;
    throw new Error('PUBLIC_APP_URL must be set in production to build email links');
  }

  async function issueToken(userId, purpose) {
    const token = randomBytes(32).toString('base64url');
    await ActionToken.create({ userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TTL[purpose]) });
    return token;
  }

  /** Single-use: atomically marks the token used, so two clicks can't both succeed. */
  async function consumeToken(token, purpose) {
    if (!token) throw invalidLink();
    const record = await ActionToken.findOneAndUpdate(
      { tokenHash: hashToken(token), purpose, usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
    );
    if (!record) throw invalidLink();
    return record;
  }

  /**
   * Issues a token and emails the link. Never fails the caller's request: a missing PUBLIC_APP_URL
   * or a provider problem is logged, and the rider can ask again.
   */
  async function sendLink(user, purpose, origin, buildMessage) {
    try {
      const base = appUrl(origin);
      const token = await issueToken(user._id, purpose);
      const link = `${base}${PATHS[purpose]}?token=${token}`;
      await sendEmail({ to: user.email, ...buildMessage({ name: user.name, link, language: user.language }) });
    } catch (err) {
      if (!config.isTest) console.error(`[email] ${purpose} email not sent:`, err.message);
    }
  }

  async function sendVerification(user, origin) {
    if (user.emailVerifiedAt) return;
    await sendLink(user, 'verify-email', origin, verifyEmailMessage);
  }

  async function verifyEmail(token) {
    const record = await consumeToken(token, 'verify-email');
    const user = await User.findById(record.userId);
    if (!user) throw invalidLink();
    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      await user.save();
    }
    return user;
  }

  /** Always resolves the same way, whether or not the account exists (no account discovery). */
  async function forgotPassword(email, origin) {
    const user = await User.findOne({ email });
    // Only confirmed emails: otherwise a reset would hand an unproven address control of the account
    if (!user || !user.emailVerifiedAt) return;
    await sendLink(user, 'reset-password', origin, resetPasswordMessage);
  }

  /** Sets the new password, ends every session (all devices) and invalidates other reset links. */
  async function resetPassword(token, password) {
    const record = await consumeToken(token, 'reset-password');
    const user = await User.findById(record.userId);
    if (!user) throw invalidLink();
    user.passwordHash = await bcrypt.hash(password, config.bcryptCost);
    user.hasPassword = true;
    await user.save();
    await Session.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await ActionToken.updateMany({ userId: user._id, purpose: 'reset-password', usedAt: null }, { $set: { usedAt: new Date() } });
  }

  /**
   * Deletes the account and everything that belongs to it. Riders with a password must enter it
   * (a stolen session alone can't delete an account); everyone types DELETE.
   */
  async function deleteAccount(userId, { password }) {
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    if (user.passwordHash) {
      const ok = password ? await bcrypt.compare(password, user.passwordHash) : false;
      if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Password is incorrect');
    }
    await Promise.all([
      Food.deleteMany({ userId }),
      Ride.deleteMany({ userId }),
      CheckIn.deleteMany({ userId }),
      Event.deleteMany({ userId }),
      Session.deleteMany({ userId }),
      ActionToken.deleteMany({ userId }),
    ]);
    await user.deleteOne();
  }

  return { sendVerification, verifyEmail, forgotPassword, resetPassword, deleteAccount };
}
