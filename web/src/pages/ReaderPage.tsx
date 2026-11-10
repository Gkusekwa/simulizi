import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import type { PartPage } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Comments } from '../components/Comments';
import { Icon } from '../components/Icon';
import { ReportButton } from '../components/ReportButton';
import { formatWhen } from '../lib/format';

const SIZES = [15, 17, 19, 22];

export function ReaderPage() {
  const { slug = '', position = '1' } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['part', slug, position], queryFn: () => api<PartPage>(`/works/${slug}/parts/${position}`) });
  const [pct, setPct] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(() => Number(localStorage.getItem('simulizi_size') ?? 1));
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastSaved = useRef<string>('');

  useEffect(() => {
    document.documentElement.style.setProperty('--reader-size', `${SIZES[sizeIdx]}px`);
    localStorage.setItem('simulizi_size', String(sizeIdx));
  }, [sizeIdx]);

  // Reading position = first visible paragraph index + a fraction (doc 14 §5).
  const save = useMutation({
    mutationFn: (body: { paragraphIndex: number; fraction: number; finished?: boolean }) =>
      api(`/parts/${q.data!.part.id}/progress`, { method: 'PUT', json: body }),
  });
  useEffect(() => {
    if (!q.data) return;
    const el = bodyRef.current;
    if (!el) return;
    // Restore position.
    if (q.data.progress && q.data.progress.paragraphIndex > 0) {
      const target = el.querySelector<HTMLElement>(`[data-p="${q.data.progress.paragraphIndex}"]`);
      target?.scrollIntoView({ block: 'start' });
    }
    let timer: number | undefined;
    const onScroll = () => {
      const paras = Array.from(el.querySelectorAll<HTMLElement>('[data-p]'));
      if (!paras.length) return;
      const top = window.scrollY + 80;
      let idx = 0;
      for (const p of paras) {
        if (p.offsetTop <= top) idx = Number(p.dataset.p);
        else break;
      }
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const fraction = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 1;
      setPct(Math.round(fraction * 100));
      if (!user) return;
      const finished = fraction > 0.95;
      const key = `${idx}:${finished}`;
      if (key === lastSaved.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        lastSaved.current = key;
        save.mutate({ paragraphIndex: idx, fraction, finished });
      }, 1200);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.part.id, user?.id]);

  const like = useMutation({
    mutationFn: (on: boolean) => api(`/parts/${q.data!.part.id}/like`, { method: on ? 'PUT' : 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['part', slug, position] }),
  });

  const audioQ = useQuery({
    queryKey: ['audio', slug, position],
    queryFn: () => api<{ url: string; mime: string | null }>(`/works/${slug}/parts/${position}/audio`),
    enabled: !!q.data?.audio,
    staleTime: 50 * 60 * 1000,
  });

  if (q.isLoading) return <p className="muted">{t('common.loading')}</p>;
  if (q.error) {
    const e = q.error as ApiError;
    if (e.status === 401 && e.code === 'account_required') {
      return (
        <div className="empty">
          <Icon name="lock" />
          <h3>{t('reader.accountRequired')}</h3>
          <p className="muted">{t('reader.accountRequiredHint')}</p>
          <Link className="btn primary" to="/login" state={{ from: `/w/${slug}/${position}` }}>{t('nav.signin')}</Link>
          <Link className="text-link" to={`/w/${slug}`}>{t('common.back')}</Link>
        </div>
      );
    }
    return <p className="muted">{e.status === 404 ? e.message || t('errors.notFound') : e.status === 403 ? e.message : t('common.error')}</p>;
  }
  const { work, part, prev, next } = q.data!;
  const stanzas = part.kind === 'poem' ? (part.bodyHtml.match(/class="stanza"/g) ?? []).length : 0;

  return (
    <>
      <div className="readbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('reader.part', { n: part.position })}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="reader-head">
        <div>
          <p className="eyebrow"><Link to={`/w/${slug}`} style={{ textDecoration: 'none' }}>{work.title}</Link> · {work.owner.displayName}</p>
          <h1 style={{ fontSize: 23 }}>{part.kind === 'poem' ? part.title : `${t('reader.part', { n: part.position })} · ${part.title}`}</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {part.kind === 'poem' ? t('reader.stanzas', { count: stanzas }) : t('common.readMinutes', { count: part.readMinutes })}
          </p>
        </div>
        <button className="btn small" type="button" aria-label={t('reader.textSize')} onClick={() => setSizeIdx((i) => (i + 1) % SIZES.length)}>
          <Icon name="type" />
        </button>
      </div>

      {q.data!.audio && (
        <div className="card" style={{ margin: '0 0 18px', padding: 12 }}>
          <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><Icon name="headphones" size={16} /> {t('reader.listen')}</p>
          {audioQ.data ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio controls preload="metadata" src={audioQ.data.url} style={{ width: '100%' }} />
          ) : audioQ.error ? (
            <p className="muted">{t('reader.audioUnavailable')}</p>
          ) : (
            <p className="muted">{t('common.loading')}</p>
          )}
          <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>{t('reader.audioHint')}</p>
        </div>
      )}

      <div ref={bodyRef} className="chapter" lang={work.language} dangerouslySetInnerHTML={{ __html: part.bodyHtml }} />

      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, margin: '26px 0' }}>
        <button className={`tool${q.data!.liked ? ' on' : ''}`} type="button" disabled={!user || like.isPending} onClick={() => like.mutate(!q.data!.liked)}>
          <Icon name="heart" /> {q.data!.liked ? t('reader.liked') : t('reader.like')}
        </button>
        <a className="tool" href="#comments"><Icon name="comment" /> {t('reader.comment')}</a>
        <button
          className="tool"
          type="button"
          onClick={() => {
            const url = window.location.href;
            if (navigator.share) void navigator.share({ title: `${work.title} · ${part.title}`, url });
            else void navigator.clipboard?.writeText(url);
          }}
        >
          <Icon name="share" /> Share
        </button>
      </div>

      {next && (
        <Link className="part-row" to={next.state === 'public' ? `/w/${slug}/${next.position}` : `/w/${slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ flex: 1 }}>
            <h3>{t('reader.nextPart', { title: `${next.position}. ${next.title}` })}</h3>
            {next.state !== 'public' && <small><Icon name="clock" size={14} /> {t('reader.comesOut', { when: formatWhen(next.publicAt) })}</small>}
          </div>
          <Icon name="chevron" className="chev" />
        </Link>
      )}
      {prev && (
        <Link className="part-row" to={`/w/${slug}/${prev.position}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <Icon name="chevleft" className="chev" />
          <div style={{ flex: 1 }}><h3>{t('reader.prevPart')} · {prev.position}. {prev.title}</h3></div>
        </Link>
      )}

      <Comments url={`/parts/${part.id}/comments`} queryKey={['comments', part.id]} />

      <p style={{ marginTop: 20, textAlign: 'center' }}><ReportButton target="part" targetId={part.id} /></p>

      {!user && (
        <div className="guest-bar">
          <span>{t('reader.guestBar')}</span>
          <Link className="btn primary small" to="/login">{t('nav.signin')}</Link>
        </div>
      )}
    </>
  );
}
