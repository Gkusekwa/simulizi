import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { LibraryItem } from '../api/types';
import { Icon } from '../components/Icon';
import { Cover } from '../components/WorkRow';

export function LibraryPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'reading' | 'finished'>('reading');
  const q = useQuery({ queryKey: ['library'], queryFn: () => api<{ items: LibraryItem[] }>('/library') });
  const items = (q.data?.items ?? []).filter((i) => (tab === 'finished' ? i.done : !i.done));

  return (
    <>
      <p className="eyebrow">{t('library.eyebrow')}</p>
      <h1>{t('library.title')}</h1>
      <div className="tabs" style={{ marginTop: 18 }}>
        <button type="button" className={tab === 'reading' ? 'active' : ''} onClick={() => setTab('reading')}>{t('library.reading')}</button>
        <button type="button" className={tab === 'finished' ? 'active' : ''} onClick={() => setTab('finished')}>{t('library.finished')}</button>
      </div>
      {q.isLoading && <p className="muted" style={{ marginTop: 12 }}>{t('common.loading')}</p>}
      {q.data && items.length === 0 && (
        <div className="empty">
          <Icon name="library" />
          <h3>{t('library.empty')}</h3>
          <Link className="btn" to="/"><Icon name="search" size={14} /> {t('library.emptyCta')}</Link>
        </div>
      )}
      {items.map((i) => {
        const pos = i.current?.position ?? 1;
        const pct = i.current ? Math.round(i.current.fraction * 100) : 0;
        return (
          <Link key={i.work.id} className="row" to={`/w/${i.work.slug}/${pos}`}>
            <Cover work={i.work} />
            <div className="row-copy">
              <h3>{i.work.title}</h3>
              <p className="muted">{i.work.owner.displayName}</p>
              <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('common.partOf', { n: pos, total: i.totalParts })}>
                <i style={{ width: `${pct}%` }} />
              </div>
              <p className="muted">{t('common.partOf', { n: pos, total: i.totalParts })}{i.unread > 0 ? ` · ${t('library.unread', { count: i.unread })}` : ''}</p>
            </div>
            {i.unread > 0 && i.current && <span className="pill"><Icon name="bell" size={14} /> {t('library.newPart')}</span>}
            <Icon name="chevron" className="chev" />
          </Link>
        );
      })}
    </>
  );
}
