import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { Icon } from '../components/Icon';
import { formatWhen } from '../lib/format';

interface Notification {
  id: string;
  kind: 'release' | 'comment' | 'follow' | 'moderation';
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ items: Notification[]; unread: number }>('/notifications') });
  const readAll = useMutation({
    mutationFn: () => api('/notifications/read', { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
  return (
    <>
      <div className="section-title" style={{ marginTop: 0 }}>
        <h1>{t('notifications.title')}</h1>
        {!!q.data?.unread && <button className="btn small" type="button" onClick={() => readAll.mutate()}>{t('notifications.readAll')}</button>}
      </div>
      {q.isLoading && <p className="muted">{t('common.loading')}</p>}
      {q.data?.items.length === 0 && (
        <div className="empty"><Icon name="bell" /><h3>{t('notifications.empty')}</h3></div>
      )}
      {q.data?.items.map((n) => {
        const inner = (
          <>
            <Icon name={n.kind === 'release' ? 'bell' : n.kind === 'comment' ? 'comment' : n.kind === 'follow' ? 'user' : 'wifioff'} className="chev" />
            <div className="row-copy">
              <h3 style={{ fontWeight: n.readAt ? 400 : 600 }}>{n.title}</h3>
              <p className="muted">{n.body} · {formatWhen(n.createdAt)}</p>
            </div>
            {n.link && <Icon name="chevron" className="chev" />}
          </>
        );
        return n.link ? (
          <Link key={n.id} className="row" to={n.link}>{inner}</Link>
        ) : (
          <div key={n.id} className="row">{inner}</div>
        );
      })}
    </>
  );
}
