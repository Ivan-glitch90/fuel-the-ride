import { Link } from 'react-router';

export function LegalLinks() {
  return (
    <p className="legal-links">
      <Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms of Use</Link>
    </p>
  );
}
