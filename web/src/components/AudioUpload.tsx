import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_URL, tokens } from '../api/client';
import type { StudioPart } from '../api/types';
import { Icon } from './Icon';

/** Attach, replace or remove the narration of a book part (studio). */
export function AudioUpload({ part, onDone }: { part: StudioPart; onDone: (p: StudioPart) => void }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (init: RequestInit) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/studio/parts/${part.id}/audio`, { ...init, headers: { Authorization: `Bearer ${tokens.access}` } });
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
  const send = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    // Duration from the browser, when it can decode the file.
    const seconds = await new Promise<number | undefined>((resolve) => {
      const a = document.createElement('audio');
      a.preload = 'metadata';
      a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? Math.round(a.duration) : undefined);
      a.onerror = () => resolve(undefined);
      a.src = URL.createObjectURL(file);
      setTimeout(() => resolve(undefined), 4000);
    });
    if (seconds) form.append('seconds', String(seconds));
    await call({ method: 'PUT', body: form });
  };
  const size = part.audioBytes ? `${(part.audioBytes / 1048576).toFixed(1)} MB` : '';
  const dur = part.audioSeconds ? ` · ${Math.floor(part.audioSeconds / 60)}:${String(part.audioSeconds % 60).padStart(2, '0')}` : '';

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h3 style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="headphones" size={16} /> {t('studio.audio.title')}</h3>
      <p className="muted" style={{ marginTop: 4 }}>{part.audioMime ? t('studio.audio.attached', { size: size + dur }) : t('studio.audio.none')}. {t('studio.audio.hint')}</p>
      <input ref={input} type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.wav" hidden onChange={(e) => e.target.files?.[0] && void send(e.target.files[0])} />
      <div className="actions" style={{ marginTop: 8 }}>
        <button className="btn small" type="button" disabled={busy} onClick={() => input.current?.click()}>
          <Icon name="upload" size={14} /> {busy ? t('studio.audio.busy') : part.audioMime ? t('studio.audio.replace') : t('studio.audio.upload')}
        </button>
        {part.audioMime && (
          <button className="btn small danger" type="button" disabled={busy} onClick={() => void call({ method: 'DELETE' })}>
            <Icon name="trash" size={14} /> {t('studio.audio.remove')}
          </button>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
