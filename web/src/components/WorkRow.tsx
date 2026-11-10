import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { WorkCard } from '../api/types';
import { coverClass, formatWhen } from '../lib/format';
import { Icon } from './Icon';

export function Cover({ work, large = false }: { work: Pick<WorkCard, 'slug' | 'title' | 'kind'> & { ownerName?: string }; large?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={`cover ${coverClass(work.slug)}${large ? ' lg' : ''}`} aria-hidden="true">
      <small>{t('work.kind.' + work.kind)}</small>
      <b>{work.title}</b>
      {large && work.ownerName ? <small>{work.ownerName}</small> : <span />}
    </div>
  );
}

export function WorkRow({ work, note }: { work: WorkCard; note?: string }) {
  const { t } = useTranslation();
  return (
    <Link className="row" to={`/w/${work.slug}`}>
      <Cover work={work} />
      <div className="row-copy">
        <h3>{work.title}</h3>
        <p className="muted">{work.owner.displayName} · {t('common.language.' + work.language)}</p>
        <p className="muted">{note ?? (work.lastPublicAt ? formatWhen(work.lastPublicAt) : '')}</p>
      </div>
      <Icon name="chevron" className="chev" />
    </Link>
  );
}
