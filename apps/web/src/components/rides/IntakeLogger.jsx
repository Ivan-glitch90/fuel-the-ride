import { useState } from 'react';
import { intakeStatus } from '@fuel-ride/fuel-core';
import { t, tx } from '../../i18n/index.js';
import { formatDuration, formatServings } from '../../lib/format.js';
import { isInvalidNumber, parseNumber, toInput } from '../../lib/forms.js';
import { displayToKg, displayToMl, fluidUnit, formatFluid, kgToDisplay, mlToDisplay, weightUnit } from '../../lib/units.js';
import { Button } from '../ui/Button.jsx';
import { DurationInput } from '../ui/DurationInput.jsx';
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

const SUMMARY_TONE = { 'on-plan': 'success', under: 'warning', none: 'error' };

/**
 * How what was eaten compares with the plan (FUELING_RULES.md §9.0): green on plan (≥90% of the
 * carbs per hour), orange under, red when no carbs were logged. Compared with the targets for the
 * time actually ridden.
 */
function IntakeSummary({ ride, actual, units }) {
  const targets = actual.targets ?? ride.plan.targets; // rides logged before targets were stored
  const { status } = intakeStatus({ actual, targets });
  const values = {
    carbs: actual.carbsGph,
    plan: targets.carbsGph,
    fluid: formatFluid(actual.fluidMlPerHr, units),
    sodium: actual.sodiumMgPerHr,
  };
  const strong = { b: (text) => <strong>{text}</strong> };
  const minutes = actual.durationMin ?? ride.durationMin;
  return (
    <Notice tone={SUMMARY_TONE[status]}>
      {status === 'on-plan' &&
        tx('You ate <b>{carbs} g carbs/hr</b> (plan {plan}) · {fluid}/hr · {sodium} mg sodium/hr', strong, values)}
      {status === 'under' &&
        tx('Below plan: you ate <b>{carbs} of {plan} g carbs/hr</b> · {fluid}/hr · {sodium} mg sodium/hr', strong, values)}
      {status === 'none' &&
        tx('<b>You didn’t log any carbs.</b> The plan was {plan} g/hr. If you ate something, add it below.', strong, values)}
      {minutes !== ride.durationMin && (
        <>
          {' '}
          {t('Over the {time} you rode.', { time: formatDuration(minutes) })}
        </>
      )}
    </Notice>
  );
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
  const [actualMin, setActualMin] = useState(ride.actualDurationMin ?? ride.durationMin); // null while invalid

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
      if (isInvalidNumber(n) || n < 0) found[key] = t('Enter a number');
      return n;
    };
    const waterValue = num('water', water);
    const pre = num('weightPre', weightPre);
    const post = num('weightPost', weightPost);
    setErrors(found);
    if (Object.keys(found).length || actualMin === null) return;
    onSave({
      // Same as planned → null ("as planned"), so a later change to the plan's time still applies
      actualDurationMin: actualMin === ride.durationMin ? null : actualMin,
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
      <h2 id="intake-title">{t('What you ate')}</h2>
      {actual && <IntakeSummary ride={ride} actual={actual} units={units} />}

      <DurationInput label={t('How long did you ride?')} value={actualMin} onChange={setActualMin} />
      {actualMin !== null && actualMin !== ride.durationMin && (
        <p className="field__hint">
          {t('Planned {planned}. Per-hour numbers use the time you rode.', { planned: formatDuration(ride.durationMin) })}
        </p>
      )}

      {Object.keys(planned).length > 0 && (
        <Button variant="secondary" block onClick={fillAsPlanned}>
          {t('Fill in as planned')}
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
                  {planned[id] ? ` · ${t('planned {servings}', { servings: formatServings(planned[id]) })}` : ''}
                </span>
              </span>
              <span className="intake__controls">
                <button
                  type="button"
                  className="stepper__btn"
                  aria-label={t('Less {food}', { food: food.name })}
                  onClick={() => change(id, -STEP)}
                  disabled={count <= 0}
                >
                  −
                </button>
                <output className="intake__count" aria-label={t('{food} servings', { food: food.name })}>
                  {formatServings(count)}
                </output>
                <button
                  type="button"
                  className="stepper__btn"
                  aria-label={t('More {food}', { food: food.name })}
                  onClick={() => change(id, STEP)}
                >
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
            {t('Ate something else?')}
          </label>
          <div className="field__control">
            <select
              id="add-intake-food"
              className="field__input"
              value=""
              onChange={(e) => e.target.value && setExtraIds((ids) => [...ids, e.target.value])}
            >
              <option value="">{t('Add a food from your library…')}</option>
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
        label={t('Plain water')}
        suffix={fluidUnit(units)}
        value={water}
        onChange={(e) => setWater(e.target.value)}
        error={errors.water}
        hint={t('Water not in your food library')}
      />
      <div className="form__row">
        <NumberField
          label={t('Weight before ({unit})', { unit: weightUnit(units) })}
          value={weightPre}
          onChange={(e) => setWeightPre(e.target.value)}
          error={errors.weightPre}
        />
        <NumberField
          label={t('Weight after ({unit})', { unit: weightUnit(units) })}
          value={weightPost}
          onChange={(e) => setWeightPost(e.target.value)}
          error={errors.weightPost}
        />
      </div>
      <p className="muted small">
        {t('Optional: weigh yourself before and after (same clothes) to measure your sweat rate.')}
      </p>

      {error && <Notice tone="error">{error.message}</Notice>}
      <Button block onClick={handleSave} loading={saving}>
        {actual ? t('Update what I ate') : t('Save what I ate')}
      </Button>
    </section>
  );
}
