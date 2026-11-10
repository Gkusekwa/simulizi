import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { LangToggle } from '../components/Layout';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 440, margin: '0 auto', padding: '20px 16px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <Link className="logo" to="/"><span className="logo-mark">S</span>simulizi</Link>
        <LangToggle />
      </div>
      {children}
    </div>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const from = (loc.state as { from?: string } | null)?.from ?? '/';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      nav(from, { replace: true });
    } catch (err) {
      const a = err as ApiError;
      setError(a.status === 401 ? t('errors.auth') : a.status === 0 ? t('errors.network') : a.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <p className="eyebrow">{t('auth.welcome')}</p>
      <h1>{t('auth.title')}</h1>
      <p className="muted" style={{ marginTop: 9 }}>{t('auth.subtitle')}</p>
      <Link className="btn" to="/" style={{ width: '100%', marginTop: 18, minHeight: 44 }}>
        <Icon name="bookopen" /> {t('auth.browse')}
      </Link>
      <p className="muted" style={{ textAlign: 'center', margin: '16px 0 4px' }}>{t('auth.orSignIn')}</p>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="email">{t('auth.email')}</label>
        <input className="field" id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="field-label" htmlFor="password">{t('auth.password')}</label>
        <input className="field" id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 17 }}>
          {busy ? t('auth.signingIn') : t('auth.signin')}
        </button>
      </form>
      <p className="muted" style={{ textAlign: 'center', marginTop: 18 }}>
        {t('auth.newHere')} <Link to="/signup">{t('auth.signup')}</Link>
      </p>
    </AuthShell>
  );
}
