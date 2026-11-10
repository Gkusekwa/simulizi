import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const REASONS = ['spam', 'harassment', 'copyright', 'illegal', 'child_safety', 'other'] as const;

/** The report button from doc 10: any reader can report a part, comment or account. */
export function ReportButton({ target, targetId, compact = false }: { target: 'part' | 'comment' | 'user'; targetId: string; compact?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>('spam');
  const [details, setDetails] = useState('');
  const send = useMutation({ mutationFn: () => api('/reports', { method: 'POST', json: { target, targetId, reason, details: details || undefined } }) });
  if (!user) return null;
  if (send.isSuccess) return <span className="muted">{t('report.sent')}</span>;
  return (
    <span style={{ display: 'inline-block' }}>
      <button className={`btn small${compact ? '' : ''}`} type="button" onClick={() => setOpen((o) => !o)} style={{ color: 'var(--muted)' }}>
        {t('report.button')}
      </button>
      {open && (
        <form
          className="card"
          style={{ marginTop: 8, display: 'grid', gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <select className="field" value={reason} onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])} aria-label={t('report.reason')}>
            {REASONS.map((r) => <option key={r} value={r}>{t('report.reasons.' + r)}</option>)}
          </select>
          <textarea className="field" style={{ minHeight: 60 }} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t('report.details')} />
          {send.error && <p className="form-error">{(send.error as ApiError).message}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn small primary" type="submit" disabled={send.isPending}>{t('report.send')}</button>
            <button className="btn small" type="button" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      )}
    </span>
  );
}
