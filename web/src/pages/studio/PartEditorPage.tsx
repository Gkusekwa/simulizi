import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import type { StudioPart } from '../../api/types';
import { AudioUpload } from '../../components/AudioUpload';
import { Icon } from '../../components/Icon';
import { BOOK_KINDS } from '../../api/types';
import { formatWhen } from '../../lib/format';

/** ProseMirror doc -> plain text the textarea can edit (doc 14 §7 subset). */
function docToText(doc: unknown, poem: boolean): string {
  const d = doc as { content?: { type: string; content?: unknown[] }[] } | null;
  if (!d?.content) return '';
  const inline = (nodes: unknown[] = []): string =>
    nodes
      .map((n) => {
        const x = n as { type: string; text?: string; content?: unknown[] };
        if (x.type === 'text') return x.text ?? '';
        if (x.type === 'hard_break' || x.type === 'hardBreak') return '\n';
        return inline(x.content);
      })
      .join('');
  if (poem) {
    const poemNode = d.content.find((n) => n.type === 'poem');
    const stanzas = (poemNode?.content ?? []) as { attrs?: { indent?: number }; content?: unknown[] }[][] | { content?: unknown[] }[];
    return (stanzas as { content?: { attrs?: { indent?: number }; content?: unknown[] }[] }[])
      .map((s) => (s.content ?? []).map((l) => '  '.repeat(l.attrs?.indent ?? 0) + inline(l.content)).join('\n'))
      .join('\n\n');
  }
  return d.content.map((n) => inline(n.content)).join('\n\n');
}

export function PartEditorPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['studio', 'part', id], queryFn: () => api<StudioPart>(`/studio/parts/${id}`) });
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const loaded = useRef(false);

  useEffect(() => {
    if (q.data && !loaded.current) {
      loaded.current = true;
      setTitle(q.data.title);
      setText(docToText(q.data.draftJson ?? q.data.bodyJson, q.data.kind === 'poem'));
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => api(`/studio/parts/${id}/draft`, { method: 'PUT', json: { title, text } }),
    onSuccess: () => {
      setDirty(false);
      setSavedAt(new Date());
      setError(null);
    },
    onError: (e) => setError((e as ApiError).message),
  });
  const publish = useMutation({
    mutationFn: async () => {
      if (dirty) await api(`/studio/parts/${id}/draft`, { method: 'PUT', json: { title, text } });
      return api(`/studio/parts/${id}/publish-changes`, { method: 'POST' });
    },
    onSuccess: () => {
      setDirty(false);
      setSavedAt(new Date());
      void qc.invalidateQueries({ queryKey: ['studio', 'part', id] });
      void qc.invalidateQueries({ queryKey: ['studio', 'work'] });
    },
    onError: (e) => setError((e as ApiError).message),
  });

  // Autosave a few seconds after the last keystroke.
  const onChange = (next: { title?: string; text?: string }) => {
    if (next.title !== undefined) setTitle(next.title);
    if (next.text !== undefined) setText(next.text);
    setDirty(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save.mutate(), 2500);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (q.isLoading) return <p className="muted">{t('common.loading')}</p>;
  if (q.error) return <p className="muted">{t('errors.notFound')}</p>;
  const p = q.data!;
  const words = text.split(/\s+/).filter(Boolean).length;
  const isPoem = p.kind === 'poem';

  return (
    <>
      <p className="eyebrow">
        <Link to={`/studio/works/${p.workId}`} style={{ textDecoration: 'none' }}>{p.work.title}</Link> · {t('studio.partKind.' + p.kind)} · {t('studio.state.' + p.state)}
      </p>
      <input className="field" aria-label={t('studio.partTitle')} value={title} maxLength={160} onChange={(e) => onChange({ title: e.target.value })} style={{ font: '500 24px/1.2 var(--font-serif)', border: 0, padding: '4px 0', background: 'transparent' }} />
      {p.state === 'public' && p.version > 0 && (
        <div className="banner"><Icon name="bookopen" /> {t('studio.editor.liveNotice', { n: p.version })}</div>
      )}
      <p className="muted">{isPoem ? t('studio.editor.poemHint') : t('studio.editor.textHint')}</p>
      <textarea
        className={`editor${isPoem ? ' poem' : ''}`}
        lang={p.work.language}
        value={text}
        onChange={(e) => onChange({ text: e.target.value })}
        spellCheck
        aria-label={title}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="toolbar">
        <span className="muted">{t('studio.editor.words', { count: words })}</span>
        <span className="muted">· {save.isPending ? t('studio.editor.saving') : dirty ? t('studio.editor.unsaved') : savedAt ? t('studio.editor.autosaved', { time: formatWhen(savedAt.toISOString()).split(' ').slice(-1)[0] }) : ''}</span>
        <span className="spacer" />
        <button className="btn small" type="button" disabled={save.isPending || !dirty} onClick={() => save.mutate()}>{t('common.save')}</button>
        <button className="btn small primary" type="button" disabled={publish.isPending || !text.trim()} onClick={() => publish.mutate()}>
          <Icon name="check" size={14} /> {t('studio.editor.publishChanges')} {p.version > 0 ? `(v${p.version + 1})` : ''}
        </button>
      </div>
      {BOOK_KINDS.includes(p.work.kind) && (
        <AudioUpload
          part={p}
          onDone={(next) => {
            qc.setQueryData(['studio', 'part', id], (old: StudioPart | undefined) => (old ? { ...old, ...next, work: old.work } : next));
            void qc.invalidateQueries({ queryKey: ['studio', 'work'] });
          }}
        />
      )}
    </>
  );
}
