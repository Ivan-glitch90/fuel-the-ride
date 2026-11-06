import { fluidUnit, mlToDisplay } from './units.js';

export const FOOD_TYPES = [
  { value: 'gel', label: 'Gel' },
  { value: 'bar', label: 'Bar' },
  { value: 'drink', label: 'Drink' },
  { value: 'electrolyte', label: 'Electrolyte' },
  { value: 'real', label: 'Real food' },
];

/** Types that can have a fluid amount (a drink must; an electrolyte mix may). */
export const FLUID_TYPES = ['drink', 'electrolyte'];

export const foodTypeLabel = (type) => FOOD_TYPES.find((t) => t.value === type)?.label ?? type;

/** "44 g carbs · 250 kcal · 150 mg sodium · 500 ml" */
export function foodSummary(food, units) {
  const parts = [`${food.carbsG} g carbs`, `${food.kcal} kcal`];
  if (food.sodiumMg) parts.push(`${food.sodiumMg} mg sodium`);
  if (food.fluidMl) parts.push(`${mlToDisplay(food.fluidMl, units)} ${fluidUnit(units)}`);
  if (food.caffeineMg) parts.push(`${food.caffeineMg} mg caffeine`);
  return parts.join(' · ');
}
