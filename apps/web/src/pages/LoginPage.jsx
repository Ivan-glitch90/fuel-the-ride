import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, PasswordField } from '../components/ui/Field.jsx';
import { Notice } from '../components/ui/Notice.jsx';

export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  // Navigate only once the session shows up in shared state, so the route guards agree
  if (loggedIn && user) return <Navigate to={location.state?.from?.pathname ?? '/'} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(form);
      setLoggedIn(true);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <h1 className="auth-page__brand">Fuel the Ride</h1>
      <p className="auth-page__tagline">How much to eat for your ride, using the foods you already eat.</p>
      <form className="form card" onSubmit={handleSubmit} noValidate>
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
      <p className="auth-page__switch">
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </div>
  );
}
