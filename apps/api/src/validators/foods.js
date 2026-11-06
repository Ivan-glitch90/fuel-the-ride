import { z } from 'zod';
import { constants } from '@fuel-ride/fuel-core';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParams = z.object({ id: objectId });

const SOLID_TYPES = ['gel', 'bar', 'real'];

/**
 * Fluid rule: a drink must have a fluid amount; gels, bars and real food can't.
 * Electrolytes may be either (a drink mix has fluid, a salt tab doesn't).
 * Returns validation issues in the API's { path, message } shape.
 */
export function fluidRuleIssues({ type, fluidMl = 0 }) {
  if (type === 'drink' && !(fluidMl > 0)) {
    return [{ path: 'fluidMl', message: 'Drinks need a fluid amount in ml (e.g. 500 for a bottle)' }];
  }
  if (SOLID_TYPES.includes(type) && fluidMl > 0) {
    return [{ path: 'fluidMl', message: 'Only drinks and electrolytes can have a fluid amount' }];
  }
  return [];
}

const fields = {
  name: z.string().trim().min(1).max(80),
  type: z.enum(constants.FOOD_TYPES),
  servingLabel: z.string().trim().min(1).max(40),
  carbsG: z.number().min(0).max(200),
  kcal: z.number().min(0).max(2000),
  sodiumMg: z.number().min(0).max(5000),
  fluidMl: z.number().min(0).max(2000),
  caffeineMg: z.number().min(0).max(500),
  favorite: z.boolean(),
};

const addFluidIssues = (food, ctx) => {
  for (const issue of fluidRuleIssues(food)) ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
};

export const createFoodBody = z
  .strictObject({
    ...fields,
    servingLabel: fields.servingLabel.default('1 serving'),
    sodiumMg: fields.sodiumMg.default(0),
    fluidMl: fields.fluidMl.default(0),
    caffeineMg: fields.caffeineMg.optional(),
    favorite: fields.favorite.default(false),
  })
  .superRefine(addFluidIssues);

// The fluid rule is checked in the service after merging with the stored food
export const updateFoodBody = z
  .strictObject({ ...fields, caffeineMg: fields.caffeineMg.nullable(), archived: z.boolean() })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Provide at least one field to update');

export const listFoodsQuery = z.object({
  archived: z.enum(['false', 'true', 'all']).default('false'),
  favorite: z.enum(['true', 'false']).optional(),
});
