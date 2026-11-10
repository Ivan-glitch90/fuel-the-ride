import { NumberField } from '../ui/Field.jsx';
import { SegmentedControl } from '../ui/SegmentedControl.jsx';
import { t } from '../../i18n/index.js';
import { isInvalidNumber, parseNumber } from '../../lib/forms.js';

const translated = (options) => options.map((o) => ({ ...o, label: t(o.label) }));

export const INTENSITY_MODES = [
  { value: 'power', label: 'Power' },
  { value: 'kj', label: 'kJ' },
  { value: 'hr', label: 'Heart rate' },
  { value: 'powerZone', label: 'Power zone' },
  { value: 'hrZone', label: 'HR zone' },
];

// Zones 1–5 only: a whole ride can't average zone 6–7 (FUELING_RULES.md §2)
const POWER_ZONES = [
  { value: 1, label: 'Z1 Recovery' },
  { value: 2, label: 'Z2 Endurance' },
  { value: 3, label: 'Z3 Tempo' },
  { value: 4, label: 'Z4 Threshold' },
  { value: 5, label: 'Z5 VO2max' },
];
const HR_ZONES = [
  { value: 1, label: 'Z1 Recovery' },
  { value: 2, label: 'Z2 Aerobic' },
  { value: 3, label: 'Z3 Tempo' },
  { value: 4, label: 'Z4 Threshold' },
  { value: 5, label: 'Z5 Max effort' },
];

export const emptyIntensityValues = {
  avgPowerW: '',
  normalizedPowerW: '',
  workKj: '',
  avgHr: '',
  powerZone: 2,
  hrZone: 2,
};

/**
 * The calculator input for the chosen mode.
 * @returns {{ intensity?: object, missing?: string, errors?: Record<string, string> }}
 */
export function toIntensity(mode, values) {
  const number = (key) => parseNumber(values[key]);
  const invalid = (key) => (isInvalidNumber(number(key)) ? { [key]: t('Enter a number') } : null);

  switch (mode) {
    case 'power': {
      const errors = { ...invalid('avgPowerW'), ...invalid('normalizedPowerW') };
      if (Object.keys(errors).length) return { errors };
      if (number('avgPowerW') === undefined) return { missing: t('Enter your expected average power.') };
      const intensity = { avgPowerW: number('avgPowerW') };
      if (number('normalizedPowerW') !== undefined) intensity.normalizedPowerW = number('normalizedPowerW');
      return { intensity };
    }
    case 'kj': {
      const errors = invalid('workKj');
      if (errors) return { errors };
      if (number('workKj') === undefined) return { missing: t('Enter the expected kilojoules for the ride.') };
      return { intensity: { workKj: number('workKj') } };
    }
    case 'hr': {
      const errors = invalid('avgHr');
      if (errors) return { errors };
      if (number('avgHr') === undefined) return { missing: t('Enter your expected average heart rate.') };
      return { intensity: { avgHr: number('avgHr') } };
    }
    case 'powerZone':
      return { intensity: { powerZone: values.powerZone } };
    case 'hrZone':
      return { intensity: { hrZone: values.hrZone } };
    default:
      return { missing: t('Choose how to describe the effort.') };
  }
}

/** Choose how to describe the ride's effort, then enter that one value. */
export function IntensityInput({ mode, values, onModeChange, onValueChange, errors = {} }) {
  const set = (key) => (e) => onValueChange(key, e.target.value);
  return (
    <div className="form__section">
      <SegmentedControl
        label={t('Describe the effort with')}
        options={translated(INTENSITY_MODES)}
        value={mode}
        onChange={onModeChange}
      />

      {mode === 'power' && (
        <div className="form__row">
          <NumberField
            label={t('Average power')}
            suffix="W"
            value={values.avgPowerW}
            onChange={set('avgPowerW')}
            error={errors.avgPowerW}
          />
          <NumberField
            label={t('Normalized power (optional)')}
            suffix="W"
            value={values.normalizedPowerW}
            onChange={set('normalizedPowerW')}
            error={errors.normalizedPowerW}
          />
        </div>
      )}
      {mode === 'kj' && (
        <NumberField
          label={t('Work')}
          suffix="kJ"
          value={values.workKj}
          onChange={set('workKj')}
          error={errors.workKj}
          hint={t('Total kilojoules, e.g. from a similar past ride on your power meter. The most accurate option.')}
        />
      )}
      {mode === 'hr' && (
        <NumberField
          label={t('Average heart rate')}
          suffix="bpm"
          value={values.avgHr}
          onChange={set('avgHr')}
          error={errors.avgHr}
        />
      )}
      {mode === 'powerZone' && (
        <SegmentedControl
          label={t('Power zone (whole-ride average)')}
          options={translated(POWER_ZONES)}
          value={values.powerZone}
          onChange={(zone) => onValueChange('powerZone', zone)}
          error={errors.powerZone}
        />
      )}
      {mode === 'hrZone' && (
        <SegmentedControl
          label={t('Heart-rate zone (whole-ride average)')}
          options={translated(HR_ZONES)}
          value={values.hrZone}
          onChange={(zone) => onValueChange('hrZone', zone)}
          error={errors.hrZone}
        />
      )}
    </div>
  );
}
