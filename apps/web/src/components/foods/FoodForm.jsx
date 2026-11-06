import { useState } from 'react';
import { fieldErrors } from '../../api/client.js';
import { FLUID_TYPES, FOOD_TYPES } from '../../lib/foods.js';
import { isInvalidNumber, parseNumber, toInput } from '../../lib/forms.js';
import { displayToMl, fluidUnit, mlToDisplay } from '../../lib/units.js';
import { Button } from '../ui/Button.jsx';
import { Field, NumberField } from '../ui/Field.jsx';
import { Notice } from '../ui/Notice.jsx';
import { SegmentedControl } from '../ui/SegmentedControl.jsx';

function toFormValues(food, units) {
  return {
    name: food?.name ?? '',
    type: food?.type ?? 'gel',
    servingLabel: food?.servingLabel ?? '',
    carbsG: toInput(food?.carbsG),
    kcal: toInput(food?.kcal),
    sodiumMg: food?.sodiumMg ? toInput(food.sodiumMg) : '',
    fluidMl: food?.fluidMl ? toInput(mlToDisplay(food.fluidMl, units)) : '',
    caffeineMg: toInput(food?.caffeineMg),
    favorite: food?.favorite ?? false,
  };
}

/** Converts the form strings into an API body, or returns field errors. */
function toBody(values, units, isEdit) {
  const errors = {};
  const number = (key, { required = false } = {}) => {
    const value = parseNumber(values[key]);
    if (value === undefined && required) errors[key] = 'Required';
    else if (isInvalidNumber(value) || value < 0) errors[key] = 'Enter a number (0 or more)';
    return value;
  };

  const name = values.name.trim();
  if (!name) errors.name = 'Give it a name';
  const carbsG = number('carbsG', { required: true });
  const kcal = number('kcal', { required: true });
  const sodiumMg = number('sodiumMg');
  const caffeineMg = number('caffeineMg');
  const hasFluid = FLUID_TYPES.includes(values.type);
  const fluid = hasFluid ? number('fluidMl', { required: values.type === 'drink' }) : undefined;

  const body = {
    name,
    type: values.type,
    servingLabel: values.servingLabel.trim() || '1 serving',
    carbsG,
    kcal,
    sodiumMg: sodiumMg ?? 0,
    fluidMl: fluid === undefined ? 0 : displayToMl(fluid, units),
    favorite: values.favorite,
  };
  if (caffeineMg !== undefined) body.caffeineMg = caffeineMg;
  else if (isEdit) body.caffeineMg = null; // clears it

  return { body, errors };
}

/**
 * Create/edit form for one food. Fluid only shows for drinks and electrolytes.
 * Server validation errors (e.g. the fluid rule) appear under the matching field.
 */
export function FoodForm({ food, units, isEdit = false, onSubmit, submitting, serverError, submitLabel }) {
  const [values, setValues] = useState(() => toFormValues(food, units));
  const [clientErrors, setClientErrors] = useState({});
  const serverFieldErrors = fieldErrors(serverError);
  const errors = { ...serverFieldErrors, ...clientErrors };
  const showFluid = FLUID_TYPES.includes(values.type);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    const { body, errors: found } = toBody(values, units, isEdit);
    setClientErrors(found);
    if (Object.keys(found).length === 0) onSubmit(body);
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {serverError && Object.keys(serverFieldErrors).length === 0 && <Notice tone="error">{serverError.message}</Notice>}

      <Field label="Name" value={values.name} onChange={set('name')} error={errors.name} placeholder="e.g. Oat bar" />

      <SegmentedControl
        label="Type"
        options={FOOD_TYPES}
        value={values.type}
        onChange={(type) => setValues((v) => ({ ...v, type }))}
        error={errors.type}
      />

      <Field
        label="Serving"
        value={values.servingLabel}
        onChange={set('servingLabel')}
        error={errors.servingLabel}
        placeholder="1 serving"
        hint='What one serving is, e.g. "1 gel", "1 bar", "500 ml bottle"'
      />

      <div className="form__row">
        <NumberField label="Carbs" suffix="g" value={values.carbsG} onChange={set('carbsG')} error={errors.carbsG} />
        <NumberField label="Calories" suffix="kcal" value={values.kcal} onChange={set('kcal')} error={errors.kcal} />
      </div>

      <div className="form__row">
        <NumberField
          label="Sodium"
          suffix="mg"
          value={values.sodiumMg}
          onChange={set('sodiumMg')}
          error={errors.sodiumMg}
          placeholder="0"
        />
        {showFluid && (
          <NumberField
            label="Fluid"
            suffix={fluidUnit(units)}
            value={values.fluidMl}
            onChange={set('fluidMl')}
            error={errors.fluidMl}
            hint={values.type === 'drink' ? 'Required for drinks' : 'Leave empty for tabs or capsules'}
          />
        )}
      </div>

      <NumberField
        label="Caffeine (optional)"
        suffix="mg"
        value={values.caffeineMg}
        onChange={set('caffeineMg')}
        error={errors.caffeineMg}
      />

      <label className="checkbox">
        <input
          type="checkbox"
          checked={values.favorite}
          onChange={(e) => setValues((v) => ({ ...v, favorite: e.target.checked }))}
        />
        <span>Favorite (shown first)</span>
      </label>

      <Button type="submit" block loading={submitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
