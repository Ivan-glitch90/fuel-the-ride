import { useState } from 'react';
import { formatServings } from '../../lib/format.js';
import { isInvalidNumber, parseNumber, toInput } from '../../lib/forms.js';
import { displayToKg, displayToMl, fluidUnit, formatFluid, kgToDisplay, mlToDisplay, weightUnit } from '../../lib/units.js';
import { Button } from '../ui/Button.jsx';
import { NumberField } from '../ui/Field.jsx';
import { Notice } from '../ui/Notice.jsx';

const STEP = 0.5; // half a bar, half a bottle

/** Total servings of each food across the planned schedule. */
function plannedServings(plan) {
  const totals = {};
  for (const block of plan.schedule) {
    for (const item of block.items) totals[item.foodId] = (totals[item.foodId] ?? 0) + item.servings;
  }
  return totals;
}

function initialServings(ride) {
  return Object.fromEntries((ride.intake ?? []).map((i) => [i.foodId, i.servings]));
}

/**
 * "What you ate": servings per food (− / +), plain water, and optional weigh-ins for sweat rate.
 * Saving marks the ride completed; the API returns the actual per-hour totals.
 */
export function IntakeLogger({ ride, foods, units, onSave, saving, error }) {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const planned = plannedServings(ride.plan);
  const plannedWater = ride.plan.schedule.reduce((sum, b) => sum + b.plainWaterMl, 0);

  const [servings, setServings] = useState(() => initialServings(ride));
  const [extraIds, setExtraIds] = useState([]);
  const [water, setWater] = useState(() => (ride.plainWaterMl ? toInput(mlToDisplay(ride.plainWaterMl, units)) : ''));
  const [weightPre, setWeightPre] = useState(() => toInput(ride.weightPreKg && kgToDisplay(ride.weightPreKg, units)));
  const [weightPost, setWeightPost] = useState(() => toInput(ride.weightPostKg && kgToDisplay(ride.weightPostKg, units)));
  const [errors, setErrors] = useState({});

  // Planned foods first (in the plan's order), then anything logged or added
  const rowIds = [
    ...new Set([...(ride.foodIds ?? []), ...Object.keys(planned), ...Object.keys(initialServings(ride)), ...extraIds]),
  ].filter((id) => byId.has(id));
  const addable = foods.filter((f) => !rowIds.includes(f.id) && !f.archived);

  const change = (id, delta) =>
    setServings((s) => ({ ...s, [id]: Math.max(0, Math.round(((s[id] ?? 0) + delta) / STEP) * STEP) }));

  function fillAsPlanned() {
    setServings(planned);
    setWater(plannedWater ? toInput(mlToDisplay(plannedWater, units)) : '');
  }

  function handleSave() {
    const found = {};
    const num = (key, text) => {
      const n = parseNumber(text);
      if (isInvalidNumber(n) || n < 0) found[key] = 'Enter a number';
      return n;
    };
    const waterValue = num('water', water);
    const pre = num('weightPre', weightPre);
    const post = num('weightPost', weightPost);
    setErrors(found);
    if (Object.keys(found).length) return;
    onSave({
      intake: rowIds.filter((id) => servings[id] > 0).map((id) => ({ foodId: id, servings: servings[id] })),
      plainWaterMl: waterValue === undefined ? 0 : displayToMl(waterValue, units),
      weightPreKg: pre === undefined ? null : displayToKg(pre, units),
      weightPostKg: post === undefined ? null : displayToKg(post, units),
      status: 'completed',
    });
  }

  const actual = ride.actual;
  return (
    <section className="card form" aria-labelledby="intake-title">
      <h2 id="intake-title">What you ate</h2>
      {actual && (
        <Notice tone="success">
          You ate <strong>{actual.carbsGph} g carbs/hr</strong> (plan {ride.plan.targets.carbsGph}) ·{' '}
          {formatFluid(actual.fluidMlPerHr, units)}/hr · {actual.sodiumMgPerHr} mg sodium/hr
        </Notice>
      )}

      {Object.keys(planned).length > 0 && (
        <Button variant="secondary" block onClick={fillAsPlanned}>
          Fill in as planned
        </Button>
      )}

      <ul className="intake">
        {rowIds.map((id) => {
          const food = byId.get(id);
          const count = servings[id] ?? 0;
          return (
            <li key={id} className="intake__row">
              <span className="intake__name">
                {food.name}
                <span className="muted small">
                  {' '}
                  · {food.servingLabel}
                  {planned[id] ? ` · planned ${formatServings(planned[id])}` : ''}
                </span>
              </span>
              <span className="intake__controls">
                <button type="button" className="stepper__btn" aria-label={`Less ${food.name}`} onClick={() => change(id, -STEP)} disabled={count <= 0}>
                  −
                </button>
                <output className="intake__count" aria-label={`${food.name} servings`}>
                  {formatServings(count)}
                </output>
                <button type="button" className="stepper__btn" aria-label={`More ${food.name}`} onClick={() => change(id, STEP)}>
                  +
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      {addable.length > 0 && (
        <div className="field">
          <label className="field__label" htmlFor="add-intake-food">
            Ate something else?
          </label>
          <div className="field__control">
            <select
              id="add-intake-food"
              className="field__input"
              value=""
              onChange={(e) => e.target.value && setExtraIds((ids) => [...ids, e.target.value])}
            >
              <option value="">Add a food from your library…</option>
              {addable.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <NumberField
        label="Plain water"
        suffix={fluidUnit(units)}
        value={water}
        onChange={(e) => setWater(e.target.value)}
        error={errors.water}
        hint="Water not in your food library"
      />
      <div className="form__row">
        <NumberField
          label={`Weight before (${weightUnit(units)})`}
          value={weightPre}
          onChange={(e) => setWeightPre(e.target.value)}
          error={errors.weightPre}
        />
        <NumberField
          label={`Weight after (${weightUnit(units)})`}
          value={weightPost}
          onChange={(e) => setWeightPost(e.target.value)}
          error={errors.weightPost}
        />
      </div>
      <p className="muted small">Optional: weigh yourself before and after (same clothes) to measure your sweat rate.</p>

      {error && <Notice tone="error">{error.message}</Notice>}
      <Button block onClick={handleSave} loading={saving}>
        {actual ? 'Update what I ate' : 'Save what I ate'}
      </Button>
    </section>
  );
}
