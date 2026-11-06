import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { fieldErrors } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { GoogleSignIn } from '../components/auth/GoogleSignIn.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, PasswordField } from '../components/ui/Field.jsx';
import { Notice } from '../components/ui/Notice.jsx';

const TO_PROFILE = { to: '/settings', state: { welcome: true } };

export function SignupPage() {
  const { user, register, loginWithGoogle } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
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
    setSubmitting(true);
    setError(null);
    try {
      await register(form);
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
          <Button type="submit" block loading={submitting}>
            Create account
          </Button>
        </form>
        <GoogleSignIn onCredential={handleGoogle} />
      </div>
      <p className="auth-page__switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
