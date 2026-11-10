import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Icon } from './Icon';

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(() => {
    try {
      return (localStorage.getItem('simulizi_theme') as 'light' | 'dark' | null) ?? null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try {
      if (theme) localStorage.setItem('simulizi_theme', theme);
      else localStorage.removeItem('simulizi_theme');
    } catch {
      /* private mode */
    }
  }, [theme]);
  const isDark = theme === 'dark' || (!theme && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return { isDark, toggle: () => setTheme(isDark ? 'light' : 'dark') };
}

export function LangToggle() {
  const { i18n, t } = useTranslation();
  const cur = i18n.language === 'en' ? 'en' : 'sw';
  const other = cur === 'en' ? 'sw' : 'en';
  return (
    <button
      className="btn small"
      type="button"
      aria-label={`${t('common.language.' + cur)}. ${t('common.language.' + other)}`}
      onClick={() => void i18n.changeLanguage(other)}
    >
      <b style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{cur.toUpperCase()}</b>
      <span className="muted"> · {t('common.language.' + other)}</span>
    </button>
  );
}

function useUnread(enabled: boolean) {
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ unread: number }>('/notifications'),
    enabled,
    refetchInterval: 60_000,
  });
  return q.data?.unread ?? 0;
}

export function Layout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isDark, toggle } = useTheme();
  const unread = useUnread(!!user);
  const nav = [
    { to: '/', icon: 'home', label: t('nav.home'), end: true },
    { to: '/search', icon: 'search', label: t('nav.search') },
    { to: '/library', icon: 'library', label: t('nav.library') },
    { to: '/studio', icon: 'pen', label: t('nav.studio') },
    { to: user ? `/@${user.handle}` : '/login', icon: 'user', label: user ? t('nav.profile') : t('nav.signin') },
  ];
  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="side">
        <Link className="logo" to="/"><span className="logo-mark">S</span>simulizi</Link>
        <nav aria-label="Main">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
              <Icon name={n.icon} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <p className="side-foot">{t('app.tagline')}</p>
      </aside>
      <main className="main" id="main">
        <div className="topbar">
          <Link className="logo" to="/" style={{ fontSize: 17 }}><span className="logo-mark">S</span>simulizi</Link>
          <div style={{ display: 'flex', gap: 8 }}>
            {user && (
              <Link className="btn small" to="/notifications" aria-label={`${t('notifications.title')}${unread ? ` (${unread})` : ''}`} style={{ position: 'relative' }}>
                <Icon name="bell" />
                {unread > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--accent)', color: 'var(--bg)', fontSize: 11, lineHeight: '18px', textAlign: 'center' }}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
            )}
            {user && (
              <Link className="btn small" to="/settings" aria-label={t('settings.title')}><Icon name="settings" /></Link>
            )}
            <LangToggle />
            <button className="btn small" type="button" onClick={toggle} aria-pressed={isDark} aria-label={isDark ? 'Light mode' : 'Dark mode'}>
              <Icon name={isDark ? 'sun' : 'moon'} />
            </button>
          </div>
        </div>
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Mobile">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={n.icon} size={20} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
