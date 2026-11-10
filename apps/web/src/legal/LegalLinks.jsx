import { Link } from 'react-router';
import { t } from '../i18n/index.js';

export function LegalLinks() {
  return (
    <p className="legal-links">
      <Link to="/privacy">{t('Privacy Policy')}</Link> · <Link to="/terms">{t('Terms of Use')}</Link>
    </p>
  );
}
