import { useId, useState } from 'react';

/**
 * Labelled input with hint and error text wired up for screen readers.
 * Extra props go to the <input>. Pass `suffix` for a unit ("g", "kcal") or `trailing` for a button.
 * `label` can be a node, e.g. an acronym with its meaning.
 */
export function Field({ label, hint, error, suffix, trailing, id, className = '', ...inputProps }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="field__control">
        <input
          id={inputId}
          className="field__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          {...inputProps}
        />
        {suffix && <span className="field__suffix">{suffix}</span>}
        {trailing}
      </div>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Numeric field: brings up the number keypad on phones. */
export function NumberField(props) {
  return <Field type="text" inputMode="decimal" autoComplete="off" {...props} />;
}

/**
 * Password field with a Show/Hide button. Stays a real password field while hidden,
 * so password managers can save and fill it.
 */
export function PasswordField(props) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          className="field__toggle"
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      }
    />
  );
}

/** "LTHR (lactate threshold heart rate)": the acronym, then its meaning in grey. */
export function Acronym({ short, long }) {
  return (
    <>
      {short} <span className="field__label-long">({long})</span>
    </>
  );
}
