import { useId } from 'react';

/** Big tap-friendly radio group: one choice from a few options. */
export function SegmentedControl({ label, options, value, onChange, error }) {
  const name = useId();
  return (
    <fieldset className={`segmented ${error ? 'field--error' : ''}`}>
      <legend className="field__label">{label}</legend>
      <div className="segmented__options">
        {options.map((option) => (
          <label key={option.value} className="segmented__option">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
