import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { LibraryItem, WorkCard } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { Cover, WorkRow } from '../components/WorkRow';
import { formatDate } from '../lib/format';

export function HomePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const discover = useQuery({ queryKey: ['discover'], queryFn: () => api<{ latest: WorkCard[]; trending: WorkCard[] }>('/discover') });
  const library = useQuery({
    queryKey: ['library'],
    queryFn: () => api<{ items: LibraryItem[]; continueReading: LibraryItem | null }>('/library'),
    enabled: !!user,
  });
  const cont = library.data?.continueReading;

  return (
    <>
      <p className="eyebrow">{formatDate(new Date().toISOString())}</p>
      {user ? (
        <>
          <h1>{t('home.greeting', { name: user.displayName.split(' ')[0] })}</h1>
          <p className="muted" style={{ marginTop: 5 }}>{t('home.subtitle')}</p>
        </>
      ) : (
        <>
          <h1>{t('home.guestTitle')}</h1>
          <p className="muted" style={{ marginTop: 5, maxWidth: 520 }}>{t('home.guestSubtitle')}</p>
        </>
      )}

      {cont && (
        <section className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 16 }}>
          <Cover work={{ ...cont.work, ownerName: cont.work.owner.displayName }} large />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="eyebrow">{t('home.continue')}</p>
            <h2>{cont.work.title}</h2>
            <p className="muted">{t('common.partOf', { n: cont.current!.position, total: cont.totalParts })} · {cont.work.owner.displayName}</p>
            <div className="progress" role="progressbar" aria-valuenow={Math.round(cont.current!.fraction * 100)} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${Math.round(cont.current!.fraction * 100)}%` }} />
            </div>
            <Link className="btn primary small" to={`/w/${cont.work.slug}/${cont.current!.position}`}>
              {t('home.continue')} <Icon name="chevron" size={14} />
            </Link>
          </div>
        </section>
      )}

      <div className="section-title">
        <h3>{t('home.recent')}</h3>
      </div>
      {discover.isLoading && <Skeleton />}
      {discover.data && discover.data.latest.length === 0 && (
        <p className="muted">
          <Trans i18nKey="home.empty" values={{ link: t('home.emptyLink') }} components={{ link: <Link to="/studio" /> }}>
            {'Nothing published yet. '}<Link to="/studio">{t('home.emptyLink')}</Link>
          </Trans>
        </p>
      )}
      {discover.data?.latest.map((w) => <WorkRow key={w.id} work={w} />)}

      {discover.data && discover.data.trending.length > 1 && (
        <>
          <div className="section-title"><h3>{t('home.trending')}</h3></div>
          {discover.data.trending.slice(0, 5).map((w) => (
            <WorkRow key={w.id} work={w} note={`${w._count.follows} ${i18n.language === 'en' ? 'followers' : 'wafuasi'}`} />
          ))}
        </>
      )}
    </>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="row" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="sk" style={{ width: 48, height: 72 }} />
          <div style={{ flex: 1, display: 'grid', gap: 8 }}>
            <div className="sk" style={{ height: 12, width: '60%' }} />
            <div className="sk" style={{ height: 12, width: '40%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
