import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { buildEventPlan, PROFILE_FIELD_FOR, toCalculatorUser } from '@fuel-ride/fuel-core';
import { useAuth } from '../auth/AuthContext.jsx';
import { ForecastNotes, GutTrainingPlan, ProjectionSummary } from '../components/events/EventForecast.jsx';
import { emptyLastTime, LastTimeInput, lastTimeFromPast, toPast } from '../components/events/LastTimeInput.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { FoodsForToday } from '../components/plan/FoodsForToday.jsx';
import { FuelSchedule } from '../components/plan/FuelSchedule.jsx';
import { FuelSummary } from '../components/plan/FuelSummary.jsx';
import { HourlySummary } from '../components/plan/HourlySummary.jsx';
import { TemperatureInput, toCelsius } from '../components/plan/TemperatureInput.jsx';
import { Button } from '../components/ui/Button.jsx';
import { DurationInput } from '../components/ui/DurationInput.jsx';
import { Field, NumberField } from '../components/ui/Field.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { SegmentedControl } from '../components/ui/SegmentedControl.jsx';
import { useSnackbar } from '../components/ui/Snackbar.jsx';
import { useCreateEvent, useEvent, useUpdateEvent } from '../hooks/useEvents.js';
import { useFoods } from '../hooks/useFoods.js';
import { dateInputToIso, inputDateInDays, isoToDateInput } from '../lib/format.js';
import { isInvalidNumber, parseNumber, toInput } from '../lib/forms.js';
import { cToDisplay } from '../lib/units.js';

const TYPES = [
  { value: 'race', label: 'Race' },
  { value: 'group', label: 'Group ride' },
];
const SETTINGS = [
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'indoor', label: 'Indoor (trainer, Zwift…)' },
];

function initialState(event, user) {
  const tempUnit = user.units === 'imperial' ? 'F' : 'C';
  if (!event) {
    return {
      name: '',
      type: 'race',
      date: inputDateInDays(42),
      sameDuration: true,
      durationMin: 180,
      setting: 'outdoor',
      temp: '',
      tempUnit,
      carbGoal: '',
      picked: null,
      lastTime: emptyLastTime,
    };
  }
  return {
    name: event.name,
    type: event.type,
    date: isoToDateInput(event.date),
    sameDuration: event.durationMin === undefined,
    durationMin: event.durationMin ?? event.past.durationMin,
    setting: event.indoor ? 'indoor' : 'outdoor',
    temp: event.tempC === undefined ? '' : String(cToDisplay(event.tempC, user.units)),
    tempUnit,
    carbGoal: toInput(event.carbGoalGph),
    picked: event.foodsAuto ? null : (event.foodIds ?? []),
    lastTime: lastTimeFromPast(event.past),
  };
}

/** /events/new and /events/:id/edit: the event's inputs with a live forecast, computed like the server does. */
export function EventFormPage() {
  const { id } = useParams();
  const existing = useEvent(id);
  if (id && existing.isPending) return <LoadingScreen />;
  if (id && existing.isError) return <Notice tone="error">{existing.error.message}</Notice>;
  return <EventForm key={id ?? 'new'} event={existing.data} />;
}

