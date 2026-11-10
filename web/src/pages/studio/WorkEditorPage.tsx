import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import type { PartKind, ReleasePlan, StudioWork, WorkAccess, WorkKind, WorkStatus } from '../../api/types';
import { POEM_KINDS } from '../../api/types';
import { EpubUpload } from '../../components/EpubUpload';
import { Icon } from '../../components/Icon';
import { formatWhen } from '../../lib/format';

const WEEKDAYS_SW = ['J2', 'J3', 'J4', 'J5', 'Al', 'Ij', 'J1'];
const WEEKDAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface WorkStats {
  reads: number | string;
  readsLast7Days: number | string;
  uniqueReaders30Days: number | string;
  followers: number | string;
  followersLast7Days: number | string;
  perPart: { position: number; title: string; reads: number | string; likes: number | string; comments: number | string }[];
}

function Stats({ workId }: { workId: string }) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['studio', 'stats', workId], queryFn: () => api<WorkStats>(`/studio/works/${workId}/stats`) });
  if (!q.data) return null;
  const s = q.data;
  const n = (v: number | string) => (typeof v === 'string' ? t('common.fewerThanFive') : v);
  return (
    <>
      <div className="section-title"><h3><Icon name="chart" size={16} /> {t('stats.title')}</h3></div>
      <div className="stats" style={{ marginTop: 6 }}>
        <span><b>{n(s.reads)}</b>{t('stats.reads')} · {n(s.readsLast7Days)} {t('stats.readsWeek')}</span>
        <span><b>{n(s.uniqueReaders30Days)}</b>{t('stats.readers')}</span>
        <span><b>{n(s.followers)}</b>{t('stats.followers')} · +{n(s.followersLast7Days)} {t('stats.readsWeek')}</span>
      </div>
      {s.perPart.length > 0 && (
        <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ color: 'var(--muted)', textAlign: 'left' }}><th style={{ fontWeight: 500, padding: '6px 0' }}>{t('stats.perPart')}</th><th style={{ fontWeight: 500 }}>{t('stats.reads')}</th><th style={{ fontWeight: 500 }}>♡</th><th style={{ fontWeight: 500 }}>{t('reader.comments')}</th></tr></thead>
          <tbody>
            {s.perPart.map((p) => (
              <tr key={p.position} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '6px 0' }}>{p.position}. {p.title}</td><td>{n(p.reads)}</td><td>{n(p.likes)}</td><td>{n(p.comments)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function ExportLink({ workId, kind, label }: { workId: string; kind: 'html' | 'txt'; label: string }) {
  const download = async () => {
    const { API_URL, tokens } = await import('../../api/client');
    const res = await fetch(`${API_URL}/studio/works/${workId}/export.${kind}`, { headers: { Authorization: `Bearer ${tokens.access}` } });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `simulizi-${workId.slice(0, 8)}.${kind}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return <button className="btn small" type="button" onClick={() => void download()}><Icon name="download" size={14} /> {label}</button>;
}

export function WorkEditorPage() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const key = ['studio', 'work', id];
  const q = useQuery({ queryKey: key, queryFn: () => api<StudioWork>(`/studio/works/${id}`) });
  const [meta, setMeta] = useState({ title: '', synopsis: '', genre: '', status: 'draft' as WorkStatus, releasePlan: 'manual' as ReleasePlan, releaseTime: '18:00', releaseWeekdays: [] as number[], access: 'public' as WorkAccess, previewParts: 10, kind: 'book' as WorkKind, volumesText: '' });
  const [newPart, setNewPart] = useState({ title: '', kind: 'chapter' as PartKind, volume: 1 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) {
      setMeta({
        title: q.data.title,
        synopsis: q.data.synopsis,
        genre: q.data.genre ?? '',
        status: q.data.status,
        releasePlan: q.data.releasePlan,
        releaseTime: q.data.releaseTime,
        releaseWeekdays: q.data.releaseWeekdays,
        access: q.data.access ?? 'public',
        previewParts: q.data.previewParts ?? 10,
        kind: q.data.kind,
        volumesText: (q.data.volumes ?? []).join('\n'),
      });
    }
  }, [q.data]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ['studio', 'works'] });
  };
  const onErr = (e: unknown) => setError((e as ApiError).message);
  const save = useMutation({
    mutationFn: () => {
      const { volumesText, ...rest } = meta;
      const volumes = volumesText.split('\n').map((v) => v.trim()).filter(Boolean);
      return api(`/studio/works/${id}`, { method: 'PATCH', json: { ...rest, genre: meta.genre || undefined, volumes: meta.kind === 'book_collection' ? volumes : [] } });
    },
    onSuccess: refresh,
    onError: onErr,
  });
  const setVolume = useMutation({
    mutationFn: ({ partId, volume }: { partId: string; volume: number }) => api(`/studio/parts/${partId}`, { method: 'PATCH', json: { volume } }),
    onSuccess: refresh,
    onError: onErr,
  });
  const addPart = useMutation({
    mutationFn: () => api(`/studio/works/${id}/parts`, { method: 'POST', json: newPart }),
    onSuccess: () => {
      setNewPart((n) => ({ ...n, title: '' }));
      refresh();
    },
    onError: onErr,
  });
  const act = useMutation({
    mutationFn: ({ partId, action }: { partId: string; action: string }) => api(`/studio/parts/${partId}/${action}`, { method: 'POST' }),
    onSuccess: refresh,
    onError: onErr,
  });
  const publishAll = useMutation({ mutationFn: () => api(`/studio/works/${id}/publish-all`, { method: 'POST' }), onSuccess: refresh, onError: onErr });
  const move = useMutation({
    mutationFn: ({ partId, position }: { partId: string; position: number }) => api(`/studio/parts/${partId}/move`, { method: 'POST', json: { position } }),
    onSuccess: refresh,
    onError: onErr,
  });
  const del = useMutation({ mutationFn: () => api(`/studio/works/${id}`, { method: 'DELETE' }), onSuccess: () => nav('/studio') });

  if (q.isLoading) return <p className="muted">{t('common.loading')}</p>;
  if (q.error) return <p className="muted">{t('errors.notFound')}</p>;
  const w = q.data!;
  const parts = w.parts ?? [];
  const weekdays = i18n.language === 'en' ? WEEKDAYS_EN : WEEKDAYS_SW;
  const hasSlots = meta.releasePlan === 'daily' || meta.releasePlan === 'weekly';
  const queued = parts.filter((p) => p.state === 'ready' || p.state === 'scheduled');
  const nextInOrder = parts.find((p) => !['public', 'unpublished', 'removed'].includes(p.state));
  const isPoetry = POEM_KINDS.includes(meta.kind);
  const isCollection = meta.kind === 'book_collection';
  const volumes = w.volumes ?? [];

  const submitMeta = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    save.mutate();
  };

  return (
    <>
      <p className="eyebrow"><Link to="/studio" style={{ textDecoration: 'none' }}>{t('studio.title')}</Link> · {t('work.status.' + w.status)}</p>
      <h1>{w.title}</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        <Link to={`/w/${w.slug}`}>simulizi.tzcom.cloud/w/{w.slug}</Link> · {w.followers ?? 0} {t('work.followers', { count: '' }).trim()}
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}

      <form className="card" onSubmit={submitMeta} style={{ marginTop: 16 }}>
        <label className="field-label" htmlFor="title" style={{ marginTop: 0 }}>{t('studio.workTitle')}</label>
        <input className="field" id="title" required maxLength={120} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        <label className="field-label" htmlFor="synopsis">{t('studio.synopsis')}</label>
        <textarea className="field" id="synopsis" maxLength={1000} value={meta.synopsis} onChange={(e) => setMeta({ ...meta, synopsis: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <div>
            <label className="field-label" htmlFor="kind">{t('studio.kind')}</label>
            <select className="field" id="kind" value={meta.kind} onChange={(e) => setMeta({ ...meta, kind: e.target.value as WorkKind })}>
              {(['book', 'book_collection', 'poem', 'poem_collection'] as WorkKind[]).map((k) => <option key={k} value={k}>{t('work.kind.' + k)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="genre">{t('studio.genre')}</label>
            <input className="field" id="genre" maxLength={40} value={meta.genre} onChange={(e) => setMeta({ ...meta, genre: e.target.value })} />
          </div>
          <div>
            <label className="field-label" htmlFor="status">{t('studio.status')}</label>
            <select className="field" id="status" value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value as WorkStatus })}>
              {(['draft', 'ongoing', 'completed', 'hiatus'] as WorkStatus[]).map((s) => <option key={s} value={s}>{t('work.status.' + s)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="plan">{t('studio.plan')}</label>
            <select className="field" id="plan" value={meta.releasePlan} onChange={(e) => setMeta({ ...meta, releasePlan: e.target.value as ReleasePlan })}>
              {(['manual', 'daily', 'weekly', 'all_at_once'] as ReleasePlan[]).map((p) => <option key={p} value={p}>{t('work.plan.' + p)}</option>)}
            </select>
          </div>
          {hasSlots && (
            <div>
              <label className="field-label" htmlFor="time">{t('studio.releaseTime')}</label>
              <input className="field" id="time" type="time" value={meta.releaseTime} onChange={(e) => setMeta({ ...meta, releaseTime: e.target.value })} />
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 4 }}>
          <div>
            <label className="field-label" htmlFor="access">{t('studio.access')}</label>
            <select className="field" id="access" value={meta.access} onChange={(e) => setMeta({ ...meta, access: e.target.value as WorkAccess })}>
              {(['public', 'preview', 'members'] as WorkAccess[]).map((a) => <option key={a} value={a}>{t('studio.accessOptions.' + a)}</option>)}
            </select>
          </div>
          {meta.access === 'preview' && (
            <div>
              <label className="field-label" htmlFor="previewParts">{t('studio.previewParts')}</label>
              <input className="field" id="previewParts" type="number" min={1} max={100} value={meta.previewParts} onChange={(e) => setMeta({ ...meta, previewParts: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} />
            </div>
          )}
        </div>
        <p className="muted" style={{ marginTop: 6 }}>{t('studio.kindHint.' + meta.kind)} {t('studio.accessHint.' + meta.access, { n: meta.previewParts })}</p>
        {isCollection && (
          <>
            <label className="field-label" htmlFor="volumes">{t('studio.volumes')}</label>
            <textarea className="field" id="volumes" rows={3} value={meta.volumesText} onChange={(e) => setMeta({ ...meta, volumesText: e.target.value })} placeholder={'Kitabu cha 1\nKitabu cha 2'} />
            <p className="muted" style={{ marginTop: 4 }}>{t('studio.volumesHint')}</p>
          </>
        )}
        {meta.releasePlan === 'weekly' && (
          <div style={{ marginTop: 12 }}>
            <span className="field-label" style={{ marginTop: 0 }}>{t('studio.weekdays')}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {weekdays.map((d, i) => {
                const on = meta.releaseWeekdays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    className={`btn small${on ? ' primary' : ''}`}
                    aria-pressed={on}
                    onClick={() => setMeta({ ...meta, releaseWeekdays: on ? meta.releaseWeekdays.filter((x) => x !== i) : [...meta.releaseWeekdays, i].sort() })}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <p className="muted" style={{ marginTop: 10 }}>
          <Icon name="clock" size={14} /> {w.nextSlot ? t('studio.nextSlot', { when: formatWhen(w.nextSlot) }) : t('studio.noSlot')}
        </p>
        <div className="actions">
          <button className="btn primary" type="submit" disabled={save.isPending}>{t('common.save')}</button>
          {w.releasePlan === 'all_at_once' && queued.length > 0 && (
            <button className="btn" type="button" disabled={publishAll.isPending} onClick={() => publishAll.mutate()}>{t('studio.publishAll')} ({queued.length})</button>
          )}
        </div>
      </form>

      <div className="section-title">
        <h3>{t('studio.parts')}</h3>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="muted">{parts.filter((p) => p.state === 'public').length} / {parts.length}</span>
          <EpubUpload workId={id} onDone={() => refresh()} />
        </span>
      </div>
      {parts.map((p, idx) => {
        const released = ['public', 'unpublished', 'removed'].includes(p.state);
        const newVolume = isCollection && (idx === 0 || parts[idx - 1].volume !== p.volume);
        return (
          <div key={p.id}>
          {newVolume && <p className="eyebrow" style={{ marginTop: 14 }}>{t('work.volume', { n: p.volume })}{volumes[p.volume - 1] ? ` · ${volumes[p.volume - 1]}` : ''}</p>}
          <div className="part-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3>{p.position}. {p.title} <span className="muted">· {t('studio.partKind.' + p.kind)}</span>{p.audioMime && <span className="pill" style={{ marginLeft: 6 }}><Icon name="headphones" size={12} /> {t('work.hasAudio')}</span>}</h3>
              <small>
                <span className={`pill${p.state === 'public' ? '' : p.state === 'scheduled' ? ' warn' : ''}`}>{t('studio.state.' + p.state)}</span>
                {p.publicAt && <> · {formatWhen(p.publicAt)}</>}
                {p.hasDraft && p.state !== 'draft' && <> · {t('studio.editor.unsaved')}</>}
                {' · '}{t('studio.editor.words', { count: p.wordCount })}
              </small>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {isCollection && volumes.length > 1 && (
                <select className="field" style={{ width: 'auto', padding: '4px 8px' }} aria-label={t('studio.volume')} value={p.volume} onChange={(e) => setVolume.mutate({ partId: p.id, volume: Number(e.target.value) })}>
                  {volumes.map((v, i) => <option key={i} value={i + 1}>{i + 1}. {v}</option>)}
                </select>
              )}
              {!released && idx > 0 && !['public', 'unpublished', 'removed'].includes(parts[idx - 1].state) && (
                <button className="btn small" type="button" aria-label="Move up" onClick={() => move.mutate({ partId: p.id, position: p.position - 1 })}><Icon name="up" size={14} /></button>
              )}
              <Link className="btn small" to={`/studio/parts/${p.id}`}><Icon name="pen" size={14} /> {t('studio.write')}</Link>
              {p.state === 'draft' && <button className="btn small primary" type="button" onClick={() => act.mutate({ partId: p.id, action: 'ready' })}>{t('studio.markReady')}</button>}
              {(p.state === 'ready' || p.state === 'scheduled') && (
                <>
                  {nextInOrder?.id === p.id && <button className="btn small primary" type="button" onClick={() => act.mutate({ partId: p.id, action: 'publish-now' })}>{t('studio.publishNow')}</button>}
                  <button className="btn small" type="button" onClick={() => act.mutate({ partId: p.id, action: 'unready' })}>{t('studio.unready')}</button>
                </>
              )}
              {p.state === 'public' && <button className="btn small" type="button" onClick={() => act.mutate({ partId: p.id, action: 'unpublish' })}>{t('studio.unpublish')}</button>}
              {p.state === 'unpublished' && <button className="btn small" type="button" onClick={() => act.mutate({ partId: p.id, action: 'republish' })}>{t('studio.republish')}</button>}
            </div>
          </div>
          </div>
        );
      })}

      <form
        className="card"
        style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (newPart.title.trim()) addPart.mutate();
        }}
      >
        <div style={{ flex: 2, minWidth: 180 }}>
          <label className="field-label" htmlFor="ptitle" style={{ marginTop: 0 }}>{t('studio.partTitle')}</label>
          <input className="field" id="ptitle" required maxLength={160} value={newPart.title} onChange={(e) => setNewPart({ ...newPart, title: e.target.value })} />
        </div>
        {!isPoetry && (
          <div style={{ flex: 1, minWidth: 120 }}>
            <label className="field-label" htmlFor="pkind" style={{ marginTop: 0 }}>{t('studio.kind')}</label>
            <select className="field" id="pkind" value={newPart.kind} onChange={(e) => setNewPart({ ...newPart, kind: e.target.value as PartKind })}>
              {(['chapter', 'essay'] as PartKind[]).map((k) => <option key={k} value={k}>{t('studio.partKind.' + k)}</option>)}
            </select>
          </div>
        )}
        {isCollection && volumes.length > 0 && (
          <div style={{ flex: 1, minWidth: 120 }}>
            <label className="field-label" htmlFor="pvol" style={{ marginTop: 0 }}>{t('studio.volume')}</label>
            <select className="field" id="pvol" value={newPart.volume} onChange={(e) => setNewPart({ ...newPart, volume: Number(e.target.value) })}>
              {volumes.map((v, i) => <option key={i} value={i + 1}>{i + 1}. {v}</option>)}
            </select>
          </div>
        )}
        <button className="btn primary" type="submit" disabled={addPart.isPending || (meta.kind === 'poem' && parts.length > 0)}><Icon name="plus" size={14} /> {t('studio.addPart')}</button>
      </form>

      <Stats workId={id} />

      <div className="section-title"><h3>{t('stats.export')}</h3></div>
      <div className="actions" style={{ marginTop: 0 }}>
        <ExportLink workId={id} kind="html" label={t('stats.exportHtml')} />
        <ExportLink workId={id} kind="txt" label={t('stats.exportText')} />
      </div>

      <div className="actions" style={{ marginTop: 30 }}>
        <button className="btn danger small" type="button" onClick={() => window.confirm(t('studio.deleteConfirm')) && del.mutate()}>
          <Icon name="trash" size={14} /> {t('studio.deleteWork')}
        </button>
      </div>
    </>
  );
}
