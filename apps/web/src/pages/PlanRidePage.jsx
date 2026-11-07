import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { buildFuelPlan, PROFILE_FIELD_FOR, toCalculatorUser } from '@fuel-ride/fuel-core';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { FoodPicker } from '../components/plan/FoodPicker.jsx';
import { FuelSchedule } from '../components/plan/FuelSchedule.jsx';
import { FuelSummary } from '../components/plan/FuelSummary.jsx';
import { HourlySummary } from '../components/plan/HourlySummary.jsx';
import { emptyIntensityValues, IntensityInput, toIntensity } from '../components/plan/IntensityInput.jsx';
import { TemperatureInput, toCelsius } from '../components/plan/TemperatureInput.jsx';
import { Button } from '../components/ui/Button.jsx';
import { DurationInput } from '../components/ui/DurationInput.jsx';
import { Field } from '../components/ui/Field.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { SegmentedControl } from '../components/ui/SegmentedControl.jsx';
import { useFoods } from '../hooks/useFoods.js';
import { useCreateRide } from '../hooks/useRides.js';
import { dateInputToIso, todayInputValue } from '../lib/format.js';
import { isInvalidNumber, parseNumber } from '../lib/forms.js';

const PROFILE_MESSAGES = {
  weightKg: 'Add your weight to your profile to plan rides.',
  birthYear: 'Add your birth year to your profile (needed for heart-rate based plans), or add your FTP.',
};

const RIDE_TYPES = [
  { value: 'training', label: 'Training' },
  { value: 'group', label: 'Group ride' },
  { value: 'race', label: 'Race' },
];
const SETTINGS = [
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'indoor', label: 'Indoor (trainer, Zwift…)' },
];

/**
 * Plan a ride: duration, effort, conditions and the foods you'll carry → a live plan
 * computed on the phone with the same fuel-core the server uses. Saving stores the server's copy.
 */
export function PlanRidePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const foods = useFoods();
  const create = useCreateRide();

  const [name, setName] = useState('');
  const [date, setDate] = useState(todayInputValue);
  const [durationMin, setDurationMin] = useState(120); // null while the typed duration is invalid
  const [rideType, setRideType] = useState('training');
  const [setting, setSetting] = useState('outdoor');
  const [mode, setMode] = useState(user.ftpW ? 'power' : 'powerZone');
  const [intensityValues, setIntensityValues] = useState(emptyIntensityValues);
  const [temp, setTemp] = useState('');
  const [tempUnit, setTempUnit] = useState(user.units === 'imperial' ? 'F' : 'C');
  const [picked, setPicked] = useState(null); // null = not touched yet → favorites

  const indoor = setting === 'indoor';
  const library = foods.data ?? [];
  const pickedIds = picked ?? library.filter((f) => f.favorite).map((f) => f.id);
  const togglePick = (id) =>
    setPicked(pickedIds.includes(id) ? pickedIds.filter((x) => x !== id) : [...pickedIds, id]);

  const intensityInput = toIntensity(mode, intensityValues);
  const tempValue = parseNumber(temp);
  const tempError = isInvalidNumber(tempValue) ? 'Enter a number' : undefined;
  const tempC = tempValue === undefined || tempError ? undefined : toCelsius(tempValue, tempUnit);

  // Recomputed on every change: the calculator is pure and takes well under a millisecond
  const preview = computePreview();
  function computePreview() {
    if (!intensityInput.intensity || tempError || !date || durationMin === null) return null;
    const byId = new Map(library.map((f) => [f.id, f]));
    try {
      const plan = buildFuelPlan({
        ride: { durationMin, intensity: intensityInput.intensity, tempC, indoor, rideType },
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
        indoor,
        rideType,
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
          <Field
            label="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Saturday gravel"
          />
          <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <SegmentedControl label="Ride type" options={RIDE_TYPES} value={rideType} onChange={setRideType} />
        <SegmentedControl label="Where" options={SETTINGS} value={setting} onChange={setSetting} />
        <div className="form__row">
          <DurationInput value={durationMin} onChange={setDurationMin} />
          <TemperatureInput
            label={indoor ? 'Room temperature (optional)' : 'Temperature (optional)'}
            value={temp}
            unit={tempUnit}
            onChange={setTemp}
            onUnitChange={setTempUnit}
            error={tempError ?? inputErrors.tempC}
            hint={indoor ? 'Leave empty for a typical room (22 °C / 72 °F)' : 'Hotter rides need more fluid and sodium'}
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
          <section className="card" aria-label="What to carry">
            <HourlySummary plan={preview.plan} units={user.units} />
          </section>
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
