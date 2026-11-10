import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_URL, tokens } from '../api/client';
import type { StudioWork } from '../api/types';
import { Icon } from './Icon';

/**
 * "Upload a work": pick an .epub, the API turns it into a work (or appends to
 * `workId`) with one draft part per chapter, ready to schedule.
 */
export function EpubUpload({ workId, onDone }: { workId?: string; onDone: (w: StudioWork & { imported: number; skipped: number }) => void }) {
  const { t, i18n } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const url = workId ? `${API_URL}/studio/works/${workId}/import` : `${API_URL}/studio/works/import?language=${i18n.language === 'en' ? 'en' : 'sw'}`;
      const res = await fetch(url, { method: 'POST', body: form, headers: { Authorization: `Bearer ${tokens.access}` } });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? res.statusText);
      onDone(body.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
      <input ref={input} type="file" accept=".epub,application/epub+zip" hidden onChange={(e) => e.target.files?.[0] && void send(e.target.files[0])} />
      <button className="btn small" type="button" disabled={busy} onClick={() => input.current?.click()} title={t('studio.upload.hint')}>
        <Icon name="upload" size={14} /> {busy ? t('studio.upload.busy') : workId ? t('studio.upload.append') : t('studio.upload.button')}
      </button>
      {error && <span className="form-error" style={{ margin: 0 }}>{error}</span>}
    </span>
  );
}
