import { t } from '../../i18n/index.js';

export function LoadingScreen({ label }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="loading__spinner" aria-hidden="true" />
      <span>{label ?? t('Loading…')}</span>
    </div>
  );
}
