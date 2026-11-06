import mongoose from 'mongoose';
import { constants } from '@fuel-ride/fuel-core';
import { toJSON } from './toJSON.js';

const { Schema } = mongoose;

// Last time's data for the same or a similar event (FUELING_RULES.md §9A)
const pastSchema = new Schema(
  {
    rideId: { type: Schema.Types.ObjectId, ref: 'Ride' }, // set when filled from a logged ride
    durationMin: { type: Number, required: true },
    intensity: {
      type: new Schema({ workKj: Number, avgPowerW: Number, normalizedPowerW: Number, avgHr: Number }, { _id: false }),
      required: true,
    },
    ftpAtTimeW: Number,
    carbsGphEaten: Number,
    giScore: Number,
    energyScore: Number,
    bonked: Boolean,
  },
  { _id: false },
);

/**
 * An upcoming race or group ride. Only the inputs are stored: the forecast (projected effort,
 * gut-training build-up, race-day plan) is computed on every read, so it always uses today's
 * FTP and trained carb rate.
 */
const eventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: constants.EVENT_TYPES, required: true },
    date: { type: Date, required: true },
    durationMin: Number, // expected; empty = same as last time
    indoor: { type: Boolean, default: false },
    tempC: Number,
    carbGoalGph: Number, // rider override of the suggested race-day goal
    foodIds: [{ type: Schema.Types.ObjectId, ref: 'Food' }],
    past: { type: pastSchema, required: true },
  },
  { timestamps: true, toJSON },
);

eventSchema.index({ userId: 1, date: 1 });

export const Event = mongoose.model('Event', eventSchema, 'events');
