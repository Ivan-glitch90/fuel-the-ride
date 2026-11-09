import mongoose from 'mongoose';

/**
 * One-time tokens sent by email (confirm account, reset password).
 * Only a SHA-256 hash is stored: a database leak can't be turned into working links.
 */
const actionTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: ['verify-email', 'reset-password'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

actionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB deletes expired tokens

export const ActionToken = mongoose.model('ActionToken', actionTokenSchema, 'actionTokens');
