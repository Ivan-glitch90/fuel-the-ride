import { useId } from 'react';

/** − value + control with big buttons. No typing needed: good with gloves or one hand. */
export function Stepper({ label, value, onChange, step = 1, min = -Infinity, max = Infinity, format = String }) {
  const labelId = useId();
  const change = (delta) => onChange(Math.min(max, Math.max(min, value + delta)));
  return (
    <div className="stepper" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="field__label">
        {label}
      </span>
      <div className="stepper__controls">
        <button
          type="button"
          className="stepper__btn"
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={() => change(-step)}
          disabled={value <= min}
        >
          −
        </button>
        <output className="stepper__value" aria-live="polite">
          {format(value)}
        </output>
        <button
          type="button"
          className="stepper__btn"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => change(step)}
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  );
}