function EventForm({ event }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const foods = useFoods();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const save = event ? update : create;
  const [s, setState] = useState(() => initialState(event, user));
  const set = (patch) => setState((prev) => ({ ...prev, ...patch }));

  const library = foods.data ?? [];
  const appPicks = s.picked === null; // the app picks from the library (FUELING_RULES.md §7.0)

  const tempValue = parseNumber(s.temp);
  const tempError = isInvalidNumber(tempValue) ? 'Enter a number' : undefined;
  const tempC = tempValue === undefined || tempError ? undefined : toCelsius(tempValue, s.tempUnit);
  const goalValue = parseNumber(s.carbGoal);
  const goalError = isInvalidNumber(goalValue) ? 'Enter a number' : undefined;
  const lastTime = toPast(s.lastTime);
  const durationMin = s.sameDuration ? undefined : s.durationMin;

  const body = lastTime.past && {
    name: s.name.trim(),
    type: s.type,
    date: s.date ? dateInputToIso(s.date) : undefined,
    durationMin,
    indoor: s.setting === 'indoor',
    tempC,
    carbGoalGph: goalValue,
    foodIds: s.picked ?? undefined, // omitted → the API picks, exactly like the preview
    past: lastTime.past,
  };

  // Live forecast with the same fuel-core the API uses (recomputed on every change: it's pure and fast)
  let preview = null;
  if (body && s.date && !tempError && !goalError && !(durationMin === null)) {
    const byId = new Map(library.map((f) => [f.id, f]));
    try {
      preview = {
        forecast: buildEventPlan({
          event: body,
          user: toCalculatorUser(user, body.date),
          foods: appPicks ? library : s.picked.map((fid) => byId.get(fid)).filter(Boolean),
          autoSelectFoods: appPicks,
          today: new Date().toISOString(),
        }),
      };
    } catch (err) {
      if (err.name !== 'FuelInputError') throw err;
      preview = { error: err };
    }
  }
  const profileField = preview?.error && PROFILE_FIELD_FOR[preview.error.field];

  function handleSave() {
    if (!body.name) return;
    const payload = event
      ? {
          ...body,
          durationMin: durationMin ?? null,
          tempC: tempC ?? null,
          carbGoalGph: goalValue ?? null,
          ...(appPicks && { foodsAuto: true }), // switch (back) to app picking
        }
      : body;
    const options = {
      onSuccess: (saved) => {
        snackbar('Event saved.');
        navigate(`/events/${saved.id}`);
      },
    };
    if (event) update.mutate({ id: event.id, patch: payload }, options);
    else create.mutate(payload, options);
  }

  if (foods.isPending) return <LoadingScreen />;

  return (
    <div className="page">
      <PageHeader title={event ? 'Edit event' : 'New event'} backTo={event ? `/events/${event.id}` : '/events'} />

      {profileField && (
        <Notice tone="error">
          {preview.error.field === 'weightKg' ? 'Add your weight to your profile to plan events.' : preview.error.message}{' '}
          <Link to="/settings">Go to profile</Link>
        </Notice>
      )}

      <section className="card form">
        <h2>Event</h2>
        <Field
          label="Name"
          value={s.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. Spring Gran Fondo"
        />
        <div className="form__row">
          <SegmentedControl label="Type" options={TYPES} value={s.type} onChange={(type) => set({ type })} />
          <Field label="Date" type="date" value={s.date} onChange={(e) => set({ date: e.target.value })} />
        </div>
        <SegmentedControl label="Where" options={SETTINGS} value={s.setting} onChange={(setting) => set({ setting })} />
        <TemperatureInput
          label={s.setting === 'indoor' ? 'Room temperature (optional)' : 'Expected temperature (optional)'}
          value={s.temp}
          unit={s.tempUnit}
          onChange={(temp) => set({ temp })}
          onUnitChange={(tempUnit) => set({ tempUnit })}
          error={tempError}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={s.sameDuration}
            onChange={(e) => set({ sameDuration: e.target.checked })}
          />
          <span>Same duration as last time</span>
        </label>
        {!s.sameDuration && (
          <DurationInput label="Expected duration" value={s.durationMin} onChange={(d) => set({ durationMin: d })} />
        )}
      </section>

      <section className="card form">
        <h2>Last time</h2>
        <p className="muted small">Your numbers from this event (or a similar one) last time.</p>
        <LastTimeInput value={s.lastTime} onChange={(lastTimeState) => set({ lastTime: lastTimeState })} errors={lastTime.errors} />
        {lastTime.missing && <p className="muted">{lastTime.missing}</p>}
      </section>

      <section className="card form">
        <h2>Race-day carbs</h2>
        <NumberField
          label="Carb goal (optional)"
          suffix="g/hr"
          value={s.carbGoal}
          onChange={(e) => set({ carbGoal: e.target.value })}
          error={goalError ?? (preview?.error?.field === 'carbGoalGph' ? preview.error.message : undefined)}
          placeholder={preview?.forecast ? String(preview.forecast.suggestedGoalGph) : ''}
          hint={
            preview?.forecast
              ? `Suggested for this event: ${preview.forecast.suggestedGoalGph} g/hr. Leave empty to use it.`
              : 'Leave empty to use the suggested goal'
          }
        />
      </section>

      <FoodsForToday
        library={library}
        picked={s.picked}
        onChangePicked={(picked) => set({ picked })}
        foodSelection={preview?.forecast?.plan.foodSelection}
        units={user.units}
      />

      {preview?.error && !profileField && <Notice tone="error">{preview.error.message}</Notice>}
      {preview?.forecast && (
        <>
          <section className="card" aria-label="Projected effort">
            <ProjectionSummary forecast={preview.forecast} />
            <HourlySummary plan={preview.forecast.plan} units={user.units} />
          </section>
          <ForecastNotes forecast={preview.forecast} />
          <GutTrainingPlan forecast={preview.forecast} currentGph={user.trainedCarbRateGph} />
          <FuelSummary plan={preview.forecast.plan} units={user.units} />
          <FuelSchedule schedule={preview.forecast.plan.schedule} units={user.units} />
        </>
      )}

      {!s.name.trim() && preview?.forecast && <p className="muted">Give the event a name to save it.</p>}
      {save.error && <Notice tone="error">{save.error.message}</Notice>}
      <Button block onClick={handleSave} disabled={!preview?.forecast || !s.name.trim()} loading={save.isPending}>
        {event ? 'Save changes' : 'Save event'}
      </Button>
    </div>
  );
}
