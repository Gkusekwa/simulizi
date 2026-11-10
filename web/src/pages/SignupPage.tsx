import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AuthShell } from './LoginPage';

export function SignupPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', handle: '', displayName: '', birthYear: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({ ...form, handle: form.handle.toLowerCase().replace(/^@/, ''), birthYear: Number(form.birthYear) });
      nav('/', { replace: true });
    } catch (err) {
      const a = err as ApiError;
      setError(a.status === 0 ? t('errors.network') : a.message);
    } finally {
      setBusy(false);
    }
  };
  const year = new Date().getFullYear();

  return (
    <AuthShell>
      <p className="eyebrow">{t('auth.welcome')}</p>
      <h1>{t('auth.signup')}</h1>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="displayName">{t('auth.displayName')}</label>
        <input className="field" id="displayName" required maxLength={60} value={form.displayName} onChange={set('displayName')} />
        <label className="field-label" htmlFor="handle">{t('auth.handle')}</label>
        <input className="field" id="handle" required pattern="@?[a-z0-9_]{3,30}" autoCapitalize="none" value={form.handle} onChange={set('handle')} />
        <label className="field-label" htmlFor="email">{t('auth.email')}</label>
        <input className="field" id="email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        <label className="field-label" htmlFor="password">{t('auth.password')}</label>
        <input className="field" id="password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} />
        <label className="field-label" htmlFor="birthYear">{t('auth.birthYear')}</label>
        <input className="field" id="birthYear" type="number" inputMode="numeric" required min={year - 120} max={year - 13} value={form.birthYear} onChange={set('birthYear')} />
        <p className="muted" style={{ marginTop: 6 }}>{t('auth.ageNote')}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 17 }}>
          {busy ? t('auth.creating') : t('auth.signup')}
        </button>
      </form>
      <p className="muted" style={{ textAlign: 'center', marginTop: 18 }}>
        {t('auth.haveAccount')} <Link to="/login">{t('auth.signin')}</Link>
      </p>
    </AuthShell>
  );
}
