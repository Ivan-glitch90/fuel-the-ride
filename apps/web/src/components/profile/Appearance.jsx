import { setThemeChoice, useTheme } from '../../lib/theme.js';

/** Profile → Appearance: a Material 3 switch for dark mode. Saved on this device. */
export function Appearance() {
  const { dark, choice } = useTheme();
  return (
    <section className="form__section" aria-labelledby="appearance-title">
      <h2 id="appearance-title">Appearance</h2>
      <label className="switch-row">
        <span className="switch-row__text">
          <span className="switch-row__label">Dark mode</span>
          <span className="field__hint" id="dark-mode-hint">
            {choice ? 'Saved on this device.' : 'Following your phone’s setting until you switch it.'}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={dark}
          aria-describedby="dark-mode-hint"
          onChange={(e) => setThemeChoice(e.target.checked ? 'dark' : 'light')}
        />
      </label>
      {choice && (
        <button type="button" className="link-btn appearance__reset" onClick={() => setThemeChoice(null)}>
          Match my phone’s setting
        </button>
      )}
    </section>
  );
}
