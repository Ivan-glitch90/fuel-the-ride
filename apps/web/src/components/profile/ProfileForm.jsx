import { useState } from 'react';
import { fieldErrors } from '../../api/client.js';
import { t } from '../../i18n/index.js';
import { isInvalidNumber, parseNumber, toInput } from '../../lib/forms.js';
import { displayToKg, displayToMl, fluidUnit, kgToDisplay, mlToDisplay, weightUnit } from '../../lib/units.js';
import { Button } from '../ui/Button.jsx';
import { Acronym, Field, NumberField } from '../ui/Field.jsx';
import { Notice } from '../ui/Notice.jsx';
import { SegmentedControl } from '../ui/SegmentedControl.jsx';

const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unspecified', label: 'Prefer not to say' },
];
const SODIUM_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'average', label: 'Average' },
  { value: 'salty', label: 'Salty sweater' },
];
const UNIT_OPTIONS = [
  { value: 'metric', label: 'Metric (kg, ml)' },
  { value: 'imperial', label: 'Imperial (lb, fl oz)' },
];

function toFormValues(user) {
  return {
    name: user.name ?? '',
    units: user.units ?? 'metric',
    weight: user.weightKg ? toInput(kgToDisplay(user.weightKg, user.units)) : '',
    birthYear: toInput(user.birthYear),
    sex: user.sex ?? 'unspecified',
    ftpW: toInput(user.ftpW),
    maxHr: toInput(user.maxHr),
    lthr: toInput(user.lthr),
    restingHr: toInput(user.restingHr),
    trainedCarbRateGph: toInput(user.trainedCarbRateGph),
    sweatRate: user.sweatRateMlPerHr ? toInput(mlToDisplay(user.sweatRateMlPerHr, user.units)) : '',
    sweatSodium: user.sweatSodium ?? 'average',
  };
}

function toPatch(values) {
  const errors = {};
  const num = (key) => {
    const value = parseNumber(values[key]);
    if (isInvalidNumber(value)) errors[key] = t('Enter a number');
    return value;
  };
  const optional = (key) => num(key) ?? null; // empty clears an optional field

  const patch = {
    name: values.name.trim(),
    units: values.units,
    sex: values.sex,
    sweatSodium: values.sweatSodium,
    ftpW: optional('ftpW'),
    maxHr: optional('maxHr'),
    lthr: optional('lthr'),
    restingHr: optional('restingHr'),
  };
  if (!patch.name) errors.name = t('Enter your name');

  const weight = num('weight');
  if (weight !== undefined) patch.weightKg = displayToKg(weight, values.units);
  const birthYear = num('birthYear');
  if (birthYear !== undefined) patch.birthYear = birthYear;
  const trained = num('trainedCarbRateGph');
  if (trained !== undefined) patch.trainedCarbRateGph = trained;
  const sweat = num('sweatRate');
  patch.sweatRateMlPerHr = sweat === undefined ? null : displayToMl(sweat, values.units);

  return { patch, errors };
}

/** Option labels are English constants; translate them while rendering. */
const translated = (options) => options.map((o) => ({ ...o, label: t(o.label) }));

// Server error paths use API field names; map them to this form's inputs.
const SERVER_TO_FORM = { weightKg: 'weight', sweatRateMlPerHr: 'sweatRate' };

