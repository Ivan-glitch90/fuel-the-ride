import { useState } from 'react';
import { Link } from 'react-router';
import { forgotPassword } from '../api/auth.js';
import { fieldErrors } from '../api/client.js';
import { Button } from '../components/ui/Button.jsx';
import { Field } from '../components/ui/Field.jsx';
import { Notice } from '../components/ui/Notice.jsx';

/** /forgot-password: always the same answer, so the page can't reveal who has an account. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <h1 className="auth-page__brand">Fuel the Ride</h1>
      <div className="card">
        {sent ? (
          <div className="form">
            <h2>Check your email</h2>
            <p>
              If <strong>{email}</strong> belongs to an account with a confirmed email, we&apos;ve sent a link to choose a
              new password. It works for 1 hour.
            </p>
            <p className="muted small">Nothing arrived? Check your spam folder, or confirm your email first.</p>
          </div>
        ) : (
          <form className="form" onSubmit={handleSubmit} noValidate>
            <h2>Forgot your password?</h2>
            <p className="muted">Enter your email and we&apos;ll send you a link to choose a new one.</p>
            {error && !fieldErrors(error).email && <Notice tone="error">{error.message}</Notice>}
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors(error).email}
            />
            <Button type="submit" block loading={submitting}>
              Send reset link
            </Button>
          </form>
        )}
      </div>
      <p className="auth-page__switch">
        <Link to="/login">Back to log in</Link>
      </p>
    </div>
  );
}
