import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import type { WorkCard } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { ReportButton } from '../components/ReportButton';
import { Cover } from '../components/WorkRow';
import { count, initials } from '../lib/format';

function BlockButton({ handle }: { handle: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const blocks = useQuery({ queryKey: ['blocks'], queryFn: () => api<{ handle: string }[]>('/blocks') });
  const on = !!blocks.data?.some((b) => b.handle === handle);
  const toggle = useMutation({
    mutationFn: () => api(`/blocks/${handle}`, { method: on ? 'DELETE' : 'PUT' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['blocks'] }),
  });
  return (
    <button className="btn small" type="button" disabled={toggle.isPending} title={t('block.hint')} onClick={() => toggle.mutate()}>
      <Icon name="ban" size={14} /> {on ? t('block.unblock') : t('block.button')}
    </button>
  );
}

interface Profile {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
  profilePublic: boolean;
  works: (Omit<WorkCard, 'owner' | '_count'> & { _count: { parts: number; follows: number } })[];
  followers: number;
}

export function ProfilePage() {
  const { handle = '' } = useParams();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['writer', handle], queryFn: () => api<Profile>(`/writers/${handle}`) });
  if (q.isLoading) return <p className="muted">{t('common.loading')}</p>;
  if (q.error) return <p className="muted">{(q.error as ApiError).status === 404 ? t('errors.notFound') : t('common.error')}</p>;
  const p = q.data!;
  const mine = user?.handle === p.handle;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div className="avatar lg">{initials(p.displayName)}</div>
        <div>
          <h1 style={{ fontSize: 26 }}>{p.displayName}</h1>
          <p className="muted">@{p.handle}</p>
        </div>
      </div>
      {p.bio && <p style={{ marginTop: 13, color: 'var(--muted)' }}>{p.bio}</p>}
      <div className="stats">
        <span><b>{p.works.length}</b>{t('profile.works', { count: p.works.length }).replace(/^\d+\s*/, '')}</span>
        <span><b>{count(p.followers < 5 ? 'fewer than 5' : p.followers)}</b>{t('profile.followers', { count: '' }).trim()}</span>
      </div>
      {mine ? (
        <div className="actions">
          <Link className="btn" to="/studio"><Icon name="pen" size={14} /> {t('nav.studio')}</Link>
          <Link className="btn" to="/settings"><Icon name="settings" size={14} /> {t('settings.title')}</Link>
          <button className="btn" type="button" onClick={() => void logout().then(() => nav('/'))}><Icon name="logout" size={14} /> {t('nav.signout')}</button>
        </div>
      ) : user ? (
        <div className="actions" style={{ alignItems: 'center' }}>
          <BlockButton handle={p.handle} />
          <ReportButton target="user" targetId={p.id} compact />
        </div>
      ) : null}
      <div className="section-title"><h3>{t('profile.worksBy', { name: p.displayName.split(' ')[0] })}</h3></div>
      {p.works.map((w) => (
        <Link key={w.id} className="row" to={`/w/${w.slug}`}>
          <Cover work={w} />
          <div className="row-copy">
            <h3>{w.title}</h3>
            <p className="muted">{t('work.status.' + w.status)} · {t('common.language.' + w.language)} · {w._count.parts} {t('work.parts').toLowerCase()}</p>
            {w.synopsis && <p className="muted" style={{ marginTop: 4 }}>{w.synopsis.slice(0, 120)}</p>}
          </div>
          <Icon name="chevron" className="chev" />
        </Link>
      ))}
    </>
  );
}
