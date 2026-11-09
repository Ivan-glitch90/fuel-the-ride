import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { BackIcon } from '../components/ui/icons.jsx';
import { LEGAL, POLICY_VERSION } from './legalConfig.js';

const VERSION_DATE = new Date(`${POLICY_VERSION}T12:00:00`).toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

/** A value from legalConfig, or a highlighted placeholder while it's not filled in. */
export function Fill({ field, label }) {
  const value = LEGAL[field];
  if (value) return <>{value}</>;
  return <mark className="legal-placeholder">[{label}]</mark>;
}

export function ContactEmail() {
  return LEGAL.contactEmail ? <span className="legal-email">{LEGAL.contactEmail}</span> : <Fill field="contactEmail" label="contact email" />;
}

/** Shared frame for /privacy and /terms: readable on a phone, reachable logged in or out. */
export function LegalPage({ title, children }) {
  const { user } = useAuth();
  return (
    <div className="legal-page">
      <Link to={user ? '/settings' : '/login'} className="legal-page__back">
        <BackIcon /> Back
      </Link>
      <article>
        <h1>{title}</h1>
        <p className="muted">
          Version {POLICY_VERSION} · effective {VERSION_DATE}
        </p>
        {children}
      </article>
      <p className="legal-page__switch">
        <Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms of Use</Link>
      </p>
    </div>
  );
}
