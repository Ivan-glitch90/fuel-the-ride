import { NumberField } from '../ui/Field.jsx';
import { SegmentedControl } from '../ui/SegmentedControl.jsx';
import { isInvalidNumber, parseNumber } from '../../lib/forms.js';

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
  const invalid = (key) => (isInvalidNumber(number(key)) ? { [key]: 'Enter a number' } : null);

  switch (mode) {
    case 'power': {
      const errors = { ...invalid('avgPowerW'), ...invalid('normalizedPowerW') };
      if (Object.keys(errors).length) return { errors };
      if (number('avgPowerW') === undefined) return { missing: 'Enter your expected average power.' };
      const intensity = { avgPowerW: number('avgPowerW') };
      if (number('normalizedPowerW') !== undefined) intensity.normalizedPowerW = number('normalizedPowerW');
      return { intensity };
    }
    case 'kj': {
      const errors = invalid('workKj');
      if (errors) return { errors };
      if (number('workKj') === undefined) return { missing: 'Enter the expected kilojoules for the ride.' };
      return { intensity: { workKj: number('workKj') } };
    }
    case 'hr': {
      const errors = invalid('avgHr');
      if (errors) return { errors };
      if (number('avgHr') === undefined) return { missing: 'Enter your expected average heart rate.' };
      return { intensity: { avgHr: number('avgHr') } };
    }
    case 'powerZone':
      return { intensity: { powerZone: values.powerZone } };
    case 'hrZone':
      return { intensity: { hrZone: values.hrZone } };
    default:
      return { missing: 'Choose how to describe the effort.' };
  }
}

/** Choose how to describe the ride's effort, then enter that one value. */
export function IntensityInput({ mode, values, onModeChange, onValueChange, errors = {} }) {
  const set = (key) => (e) => onValueChange(key, e.target.value);
  return (
    <div className="form__section">
      <SegmentedControl label="Describe the effort with" options={INTENSITY_MODES} value={mode} onChange={onModeChange} />

      {mode === 'power' && (
        <div className="form__row">
          <NumberField
            label="Average power"
            suffix="W"
            value={values.avgPowerW}
            onChange={set('avgPowerW')}
            error={errors.avgPowerW}
          />
          <NumberField
            label="Normalized power (optional)"
            suffix="W"
            value={values.normalizedPowerW}
            onChange={set('normalizedPowerW')}
            error={errors.normalizedPowerW}
          />
        </div>
      )}
      {mode === 'kj' && (
        <NumberField
          label="Work"
          suffix="kJ"
          value={values.workKj}
          onChange={set('workKj')}
          error={errors.workKj}
          hint="Total kilojoules, e.g. from a similar past ride on your power meter. The most accurate option."
        />
      )}
      {mode === 'hr' && (
        <NumberField
          label="Average heart rate"
          suffix="bpm"
          value={values.avgHr}
          onChange={set('avgHr')}
          error={errors.avgHr}
        />
      )}
      {mode === 'powerZone' && (
        <SegmentedControl
          label="Power zone (whole-ride average)"
          options={POWER_ZONES}
          value={values.powerZone}
          onChange={(zone) => onValueChange('powerZone', zone)}
          error={errors.powerZone}
        />
      )}
      {mode === 'hrZone' && (
        <SegmentedControl
          label="Heart-rate zone (whole-ride average)"
          options={HR_ZONES}
          value={values.hrZone}
          onChange={(zone) => onValueChange('hrZone', zone)}
          error={errors.hrZone}
        />
      )}
    </div>
  );
}