export function ProfileForm({ user, onSubmit, submitting, serverError }) {
  const [values, setValues] = useState(() => toFormValues(user));
  const [clientErrors, setClientErrors] = useState({});
  const serverErrors = Object.fromEntries(
    Object.entries(fieldErrors(serverError)).map(([k, v]) => [SERVER_TO_FORM[k] ?? k, v]),
  );
  const errors = { ...serverErrors, ...clientErrors };
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  // Switching units converts what's already typed, so the numbers stay true
  function changeUnits(units) {
    setValues((v) => {
      const weight = parseNumber(v.weight);
      const sweat = parseNumber(v.sweatRate);
      return {
        ...v,
        units,
        weight: Number.isFinite(weight) ? toInput(kgToDisplay(displayToKg(weight, v.units), units)) : v.weight,
        sweatRate: Number.isFinite(sweat) ? toInput(mlToDisplay(displayToMl(sweat, v.units), units)) : v.sweatRate,
      };
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const { patch, errors: found } = toPatch(values);
    setClientErrors(found);
    if (Object.keys(found).length === 0) onSubmit(patch);
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {serverError && Object.keys(serverErrors).length === 0 && <Notice tone="error">{serverError.message}</Notice>}

      <section className="form__section">
        <h2>{t('You')}</h2>
        <Field label={t('Name')} value={values.name} onChange={set('name')} error={errors.name} autoComplete="name" />
        <SegmentedControl
          label={t('Units')}
          options={translated(UNIT_OPTIONS)}
          value={values.units}
          onChange={changeUnits}
        />
        <div className="form__row">
          <NumberField
            label={t('Weight ({unit})', { unit: weightUnit(values.units) })}
            value={values.weight}
            onChange={set('weight')}
            error={errors.weight}
            hint={t('Needed to plan rides')}
          />
          <NumberField
            label={t('Birth year')}
            inputMode="numeric"
            value={values.birthYear}
            onChange={set('birthYear')}
            error={errors.birthYear}
          />
        </div>
        <SegmentedControl
          label={t('Sex')}
          options={translated(SEX_OPTIONS)}
          value={values.sex}
          onChange={(sex) => setValues((v) => ({ ...v, sex }))}
        />
      </section>

      <section className="form__section">
        <h2>{t('Training (optional)')}</h2>
        <p className="muted">{t("These make calorie estimates more accurate. Leave empty if you don't know them.")}</p>
        <div className="form__row">
          <NumberField
            label={<Acronym short="FTP" long={t('functional threshold power')} />}
            suffix="W"
            value={values.ftpW}
            onChange={set('ftpW')}
            error={errors.ftpW}
          />
          <NumberField
            label={<Acronym short="LTHR" long={t('lactate threshold heart rate')} />}
            suffix="bpm"
            value={values.lthr}
            onChange={set('lthr')}
            error={errors.lthr}
          />
        </div>
        <div className="form__row">
          <NumberField
            label={<Acronym short={t('Max HR')} long={t('maximum heart rate')} />}
            suffix="bpm"
            value={values.maxHr}
            onChange={set('maxHr')}
            error={errors.maxHr}
          />
          <NumberField
            label={<Acronym short={t('Resting HR')} long={t('resting heart rate')} />}
            suffix="bpm"
            value={values.restingHr}
            onChange={set('restingHr')}
            error={errors.restingHr}
          />
        </div>
      </section>

      <section className="form__section">
        <h2>{t('Fueling')}</h2>
        <NumberField
          label={t('Trained carb rate')}
          suffix={t('g/hr')}
          value={values.trainedCarbRateGph}
          onChange={set('trainedCarbRateGph')}
          error={errors.trainedCarbRateGph}
          hint={t('The most carbs per hour your stomach handles today. Plans never go above it.')}
        />
        <NumberField
          label={t('Sweat rate (optional)')}
          suffix={t('{unit}/hr', { unit: fluidUnit(values.units) })}
          value={values.sweatRate}
          onChange={set('sweatRate')}
          error={errors.sweatRate}
          hint={t('Measured from before/after ride weigh-ins. Leave empty to use defaults.')}
        />
        <SegmentedControl
          label={t('Sweat saltiness')}
          options={translated(SODIUM_OPTIONS)}
          value={values.sweatSodium}
          onChange={(sweatSodium) => setValues((v) => ({ ...v, sweatSodium }))}
        />
      </section>

      <Button type="submit" block loading={submitting}>
        {t('Save profile')}
      </Button>
    </form>
  );
}
