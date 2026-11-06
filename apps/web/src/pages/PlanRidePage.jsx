import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { buildFuelPlan, PROFILE_FIELD_FOR, toCalculatorUser } from '@fuel-ride/fuel-core';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { FoodPicker } from '../components/plan/FoodPicker.jsx';
import { FuelSchedule } from '../components/plan/FuelSchedule.jsx';
import { FuelSummary } from '../components/plan/FuelSummary.jsx';
import { emptyIntensityValues, IntensityInput, toIntensity } from '../components/plan/IntensityInput.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, NumberField } from '../components/ui/Field.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { Stepper } from '../components/ui/Stepper.jsx';
import { useFoods } from '../hooks/useFoods.js';
import { useCreateRide } from '../hooks/useRides.js';
import { dateInputToIso, formatDuration, todayInputValue } from '../lib/format.js';
import { isInvalidNumber, parseNumber } from '../lib/forms.js';
import { displayToC, tempUnit } from '../lib/units.js';

const PROFILE_MESSAGES = {
  weightKg: 'Add your weight to your profile to plan rides.',
  birthYear: 'Add your birth year to your profile (needed for heart-rate based plans), or add your FTP.',
};

/**
 * Plan a ride: duration, effort, temperature and the foods you'll carry → a live plan
 * computed on the phone with the same fuel-core the server uses. Saving stores the server's copy.
 */
export function PlanRidePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const foods = useFoods();
  const create = useCreateRide();

  const [name, setName] = useState('');
  const [date, setDate] = useState(todayInputValue);
  const [durationMin, setDurationMin] = useState(120);
  const [mode, setMode] = useState(user.ftpW ? 'power' : 'powerZone');
  const [intensityValues, setIntensityValues] = useState(emptyIntensityValues);
  const [temp, setTemp] = useState('');
  const [picked, setPicked] = useState(null); // null = not touched yet → favorites

  const library = foods.data ?? [];
  const pickedIds = picked ?? library.filter((f) => f.favorite).map((f) => f.id);
  const togglePick = (id) =>
    setPicked(pickedIds.includes(id) ? pickedIds.filter((x) => x !== id) : [...pickedIds, id]);

  const intensityInput = toIntensity(mode, intensityValues);
  const tempValue = parseNumber(temp);
  const tempError = isInvalidNumber(tempValue) ? 'Enter a number' : undefined;
  const tempC = tempValue === undefined || tempError ? undefined : displayToC(tempValue, user.units);

  // Recomputed on every change: the calculator is pure and takes well under a millisecond
  const preview = computePreview();
  function computePreview() {
    if (!intensityInput.intensity || tempError || !date) return null;
    const byId = new Map(library.map((f) => [f.id, f]));
    try {
      const plan = buildFuelPlan({
        ride: { durationMin, intensity: intensityInput.intensity, tempC },
        user: toCalculatorUser(user, dateInputToIso(date)),
        foods: pickedIds.map((id) => byId.get(id)).filter(Boolean),
      });
      return { plan };
    } catch (err) {
      if (err.name === 'FuelInputError') return { error: err };
      throw err;
    }
  }

  const profileField = preview?.error && PROFILE_FIELD_FOR[preview.error.field];
  const inputErrors = { ...intensityInput.errors };
  if (preview?.error && !profileField) inputErrors[preview.error.field] = preview.error.message;

  function handleSave() {
    create.mutate(
      {
        name: name.trim() || undefined,
        date: dateInputToIso(date),
        durationMin,
        intensity: intensityInput.intensity,
        tempC,
        foodIds: pickedIds,
      },
      { onSuccess: (ride) => navigate(`/rides/${ride.id}`, { state: { saved: true } }) },
    );
  }

  if (foods.isPending) return <LoadingScreen />;

  return (
    <div className="page">
      <PageHeader title="Plan a ride" />

      {profileField && (
        <Notice tone="error">
          {PROFILE_MESSAGES[profileField] ?? preview.error.message} <Link to="/settings">Go to profile</Link>
        </Notice>
      )}

      <section className="card form">
        <h2>Ride</h2>
        <div className="form__row">
          <Field label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Saturday gravel" />
          <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form__row">
          <Stepper
            label="Duration"
            value={durationMin}
            onChange={setDurationMin}
            step={15}
            min={15}
            max={720}
            format={formatDuration}
          />
          <NumberField
            label="Temperature (optional)"
            suffix={tempUnit(user.units)}
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            error={tempError ?? inputErrors.tempC}
            hint="Hotter rides need more fluid and sodium"
          />
        </div>
      </section>

      <section className="card form">
        <h2>Effort</h2>
        <IntensityInput
          mode={mode}
          values={intensityValues}
          onModeChange={setMode}
          onValueChange={(key, value) => setIntensityValues((v) => ({ ...v, [key]: value }))}
          errors={inputErrors}
        />
        {intensityInput.missing && <p className="muted">{intensityInput.missing}</p>}
      </section>

      <section className="card">
        <h2>Foods you&apos;ll carry</h2>
        <p className="muted small">Tap in order of preference. Favorites are picked for you.</p>
        <FoodPicker foods={library} selectedIds={pickedIds} onToggle={togglePick} units={user.units} />
      </section>

      {preview?.plan && (
        <>
          <FuelSummary plan={preview.plan} units={user.units} />
          <FuelSchedule schedule={preview.plan.schedule} units={user.units} />
        </>
      )}

      {create.error && <Notice tone="error">{create.error.message}</Notice>}
      <Button block onClick={handleSave} disabled={!preview?.plan} loading={create.isPending}>
        Save ride plan
      </Button>
      <p className="muted small">Fueling targets are general sports-nutrition guidance, not medical advice.</p>
    </div>
  );
}
