import { useState } from 'react';
import { getCheckInForRide } from '../../api/checkins.js';
import { useRides } from '../../hooks/useRides.js';
import { formatDate, formatDuration } from '../../lib/format.js';
import { isInvalidNumber, parseNumber, toInput } from '../../lib/forms.js';
import { DurationInput } from '../ui/DurationInput.jsx';
import { Acronym, NumberField } from '../ui/Field.jsx';
import { SegmentedControl } from '../ui/SegmentedControl.jsx';

const MODES = [
  { value: 'power', label: 'Power' },
  { value: 'kj', label: 'kJ' },
  { value: 'hr', label: 'Heart rate' },
];
const STOMACH = [
  { value: 0, label: "Don't know" },
  { value: 1, label: '1 Bad' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5 Perfect' },
];

export const emptyLastTime = {
  rideId: undefined,
  durationMin: 180,
  mode: 'power',
  avgPowerW: '',
  normalizedPowerW: '',
  workKj: '',
  avgHr: '',
  ftpAtTimeW: '',
  carbsGphEaten: '',
  giScore: 0,
  bonked: false,
};

/** Form state from a stored event's `past`. */
export function lastTimeFromPast(past) {
  const i = past.intensity ?? {};
  return {
    ...emptyLastTime,
    rideId: past.rideId,
    durationMin: past.durationMin,
    mode: i.avgPowerW !== undefined || i.normalizedPowerW !== undefined ? 'power' : i.workKj !== undefined ? 'kj' : 'hr',
    avgPowerW: toInput(i.avgPowerW),
    normalizedPowerW: toInput(i.normalizedPowerW),
    workKj: toInput(i.workKj),
    avgHr: toInput(i.avgHr),
    ftpAtTimeW: toInput(past.ftpAtTimeW),
    carbsGphEaten: toInput(past.carbsGphEaten),
    giScore: past.giScore ?? 0,
    bonked: past.bonked ?? false,
  };
}

/**
 * Form state → the API's `past`.
 * @returns {{ past?: object, missing?: string, errors?: Record<string,string> }}
 */
export function toPast(v) {
  const errors = {};
  const num = (key) => {
    const n = parseNumber(v[key]);
    if (isInvalidNumber(n)) errors[key] = 'Enter a number';
    return n;
  };
  const intensity = {};
  if (v.mode === 'power') {
    if (num('avgPowerW') !== undefined) intensity.avgPowerW = num('avgPowerW');
    if (num('normalizedPowerW') !== undefined) intensity.normalizedPowerW = num('normalizedPowerW');
  }
  if (v.mode === 'kj' && num('workKj') !== undefined) intensity.workKj = num('workKj');
  if (v.mode === 'hr' && num('avgHr') !== undefined) intensity.avgHr = num('avgHr');
  const ftpAtTimeW = num('ftpAtTimeW');
  const carbsGphEaten = num('carbsGphEaten');
  if (Object.keys(errors).length) return { errors };
  if (v.durationMin === null) return { missing: "Fix last time's duration." };
  if (Object.keys(intensity).length === 0) return { missing: "Enter last time's power, kilojoules or heart rate." };

  const past = { durationMin: v.durationMin, intensity, bonked: v.bonked };
  if (v.rideId) past.rideId = v.rideId;
  if (ftpAtTimeW !== undefined) past.ftpAtTimeW = ftpAtTimeW;
  if (carbsGphEaten !== undefined) past.carbsGphEaten = carbsGphEaten;
  if (v.giScore) past.giScore = v.giScore;
  return { past };
}

/** Last time's numbers: typed in, or filled from a ride logged in the app. */
export function LastTimeInput({ value, onChange, errors = {} }) {
  const rides = useRides({ limit: 50 });
  const [fillKey, setFillKey] = useState(0); // remounts the duration input after a fill
  const [filling, setFilling] = useState(false);
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });

  async function fillFromRide(rideId) {
    const ride = rides.data?.find((r) => r.id === rideId);
    if (!ride) return;
    setFilling(true);
    const i = ride.intensity ?? {};
    // Zone-based rides have no typed watts: use the power the plan worked out
    const plannedPower = ride.plan?.intensity?.avgPowerW;
    const next = {
      ...emptyLastTime,
      rideId,
      durationMin: ride.durationMin,
      mode: i.avgHr !== undefined || i.hrZone !== undefined ? 'hr' : i.workKj !== undefined ? 'kj' : 'power',
      avgPowerW: toInput(i.avgPowerW ?? (i.workKj === undefined ? plannedPower : undefined), 0),
      normalizedPowerW: toInput(i.normalizedPowerW),
      workKj: toInput(i.workKj),
      avgHr: toInput(i.avgHr ?? ride.plan?.intensity?.avgHr, 0),
      ftpAtTimeW: toInput(ride.ftpAtRideW),
      carbsGphEaten: toInput(ride.actual?.carbsGph),
    };
    try {
      const checkIn = await getCheckInForRide(rideId);
      if (checkIn) Object.assign(next, { giScore: checkIn.giScore, bonked: checkIn.bonked });
    } catch {
      // No check-in data: leave those fields for the rider
    }
    onChange(next);
    setFillKey((k) => k + 1);
    setFilling(false);
  }

  return (
    <div className="form__section">
      {rides.data?.length > 0 && (
        <div className="field">
          <label className="field__label" htmlFor="fill-from-ride">
            Fill from a logged ride (optional)
          </label>
          <div className="field__control">
            <select
              id="fill-from-ride"
              className="field__input"
              value={value.rideId ?? ''}
              onChange={(e) => e.target.value && fillFromRide(e.target.value)}
              disabled={filling}
            >
              <option value="">Type it in below…</option>
              {rides.data.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || 'Ride'}, {formatDate(r.date)}, {formatDuration(r.durationMin)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <DurationInput
        key={fillKey}
        label="Last time's duration"
        value={value.durationMin}
        onChange={(durationMin) => onChange({ ...value, durationMin })}
      />
      <SegmentedControl
        label="Last time's effort"
        options={MODES}
        value={value.mode}
        onChange={(mode) => onChange({ ...value, mode })}
      />
      {value.mode === 'power' && (
        <div className="form__row">
          <NumberField label="Average power" suffix="W" value={value.avgPowerW} onChange={set('avgPowerW')} error={errors.avgPowerW} />
          <NumberField
            label="Normalized power (optional)"
            suffix="W"
            value={value.normalizedPowerW}
            onChange={set('normalizedPowerW')}
            error={errors.normalizedPowerW}
          />
        </div>
      )}
      {value.mode === 'kj' && (
        <NumberField label="Work" suffix="kJ" value={value.workKj} onChange={set('workKj')} error={errors.workKj} />
      )}
      {value.mode === 'hr' && (
        <NumberField label="Average heart rate" suffix="bpm" value={value.avgHr} onChange={set('avgHr')} error={errors.avgHr} />
      )}
      {value.mode !== 'hr' && (
        <NumberField
          label={<Acronym short="FTP back then" long="functional threshold power" />}
          suffix="W"
          value={value.ftpAtTimeW}
          onChange={set('ftpAtTimeW')}
          error={errors.ftpAtTimeW}
          hint="Lets us scale last time's effort to today's FTP"
        />
      )}

      <NumberField
        label="Carbs you ate (optional)"
        suffix="g/hr"
        value={value.carbsGphEaten}
        onChange={set('carbsGphEaten')}
        error={errors.carbsGphEaten}
      />
      <SegmentedControl
        label="How was your stomach?"
        options={STOMACH}
        value={value.giScore}
        onChange={(giScore) => onChange({ ...value, giScore })}
      />
      <label className="checkbox">
        <input type="checkbox" checked={value.bonked} onChange={(e) => onChange({ ...value, bonked: e.target.checked })} />
        <span>I bonked or ran low on energy</span>
      </label>
    </div>
  );
}
