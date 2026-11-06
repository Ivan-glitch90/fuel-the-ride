import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { GoogleSignIn } from '../components/auth/GoogleSignIn.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, PasswordField } from '../components/ui/Field.jsx';
import { Notice } from '../components/ui/Notice.jsx';

export function LoginPage() {
  const { user, login, loginWithGoogle } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [next, setNext] = useState(null); // where to go once logged in

  const returnTo = { to: location.state?.from?.pathname ?? '/' };

  // Navigate only once the session shows up in shared state, so the route guards agree
  if (next && user) return <Navigate to={next.to} replace state={next.state} />;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(form);
      setNext(returnTo);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  async function handleGoogle(credential) {
    setError(null);
    try {
      const { created } = await loginWithGoogle(credential);
      // A brand-new rider starts at their profile, same as email signup
      setNext(created ? { to: '/settings', state: { welcome: true } } : returnTo);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <div className="auth-page">
      <h1 className="auth-page__brand">Fuel the Ride</h1>
      <p className="auth-page__tagline">How much to eat for your ride, using the foods you already eat.</p>
      <div className="card">
        <form className="form" onSubmit={handleSubmit} noValidate>
          <h2>Log in</h2>
          {error && <Notice tone="error">{error.message}</Notice>}
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <PasswordField
            label="Password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Button type="submit" block loading={submitting}>
            Log in
          </Button>
        </form>
        <GoogleSignIn onCredential={handleGoogle} />
      </div>
      <p className="auth-page__switch">
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </div>
  );
}
