import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { emptyIntensityValues, IntensityInput, toIntensity } from '../components/plan/IntensityInput.jsx';
import { TemperatureInput, toCelsius } from '../components/plan/TemperatureInput.jsx';
import { Button } from '../components/ui/Button.jsx';
import { DurationInput } from '../components/ui/DurationInput.jsx';
import { Field } from '../components/ui/Field.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { SegmentedControl } from '../components/ui/SegmentedControl.jsx';
import { useSnackbar } from '../components/ui/Snackbar.jsx';
import { useCreateRide } from '../hooks/useRides.js';
import { getLocale, t } from '../i18n/index.js';
import { dateInputToIso, formatDuration, isoToDateInput } from '../lib/format.js';
import { isInvalidNumber, parseNumber } from '../lib/forms.js';
import { readRideFile, RideFileError } from '../lib/rideFile.js';
import { cToDisplay, formatDistance, formatElevation } from '../lib/units.js';

const RIDE_TYPES = [
  { value: 'training', label: 'Workout' },
  { value: 'group', label: 'Group ride' },
  { value: 'race', label: 'Race' },
];
const SETTINGS = [
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'indoor', label: 'Indoor (trainer, Zwift…)' },
];
const translated = (options) => options.map((o) => ({ ...o, label: t(o.label) }));
const DURATION = { min: 15, max: 720 }; // the calculator's range (FUELING_RULES.md §1)

/** Pre-fill the effort with the best data in the file: kJ, then power, then heart rate. */
function effortFrom(summary) {
  const values = { ...emptyIntensityValues };
  if (summary.workKj) return { mode: 'kj', values: { ...values, workKj: String(summary.workKj) } };
  if (summary.avgPowerW) {
    return {
      mode: 'power',
      values: { ...values, avgPowerW: String(summary.avgPowerW), normalizedPowerW: String(summary.normalizedPowerW ?? '') },
    };
  }
  if (summary.avgHr) return { mode: 'hr', values: { ...values, avgHr: String(summary.avgHr) } };
  return { mode: 'powerZone', values, missingData: true };
}

/**
 * Import a finished ride from a .FIT or .GPX file. The file is read on the phone; only the
 * summary is saved (never the GPS track). The ride is saved as completed with the plan for
 * what it needed, so the rider can log what they ate and compare.
 */
