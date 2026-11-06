import { useId, useState } from 'react';
import { formatDuration } from '../../lib/format.js';

const parseWhole = (text) => (text.trim() === '' ? 0 : Number(text));

/**
 * Duration as hours + minutes you can type, with − / + buttons for quick 15-minute steps.
 * Calls onChange(totalMinutes), or onChange(null) while what's typed isn't a valid duration.
 */
export function DurationInput({ label = 'Duration', value, onChange, min = 15, max = 720, step = 15 }) {
  const groupId = useId();
  const errorId = `${groupId}-error`;
  const [hours, setHours] = useState(() => String(Math.floor((value ?? 0) / 60)));
  const [minutes, setMinutes] = useState(() => String((value ?? 0) % 60));
  const [error, setError] = useState(null);

  function setTotal(total) {
    setHours(String(Math.floor(total / 60)));
    setMinutes(String(total % 60));
    setError(null);
    onChange(total);
  }

  function handleTyped(nextHours, nextMinutes) {
    setHours(nextHours);
    setMinutes(nextMinutes);
    const h = parseWhole(nextHours);
    const m = parseWhole(nextMinutes);
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) {
      setError('Enter whole hours and minutes (0–59)');
      onChange(null);
      return;
    }
    const total = h * 60 + m;
    if (total < min || total > max) {
      setError(`Between ${formatDuration(min)} and ${formatDuration(max)}`);
      onChange(null);
      return;
    }
    setError(null);
    onChange(total);
  }

  const base = value ?? min;
  return (
    <div className={`duration ${error ? 'field--error' : ''}`} role="group" aria-labelledby={groupId}>
      <span id={groupId} className="field__label">
        {label}
      </span>
      <div className="duration__controls">
        <button
          type="button"
          className="stepper__btn"
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={() => setTotal(Math.max(min, base - step))}
          disabled={value !== null && value <= min}
        >
          −
        </button>
        <label className="duration__part">
          <input
            className="duration__input"
            inputMode="numeric"
            aria-label="Hours"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            value={hours}
            onChange={(e) => handleTyped(e.target.value, minutes)}
            onFocus={(e) => e.target.select()}
          />
          <span aria-hidden="true">h</span>
        </label>
        <label className="duration__part">
          <input
            className="duration__input"
            inputMode="numeric"
            aria-label="Minutes"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            value={minutes}
            onChange={(e) => handleTyped(hours, e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          <span aria-hidden="true">min</span>
        </label>
        <button
          type="button"
          className="stepper__btn"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => setTotal(Math.min(max, base + step))}
          disabled={value !== null && value >= max}
        >
          +
        </button>
      </div>
      {error && (
        <p id={errorId} className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
