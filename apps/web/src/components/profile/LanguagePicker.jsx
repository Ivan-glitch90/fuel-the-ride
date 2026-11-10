import { useUpdateProfile } from '../../hooks/useProfile.js';
import { hasLanguageChoice, LANGUAGES, setLanguage, t, useLanguage } from '../../i18n/index.js';
import { SegmentedControl } from '../ui/SegmentedControl.jsx';

/**
 * Profile → Language. Each option is written in its own language, so it's findable either way.
 * Saved on this device (switches at once) and on the account (emails use it).
 */
export function LanguagePicker() {
  const language = useLanguage();
  const update = useUpdateProfile();

  function choose(code) {
    update.mutate({ language: code }); // best effort: the switch itself never waits for the server
    setLanguage(code);
  }

  return (
    <section className="form__section" aria-labelledby="language-title">
      <h2 id="language-title">{t('Language')}</h2>
      <SegmentedControl
        label={t('Language')}
        options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
        value={language}
        onChange={choose}
      />
      <p className="field__hint">
        {hasLanguageChoice() ? t('Saved on this device.') : t('Following your phone’s language until you pick one.')}
      </p>
    </section>
  );
}
