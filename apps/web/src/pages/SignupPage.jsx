import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { fieldErrors } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, PasswordField } from '../components/ui/Field.jsx';
import { Notice } from '../components/ui/Notice.jsx';

export function SignupPage() {
  const { user, register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  // First stop after signup: the profile, because plans need the rider's weight.
  // Navigate only once the session shows up in shared state, so the route guards agree.
  if (registered && user) return <Navigate to="/settings" replace state={{ welcome: true }} />;

  const errors = fieldErrors(error);
  if (error?.code === 'EMAIL_TAKEN') errors.email = error.message;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register(form);
      setRegistered(true);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  const hasFieldErrors = Object.keys(errors).length > 0;
  return (
    <div className="auth-page">
      <h1 className="auth-page__brand">Fuel the Ride</h1>
      <form className="form card" onSubmit={handleSubmit} noValidate>
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
      <p className="auth-page__switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
