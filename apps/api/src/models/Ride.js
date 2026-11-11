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
    // true: the app picks the foods from the library (FUELING_RULES.md §7.0); false: the rider's own picks
    foodsAuto: { type: Boolean, default: false },
    foodIds: [{ type: Schema.Types.ObjectId, ref: 'Food' }], // foods the plan uses, in preference order

    // Snapshot of fuel-core's buildFuelPlan output. Editing a food later doesn't change it.
    plan: { type: Schema.Types.Mixed, required: true },
    ftpAtRideW: Number, // the rider's FTP when the ride was planned: lets a later event scale "same effort" to today's FTP
    intensitySource: String,

    // What actually happened
    intake: { type: [intakeSchema], default: [] },
    plainWaterMl: { type: Number, default: 0 },
    // How long the ride really took (logged with what was eaten); null = as planned
    actualDurationMin: { type: Number, default: null },
    // fuel-core summarizeIntake output + { durationMin, targets } for that time; null until logged
    actual: { type: Schema.Types.Mixed, default: null },
    weightPreKg: Number,
    weightPostKg: Number,
    status: { type: String, enum: ['planned', 'completed'], default: 'planned' },
    // Hidden from ride lists (Home), still counted in progress; older rides have no field = not archived
    archived: { type: Boolean, default: false },
    // Set when the ride came from a .FIT/.GPX file (summary only; the file and GPS track stay on the device)
    imported: {
      type: new Schema(
        { source: String, startTime: Date, distanceKm: Number, elevationGainM: Number },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true, toJSON, minimize: false },
);

rideSchema.index({ userId: 1, date: -1 });
// One import per file: the same start time can't be imported twice by the same rider
rideSchema.index(
  { userId: 1, 'imported.startTime': 1 },
  { unique: true, partialFilterExpression: { 'imported.startTime': { $exists: true } } },
);

export const Ride = mongoose.model('Ride', rideSchema, 'rides');
