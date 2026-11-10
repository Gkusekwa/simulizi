import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import type { Comment } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { formatWhen } from '../lib/format';
import { ReportButton } from './ReportButton';

/** Comment list + composer for a part (`/parts/:id/comments`) or a work (`/works/:slug/comments`). */
export function Comments({ url, queryKey }: { url: string; queryKey: string[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey, queryFn: () => api<Comment[]>(url) });
  const [body, setBody] = useState('');
  const add = useMutation({
    mutationFn: () => api(url, { method: 'POST', json: { body } }),
    onSuccess: () => {
      setBody('');
      void qc.invalidateQueries({ queryKey });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (body.trim()) add.mutate();
  };
  return (
    <section id="comments" style={{ marginTop: 28 }}>
      <div className="section-title"><h3>{t('reader.comments')}{q.data?.length ? ` · ${q.data.length}` : ''}</h3></div>
      {user && (
        <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
          <input className="field" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder={t('reader.comment')} aria-label={t('reader.comment')} />
          <button className="btn primary" type="submit" disabled={add.isPending}>{t('reader.send')}</button>
        </form>
      )}
      {add.error && <p className="form-error">{(add.error as ApiError).message}</p>}
      {q.data?.length === 0 && <p className="muted" style={{ marginTop: 10 }}>{t('reader.noComments')}</p>}
      {q.data?.map((c) => (
        <div key={c.id} className={`comment${c.parentId ? ' reply' : ''}`}>
          <p className="muted"><b>{c.user.displayName}</b> @{c.user.handle} · {formatWhen(c.createdAt)}</p>
          <p>{c.body}</p>
          {user && user.handle !== c.user.handle && <ReportButton target="comment" targetId={c.id} compact />}
        </div>
      ))}
    </section>
  );
}
