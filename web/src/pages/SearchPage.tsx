import { useQuery } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { WorkCard } from '../api/types';
import { Icon } from '../components/Icon';
import { WorkRow } from '../components/WorkRow';

export function SearchPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [input, setInput] = useState(q);
  const results = useQuery({
    queryKey: ['search', q],
    queryFn: () => api<WorkCard[]>(`/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 1,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setParams(input.trim() ? { q: input.trim() } : {});
  };
  return (
    <>
      <h1>{t('nav.search')}</h1>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 14 }} role="search">
        <input className="field" type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('search.placeholder')} aria-label={t('nav.search')} autoFocus />
        <button className="btn primary" type="submit"><Icon name="search" /></button>
      </form>
      {results.isLoading && <p className="muted" style={{ marginTop: 12 }}>{t('common.loading')}</p>}
      {results.data && results.data.length === 0 && <p className="muted" style={{ marginTop: 12 }}>{t('search.none', { q })}</p>}
      {results.data?.map((w) => <WorkRow key={w.id} work={w} />)}
      {!q && <p className="muted" style={{ marginTop: 12 }}>{t('search.hint')}</p>}
    </>
  );
}
