import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { fieldErrors } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { GoogleSignIn } from '../components/auth/GoogleSignIn.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, PasswordField } from '../components/ui/Field.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { MIN_AGE } from '../legal/legalConfig.js';
import { LegalLinks } from '../legal/LegalLinks.jsx';

const TO_PROFILE = { to: '/settings', state: { welcome: true } };

export function SignupPage() {
  const { user, register, loginWithGoogle } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [next, setNext] = useState(null); // where to go once logged in

  // First stop after signup: the profile, because plans need the rider's weight.
  // Navigate only once the session shows up in shared state, so the route guards agree.
  if (next && user) return <Navigate to={next.to} replace state={next.state} />;

  const errors = fieldErrors(error);
  if (error?.code === 'EMAIL_TAKEN') errors.email = error.message;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!acceptTerms) {
      setTermsError('Please confirm to create your account');
      return;
    }
    setTermsError(null);
    setSubmitting(true);
    setError(null);
    try {
      await register({ ...form, acceptTerms: true });
      setNext(TO_PROFILE);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  async function handleGoogle(credential) {
    setError(null);
    try {
      const { created } = await loginWithGoogle(credential);
      setNext(created ? TO_PROFILE : { to: '/' }); // already had an account → straight in
    } catch (err) {
      setError(err);
    }
  }

  const hasFieldErrors = Object.keys(errors).length > 0;
  return (
    <div className="auth-page">
      <h1 className="auth-page__brand">Fuel the Ride</h1>
      <div className="card">
        <form className="form" onSubmit={handleSubmit} noValidate>
          <h2>Create your account</h2>
          {error && !hasFieldErrors && <Notice tone="error">{error.message}</Notice>}
          <Field label="Name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            error={errors.email}
          />
          <PasswordField
            label="Password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={errors.password}
            hint="At least 8 characters"
          />
          <div className={`field ${termsError || errors.acceptTerms ? 'field--error' : ''}`}>
            <label className="checkbox checkbox--top">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                aria-describedby={termsError || errors.acceptTerms ? 'terms-error' : undefined}
              />
              <span>
                I&apos;m {MIN_AGE} or older and agree to the <Link to="/terms">Terms</Link> and{' '}
                <Link to="/privacy">Privacy Policy</Link>, including the use of my health data (weight, heart rate, what I
                eat) to plan my fueling.
              </span>
            </label>
            {(termsError || errors.acceptTerms) && (
              <p id="terms-error" className="field__error" role="alert">
                {termsError ?? errors.acceptTerms}
              </p>
            )}
          </div>
          <Button type="submit" block loading={submitting}>
            Create account
          </Button>
        </form>
        <GoogleSignIn onCredential={handleGoogle} />
      </div>
      <p className="auth-page__switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
      <LegalLinks />
    </div>
  );
}
