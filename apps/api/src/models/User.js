import mongoose from 'mongoose';
import { constants } from '@fuel-ride/fuel-core';
import { toJSON } from './toJSON.js';

export const SEXES = ['male', 'female', 'unspecified'];
export const UNIT_SYSTEMS = ['metric', 'imperial'];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Riders sign in with a password, with Google, or (later) both
    passwordHash: {
      type: String,
      select: false,
      required() {
        return !this.googleId;
      },
    },
    googleId: { type: String, unique: true, sparse: true }, // Google's stable user id ("sub")
    hasPassword: Boolean, // false for Google-only riders (they confirm account deletion without a password)
    emailVerifiedAt: { type: Date, default: null }, // set by the confirmation link, or by Google
    name: { type: String, required: true, trim: true },

    // Body + physiology (all optional until the rider completes their profile)
    weightKg: Number,
    birthYear: Number,
    sex: { type: String, enum: SEXES, default: 'unspecified' },
    ftpW: Number,
    maxHr: Number,
    lthr: Number,
    restingHr: Number,

    // Fueling settings
    trainedCarbRateGph: { type: Number, default: constants.DEFAULT_TRAINED_CARB_RATE_GPH },
    lastCarbRateIncreaseAt: Date, // for the 7-day gut-training limit
    sweatRateMlPerHr: Number,
    sweatSodium: { type: String, enum: constants.SWEAT_SODIUM_LEVELS, default: constants.DEFAULT_SWEAT_SODIUM },
    units: { type: String, enum: UNIT_SYSTEMS, default: 'metric' },
  },
  {
    timestamps: true,
    toJSON: {
      ...toJSON,
      transform(doc, ret) {
        toJSON.transform(doc, ret);
        ret.hasPassword = ret.hasPassword ?? !doc.googleId; // accounts created before this field: password unless Google
        ret.emailVerified = Boolean(ret.emailVerifiedAt);
        return ret;
      },
    },
  },
);

export const User = mongoose.model('User', userSchema, 'users');
