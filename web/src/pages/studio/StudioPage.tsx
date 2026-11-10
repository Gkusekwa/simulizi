import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import type { Language, StudioWork } from '../../api/types';
import { EpubUpload } from '../../components/EpubUpload';
import { Icon } from '../../components/Icon';
import { Cover } from '../../components/WorkRow';

export function StudioPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['studio', 'works'], queryFn: () => api<StudioWork[]>('/studio/works') });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', language: (i18n.language === 'en' ? 'en' : 'sw') as Language, kind: 'series' as 'series' | 'single', rating: 'general' as 'general' | 'teen' | 'mature' });
  const create = useMutation({
    mutationFn: () => api<StudioWork>('/studio/works', { method: 'POST', json: form }),
    onSuccess: (w) => {
      void qc.invalidateQueries({ queryKey: ['studio', 'works'] });
      nav(`/studio/works/${w.id}`);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.title.trim()) create.mutate();
  };

  return (
    <>
      <p className="eyebrow">{t('studio.title')}</p>
      <div className="section-title" style={{ marginTop: 0 }}>
        <h1>{t('studio.myWorks')}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <EpubUpload onDone={(w) => { void qc.invalidateQueries({ queryKey: ['studio', 'works'] }); nav(`/studio/works/${w.id}`); }} />
          <button className="btn primary small" type="button" onClick={() => setOpen((o) => !o)}><Icon name="plus" size={14} /> {t('studio.newWork')}</button>
        </div>
      </div>
      {open && (
        <form className="card" onSubmit={submit} style={{ marginBottom: 16 }}>
          <label className="field-label" htmlFor="title" style={{ marginTop: 0 }}>{t('studio.workTitle')}</label>
          <input className="field" id="title" required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <div>
              <label className="field-label" htmlFor="lang">{t('studio.language')}</label>
              <select className="field" id="lang" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as Language })}>
                <option value="sw">{t('common.language.sw')}</option>
                <option value="en">{t('common.language.en')}</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="kind">{t('studio.kind')}</label>
              <select className="field" id="kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'series' | 'single' })}>
                <option value="series">{t('work.kind.series')}</option>
                <option value="single">{t('work.kind.single')}</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="rating">{t('studio.rating')}</label>
              <select className="field" id="rating" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value as 'general' | 'teen' | 'mature' })}>
                <option value="general">{t('work.rating.general')}</option>
                <option value="teen">{t('work.rating.teen')}</option>
                <option value="mature">{t('work.rating.mature')}</option>
              </select>
            </div>
          </div>
          {create.error && <p className="form-error">{(create.error as ApiError).message}</p>}
          <div className="actions">
            <button className="btn primary" type="submit" disabled={create.isPending}>{t('common.save')}</button>
            <button className="btn" type="button" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      )}
      {q.isLoading && <p className="muted">{t('common.loading')}</p>}
      {q.data?.length === 0 && !open && (
        <div className="empty"><Icon name="pen" /><h3>{t('studio.empty')}</h3></div>
      )}
      {q.data?.map((w) => (
        <Link key={w.id} className="row" to={`/studio/works/${w.id}`}>
          <Cover work={w} />
          <div className="row-copy">
            <h3>{w.title}</h3>
            <p className="muted">{t('work.status.' + w.status)} · {t('work.plan.' + w.releasePlan)} · {w._count?.parts ?? 0} {t('work.parts').toLowerCase()} · {w._count?.follows ?? 0} {t('work.followers', { count: '' }).trim()}</p>
          </div>
          <Icon name="chevron" className="chev" />
        </Link>
      ))}
    </>
  );
}
