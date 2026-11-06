import mongoose from 'mongoose';

// One document per refresh token. Rotation revokes the old one; reusing a
// revoked token revokes every session for that user (stolen-token defence).
const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jti: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    userAgent: String,
  },
  { timestamps: true },
);

// MongoDB deletes sessions automatically once they expire
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model('Session', sessionSchema, 'sessions');
