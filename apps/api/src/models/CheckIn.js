import mongoose from 'mongoose';
import { toJSON } from './toJSON.js';

const { Schema } = mongoose;
const score = { type: Number, required: true, min: 1, max: 5 };

// One post-ride check-in per ride (FUELING_RULES.md §9)
const checkInSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rideId: { type: Schema.Types.ObjectId, ref: 'Ride', required: true, unique: true },
    rideDate: { type: Date, required: true }, // copied from the ride, for ordering history and charts

    giScore: score, // stomach comfort: 1 bad – 5 perfect
    energyScore: score, // 1 empty – 5 strong all ride
    legsScore: score, // 1 heavy/dead legs – 5 sharp, feeling the bite
    bonked: { type: Boolean, default: false },
    cramped: { type: Boolean, default: false },
    notes: { type: String, trim: true },

    trainedGphAtCheckIn: { type: Number, required: true }, // the rider's trained rate when checking in (progress chart)
    suggestions: { type: Schema.Types.Mixed, required: true }, // fuel-core suggestAdjustments output
  },
  { timestamps: true, toJSON, minimize: false },
);

checkInSchema.index({ userId: 1, rideDate: -1 });

export const CheckIn = mongoose.model('CheckIn', checkInSchema, 'checkIns');
