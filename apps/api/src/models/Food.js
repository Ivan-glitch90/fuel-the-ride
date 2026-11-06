import mongoose from 'mongoose';
import { constants } from '@fuel-ride/fuel-core';
import { toJSON } from './toJSON.js';

// One item in a rider's food library. Field names match what fuel-core's buildFuelPlan expects.
const foodSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: constants.FOOD_TYPES, required: true },
    servingLabel: { type: String, required: true, trim: true, default: '1 serving' },
    carbsG: { type: Number, required: true, min: 0 },
    kcal: { type: Number, required: true, min: 0 },
    sodiumMg: { type: Number, default: 0, min: 0 },
    fluidMl: { type: Number, default: 0, min: 0 }, // > 0 makes it a drink in the schedule
    caffeineMg: { type: Number, min: 0 },
    favorite: { type: Boolean, default: false },
    archived: { type: Boolean, default: false }, // kept for past rides instead of deleting
  },
  { timestamps: true, toJSON },
);

foodSchema.index({ userId: 1, archived: 1, favorite: -1, name: 1 });

export const Food = mongoose.model('Food', foodSchema, 'foodLibrary');
