import i18n from '../i18n';

const coverClasses = ['c1', 'c2', 'c3', 'c4'];
/** Deterministic placeholder cover colour until real covers exist. */
export function coverClass(key: string) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return coverClasses[h % coverClasses.length];
}

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const locale = i18n.language === 'en' ? 'en-GB' : 'sw-TZ';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '';
  const locale = i18n.language === 'en' ? 'en-GB' : 'sw-TZ';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

/** "fewer than 5" survives the API; numbers get thousands separators. */
export function count(v: number | string | undefined) {
  if (v === undefined) return '';
  if (typeof v === 'string') return v === 'fewer than 5' ? i18n.t('common.fewerThanFive') : v;
  return new Intl.NumberFormat(i18n.language === 'en' ? 'en-GB' : 'sw-TZ').format(v);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
