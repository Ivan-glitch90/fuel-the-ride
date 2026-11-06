import mongoose from 'mongoose';
import { constants } from '@fuel-ride/fuel-core';
import { toJSON } from './toJSON.js';

const { Schema } = mongoose;

const intensitySchema = new Schema(
  {
    workKj: Number,
    avgPowerW: Number,
    normalizedPowerW: Number,
    avgHr: Number,
    powerZone: Number,
    hrZone: Number,
  },
  { _id: false },
);

const intakeSchema = new Schema(
  {
    foodId: { type: Schema.Types.ObjectId, ref: 'Food', required: true },
    servings: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const rideSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, trim: true },
    date: { type: Date, required: true },

    // Plan inputs
    durationMin: { type: Number, required: true },
    intensity: { type: intensitySchema, required: true },
    tempC: Number,
    indoor: { type: Boolean, default: false }, // trainer / Zwift: more fluid (FUELING_RULES.md §5.1)
    rideType: { type: String, enum: constants.RIDE_TYPES, default: 'training' }, // §4.1
    foodIds: [{ type: Schema.Types.ObjectId, ref: 'Food' }], // foods the rider will carry, in the order picked

    // Snapshot of fuel-core's buildFuelPlan output. Editing a food later doesn't change it.
    plan: { type: Schema.Types.Mixed, required: true },
    ftpAtRideW: Number, // the rider's FTP when the ride was planned: lets a later event scale "same effort" to today's FTP
    intensitySource: String,

    // What actually happened
    intake: { type: [intakeSchema], default: [] },
    plainWaterMl: { type: Number, default: 0 },
    actual: { type: Schema.Types.Mixed, default: null }, // fuel-core summarizeIntake output, null until something is logged
    weightPreKg: Number,
    weightPostKg: Number,
    status: { type: String, enum: ['planned', 'completed'], default: 'planned' },
  },
  { timestamps: true, toJSON, minimize: false },
);

rideSchema.index({ userId: 1, date: -1 });

export const Ride = mongoose.model('Ride', rideSchema, 'rides');
