import { t } from '../../i18n/index.js';
import { setThemeChoice, useTheme } from '../../lib/theme.js';

/** Profile → Appearance: a Material 3 switch for dark mode. Saved on this device. */
export function Appearance() {
  const { dark, choice } = useTheme();
  return (
    <section className="form__section" aria-labelledby="appearance-title">
      <h2 id="appearance-title">{t('Appearance')}</h2>
      <label className="switch-row">
        <span className="switch-row__text">
          <span className="switch-row__label">{t('Dark mode')}</span>
          <span className="field__hint" id="dark-mode-hint">
            {choice ? t('Saved on this device.') : t('Following your phone’s setting until you switch it.')}
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
          {t('Match my phone’s setting')}
        </button>
      )}
    </section>
  );
}
