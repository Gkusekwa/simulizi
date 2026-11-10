import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { formatWhen } from '../lib/format';

interface Report {
  id: string;
  target: 'part' | 'comment' | 'user';
  targetId: string;
  reason: string;
  details: string | null;
  urgent: boolean;
  status: 'open' | 'upheld' | 'rejected';
  createdAt: string;
  reporter: { handle: string };
}

/** Doc 10 moderator queue, MVP: urgent first, uphold (hide + strike) or reject. */
export function ModQueuePage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<'open' | 'upheld' | 'rejected'>('open');
  const q = useQuery({ queryKey: ['mod', status], queryFn: () => api<Report[]>(`/mod/reports?status=${status}`), enabled: !!user && user.role !== 'reader' });
  const resolve = useMutation({
    mutationFn: ({ id, s }: { id: string; s: 'upheld' | 'rejected' }) => api(`/mod/reports/${id}/resolve`, { method: 'POST', json: { status: s } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['mod'] }),
  });
  if (loading) return null;
  if (!user || user.role === 'reader') return <Navigate to="/" replace />;

  return (
    <>
      <p className="eyebrow">{t('mod.eyebrow')}</p>
      <h1>{t('mod.title')}</h1>
      <div className="tabs" style={{ marginTop: 18 }}>
        {(['open', 'upheld', 'rejected'] as const).map((s) => (
          <button key={s} type="button" className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>{t('mod.status.' + s)}</button>
        ))}
      </div>
      {q.isLoading && <p className="muted" style={{ marginTop: 12 }}>{t('common.loading')}</p>}
      {q.data?.length === 0 && <div className="empty"><Icon name="check" /><h3>{t('mod.empty')}</h3></div>}
      {resolve.error && <p className="form-error">{(resolve.error as ApiError).message}</p>}
      {q.data?.map((r) => (
        <div key={r.id} className="part-row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>
              {r.urgent && <span className="pill warn" style={{ marginRight: 6 }}>{t('mod.urgent')}</span>}
              {t('report.reasons.' + r.reason)} · {t('mod.target.' + r.target)}
            </h3>
            <small>
              @{r.reporter.handle} · {formatWhen(r.createdAt)} · <code style={{ fontSize: 11 }}>{r.targetId}</code>
              {r.target === 'part' && <> · <Link to={`/mod/part/${r.targetId}`}>{t('mod.open')}</Link></>}
            </small>
            {r.details && <p className="muted" style={{ marginTop: 6 }}>{r.details}</p>}
          </div>
          {r.status === 'open' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn small primary" type="button" disabled={resolve.isPending} onClick={() => window.confirm(t('mod.upholdConfirm')) && resolve.mutate({ id: r.id, s: 'upheld' })}>{t('mod.uphold')}</button>
              <button className="btn small" type="button" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, s: 'rejected' })}>{t('mod.reject')}</button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
