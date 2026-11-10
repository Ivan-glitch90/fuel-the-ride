import { Link } from 'react-router';
import { t } from '../../i18n/index.js';
import { BackIcon } from '../ui/icons.jsx';

export function PageHeader({ title, backTo, action }) {
  return (
    <div className="page-header">
      {backTo && (
        <Link to={backTo} className="icon-btn" aria-label={t('Back')}>
          <BackIcon />
        </Link>
      )}
      <h1 className="page-header__title">{title}</h1>
      {action}
    </div>
  );
}
