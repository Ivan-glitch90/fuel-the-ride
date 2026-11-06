import { units as convert } from '@fuel-ride/fuel-core';
import { isInvalidNumber, parseNumber, roundTo } from '../../lib/forms.js';
import { NumberField } from '../ui/Field.jsx';

/** °C or °F value → °C for the API (1 decimal). */
export const toCelsius = (value, unit) => roundTo(unit === 'F' ? convert.fToC(value) : value, 1);

/**
 * Temperature with its own °C / °F switch (starts from the rider's units, can be flipped per ride).
 * Flipping converts what's already typed.
 */
export function TemperatureInput({ label, value, unit, onChange, onUnitChange, error, hint }) {
  function switchUnit(next) {
    if (next === unit) return;
    const n = parseNumber(value);
    if (n !== undefined && !isInvalidNumber(n)) {
      const converted = next === 'F' ? convert.cToF(n) : convert.fToC(n);
      onChange(String(Math.round(converted)));
    }
    onUnitChange(next);
  }

  return (
    <NumberField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={hint}
      inputMode="decimal"
      trailing={
        <span className="unit-toggle" role="group" aria-label="Temperature unit">
          {['C', 'F'].map((u) => (
            <button
              key={u}
              type="button"
              className={`unit-toggle__btn ${unit === u ? 'unit-toggle__btn--on' : ''}`}
              aria-pressed={unit === u}
              onClick={() => switchUnit(u)}
            >
              °{u}
            </button>
          ))}
        </span>
      }
    />
  );
}
