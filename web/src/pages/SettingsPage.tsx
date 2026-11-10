import { useMutation, useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import type { Language, Me } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';

type MeFull = Me & { emailOnRelease: boolean; pushOnRelease: boolean; analyticsOptOut: boolean; birthYear: number | null };

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { logout, refreshMe } = useAuth();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['me'], queryFn: () => api<MeFull>('/me') });
  const [form, setForm] = useState({ displayName: '', bio: '', uiLanguage: 'sw' as Language, profilePublic: false, mature: false, emailOnRelease: true, analyticsOptOut: false });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (q.data) {
      setForm({
        displayName: q.data.displayName,
        bio: q.data.bio ?? '',
        uiLanguage: q.data.uiLanguage,
        profilePublic: q.data.profilePublic,
        mature: !!q.data.mature,
        emailOnRelease: q.data.emailOnRelease,
        analyticsOptOut: q.data.analyticsOptOut,
      });
    }
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => api('/me', { method: 'PATCH', json: form }),
    onSuccess: async () => {
      setSaved(true);
      await i18n.changeLanguage(form.uiLanguage);
      await refreshMe();
    },
  });
  const adult = q.data?.birthYear ? new Date().getFullYear() - q.data.birthYear >= 18 : false;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    save.mutate();
  };
  if (q.isLoading) return <p className="muted">{t('common.loading')}</p>;

  const Toggle = ({ k, label, hint, disabled }: { k: keyof typeof form; label: string; hint?: string; disabled?: boolean }) => (
    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
      <input type="checkbox" checked={!!form[k]} disabled={disabled} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} style={{ width: 20, height: 20, marginTop: 2 }} />
      <span><b style={{ fontWeight: 500 }}>{label}</b>{hint && <><br /><span className="muted">{hint}</span></>}</span>
    </label>
  );

  return (
    <form onSubmit={submit} style={{ maxWidth: 560 }}>
      <p className="eyebrow">{t('settings.eyebrow')}</p>
      <h1>{t('settings.title')}</h1>
      <label className="field-label" htmlFor="displayName">{t('auth.displayName')}</label>
      <input className="field" id="displayName" maxLength={60} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
      <label className="field-label" htmlFor="bio">{t('settings.bio')}</label>
      <textarea className="field" id="bio" maxLength={300} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} style={{ minHeight: 80 }} />
      <label className="field-label" htmlFor="lang">{t('settings.uiLanguage')}</label>
      <select className="field" id="lang" value={form.uiLanguage} onChange={(e) => setForm({ ...form, uiLanguage: e.target.value as Language })}>
        <option value="sw">{t('common.language.sw')}</option>
        <option value="en">{t('common.language.en')}</option>
      </select>
      <div style={{ marginTop: 18 }}>
        <Toggle k="profilePublic" label={t('settings.profilePublic')} hint={t('settings.profilePublicHint')} disabled={!adult} />
        <Toggle k="emailOnRelease" label={t('settings.emailOnRelease')} hint={t('settings.emailOnReleaseHint')} />
        <Toggle k="mature" label={t('settings.mature')} hint={adult ? t('settings.matureHint') : t('settings.matureMinor')} disabled={!adult} />
        <Toggle k="analyticsOptOut" label={t('settings.analyticsOptOut')} hint={t('settings.analyticsOptOutHint')} />
      </div>
      {save.error && <p className="form-error">{(save.error as ApiError).message}</p>}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={save.isPending}><Icon name="check" size={14} /> {t('common.save')}</button>
        {saved && <span className="pill">{t('settings.saved')}</span>}
        <span style={{ flex: 1 }} />
        <button className="btn" type="button" onClick={() => void logout().then(() => nav('/'))}><Icon name="logout" size={14} /> {t('nav.signout')}</button>
      </div>
    </form>
  );
}
