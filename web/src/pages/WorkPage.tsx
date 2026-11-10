import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import type { WorkPage as WorkPageData } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { Cover } from '../components/WorkRow';
import { count, formatWhen } from '../lib/format';

export function WorkPage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['work', slug], queryFn: () => api<WorkPageData>(`/works/${slug}`) });
  const follow = useMutation({
    mutationFn: (on: boolean) => api(`/works/${slug}/follow`, { method: on ? 'PUT' : 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['work', slug] });
      void qc.invalidateQueries({ queryKey: ['library'] });
    },
  });

  if (q.isLoading) return <p className="muted">{t('common.loading')}</p>;
  if (q.error) return <p className="muted">{(q.error as ApiError).status === 404 ? t('errors.notFound') : t('common.error')}</p>;
  const w = q.data!;
  const publicParts = w.parts.filter((p) => p.state === 'public');
  const current = w.parts.find((p) => p.progress && !p.progress.finished) ?? publicParts.find((p) => !p.progress?.finished);
  const startPos = current?.position ?? publicParts[0]?.position;

  return (
    <article>
      <div style={{ display: 'flex', gap: 17, alignItems: 'center' }}>
        <Cover work={{ ...w, ownerName: w.owner.displayName }} large />
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">{t('common.language.' + w.language)}{w.genre ? ` · ${w.genre}` : ''} · {t('work.status.' + w.status)}</p>
          <h1 style={{ fontSize: 24 }}>{w.title}</h1>
          <p className="muted"><Link to={`/@${w.owner.handle}`}>{t('work.by', { name: w.owner.displayName })}</Link></p>
          <p className="muted" style={{ marginTop: 8 }}>{t('work.readers', { count: w.readers })} · {t('work.followers', { count: count(w.followers) })}</p>
          {w.rating !== 'general' && <span className="pill warn" style={{ marginTop: 6 }}>{t('work.rating.' + w.rating)}</span>}
        </div>
      </div>

      <div className="actions">
        {startPos !== undefined && (
          <Link className="btn primary" to={`/w/${slug}/${startPos}`}>
            {current?.progress ? t('work.continueReading', { n: startPos }) : t('work.startReading')}
          </Link>
        )}
        <button
          className={`btn${w.following ? ' primary' : ''}`}
          type="button"
          disabled={follow.isPending}
          onClick={() => (user ? follow.mutate(!w.following) : nav('/login'))}
        >
          {w.following ? <Icon name="check" size={14} /> : <Icon name="plus" size={14} />} {w.following ? t('work.following') : t('work.follow')}
        </button>
        {w.isOwner && <Link className="btn" to={`/studio/works/${w.id}`}><Icon name="pen" size={14} /> {t('studio.edit')}</Link>}
      </div>

      {w.synopsis && <p style={{ marginTop: 16, color: 'var(--muted)', lineHeight: 1.55 }}>{w.synopsis}</p>}

      <div className="section-title">
        <h3>{t('work.parts')}</h3>
        <span className="muted">
          {t('work.released', { public: publicParts.length, total: w.parts.length })} · {t('work.plan.' + w.releasePlan)}
        </span>
      </div>
      {w.parts.map((p) => {
        const done = p.progress?.finished;
        if (p.state !== 'public') {
          return (
            <div className="part-row" key={p.id} style={{ color: 'var(--muted)' }}>
              <div style={{ flex: 1 }}>
                <h3>{p.position}. {p.title}</h3>
                <small><Icon name="clock" size={14} /> {t('work.scheduled', { when: formatWhen(p.publicAt) })}</small>
              </div>
            </div>
          );
        }
        return (
          <Link className="part-row" key={p.id} to={`/w/${slug}/${p.position}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ flex: 1 }}>
              <h3>{p.position}. {p.title}</h3>
              <small>{t('common.readMinutes', { count: p.readMinutes })}{p.likes !== undefined ? ` · ♡ ${count(p.likes)}` : ''}</small>
            </div>
            {done ? (
              <span className="pill"><Icon name="check" size={14} /> {t('work.read')}</span>
            ) : p.progress ? (
              <span className="muted">{Math.round(p.progress.fraction * 100)}%</span>
            ) : null}
            <Icon name="chevron" className="chev" />
          </Link>
        );
      })}
    </article>
  );
}