export function ImportRidePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const create = useCreateRide();

  const [summary, setSummary] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [reading, setReading] = useState(false);
  const [form, setForm] = useState(null);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // picking the same file again still triggers a change
    if (!file) return;
    setFileError(null);
    setReading(true);
    try {
      const s = await readRideFile(file);
      const effort = effortFrom(s);
      setSummary(s);
      setForm({
        name: s.name ?? '',
        date: isoToDateInput(s.startTime),
        durationMin: Math.min(DURATION.max, Math.max(DURATION.min, s.durationMin)),
        rideType: 'training',
        setting: s.indoor ? 'indoor' : 'outdoor',
        mode: effort.mode,
        values: effort.values,
        missingData: Boolean(effort.missingData),
        temp: s.tempC === null ? '' : String(cToDisplay(s.tempC, user.units)),
        tempUnit: user.units === 'imperial' ? 'F' : 'C',
      });
    } catch (err) {
      setSummary(null);
      setForm(null);
      setFileError(err instanceof RideFileError ? t(err.message) : t("Couldn't read that file. Is it a ride from your bike computer?"));
    } finally {
      setReading(false);
    }
  }

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const intensityInput = form ? toIntensity(form.mode, form.values) : {};
  const tempValue = form ? parseNumber(form.temp) : undefined;
  const tempError = isInvalidNumber(tempValue) ? t('Enter a number') : undefined;

  function handleSave() {
    const sameDay = form.date === isoToDateInput(summary.startTime);
    create.mutate(
      {
        name: form.name.trim() || undefined,
        date: sameDay ? summary.startTime : dateInputToIso(form.date),
        durationMin: form.durationMin,
        intensity: intensityInput.intensity,
        tempC: tempValue === undefined ? undefined : toCelsius(tempValue, form.tempUnit),
        indoor: form.setting === 'indoor',
        rideType: form.rideType,
        status: 'completed',
        imported: {
          source: summary.source,
          startTime: summary.startTime,
          distanceKm: summary.distanceKm,
          elevationGainM: summary.elevationGainM,
        },
      },
      {
        onSuccess: (ride) => {
          snackbar(t('Ride imported. Add what you ate to compare it with what you needed.'));
          navigate(`/rides/${ride.id}`);
        },
      },
    );
  }

  const facts = summary && [
    [t('Started'), new Date(summary.startTime).toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short' })],
    [t('Moving time'), formatDuration(summary.durationMin)],
    summary.distanceKm !== null && [t('Distance'), formatDistance(summary.distanceKm, user.units)],
    summary.elevationGainM !== null && [t('Climbing'), formatElevation(summary.elevationGainM, user.units)],
    summary.avgPowerW !== null && [t('Average power'), `${summary.avgPowerW} W`],
    summary.normalizedPowerW !== null && [t('Normalized power'), `${summary.normalizedPowerW} W`],
    summary.workKj !== null && [t('Work'), `${summary.workKj} kJ`],
    summary.avgHr !== null && [t('Average heart rate'), `${summary.avgHr} bpm`],
  ].filter(Boolean);

  return (
    <div className="page">
      <PageHeader title={t('Import a ride')} backTo="/" />

      <section className="card form" aria-labelledby="import-file-title">
        <h2 id="import-file-title">{t('Ride file')}</h2>
        <p className="muted">
          {t(
            'Choose a .fit or .gpx file from your bike computer or an app export (Garmin Connect, Wahoo, Strava…). It’s read on your phone: only the summary is saved, never your GPS track.',
          )}
        </p>
        <label className="btn btn--secondary btn--block file-pick">
          {reading ? t('Reading…') : summary ? t('Choose another file') : t('Choose a file')}
          <input type="file" accept=".fit,.gpx" className="visually-hidden" onChange={handleFile} disabled={reading} />
        </label>
        {fileError && <Notice tone="error">{fileError}</Notice>}
      </section>

      {summary && form && (
        <>
          <section className="card" aria-labelledby="import-facts-title">
            <h2 id="import-facts-title">{t('From the file')}</h2>
            <dl className="facts">
              {facts.map(([label, value]) => (
                <div key={label} className="facts__item">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card form" aria-labelledby="import-ride-title">
            <h2 id="import-ride-title">{t('Ride')}</h2>
            <SegmentedControl label={t('Ride type')} options={translated(RIDE_TYPES)} value={form.rideType} onChange={set('rideType')} />
            <SegmentedControl label={t('Where')} options={translated(SETTINGS)} value={form.setting} onChange={set('setting')} />
            <div className="form__row">
              <Field label={t('Name (optional)')} value={form.name} onChange={(e) => set('name')(e.target.value)} />
              <Field label={t('Date')} type="date" value={form.date} onChange={(e) => set('date')(e.target.value)} />
            </div>
            <div className="form__row">
              <DurationInput value={form.durationMin} onChange={set('durationMin')} />
              <TemperatureInput
                label={t('Temperature (optional)')}
                value={form.temp}
                unit={form.tempUnit}
                onChange={set('temp')}
                onUnitChange={set('tempUnit')}
                error={tempError}
              />
            </div>
          </section>

          <section className="card form" aria-labelledby="import-effort-title">
            <h2 id="import-effort-title">{t('Effort')}</h2>
            {form.missingData && (
              <Notice>{t('This file has no power or heart-rate data. Choose how hard the ride felt.')}</Notice>
            )}
            <IntensityInput
              mode={form.mode}
              values={form.values}
              onModeChange={set('mode')}
              onValueChange={(key, value) => setForm((f) => ({ ...f, values: { ...f.values, [key]: value } }))}
              errors={intensityInput.errors}
            />
            {intensityInput.missing && <p className="muted">{intensityInput.missing}</p>}
          </section>

          {create.error && <Notice tone="error">{create.error.message}</Notice>}
          <Button
            block
            onClick={handleSave}
            disabled={!intensityInput.intensity || Boolean(tempError) || !form.date || form.durationMin === null}
            loading={create.isPending}
          >
            {t('Save ride')}
          </Button>
        </>
      )}
    </div>
  );
}
