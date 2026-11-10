import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n';
import { api, tokens } from '../api/client';
import type { AuthResponse, Me } from '../api/types';

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (body: { email: string; password: string; handle: string; displayName: string; birthYear: number }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState<boolean>(!!tokens.access);

  const refreshMe = useCallback(async () => {
    if (!tokens.access) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<Me>('/me');
      setUser(me);
      if (me.uiLanguage && me.uiLanguage !== i18n.language) void i18n.changeLanguage(me.uiLanguage);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      refreshMe,
      async login(email, password) {
        const r = await api<AuthResponse>('/auth/login', { method: 'POST', json: { email, password } });
        tokens.set(r.accessToken, r.refreshToken);
        setUser(r.user);
      },
      async register(body) {
        const r = await api<AuthResponse>('/auth/register', {
          method: 'POST',
          json: { ...body, uiLanguage: i18n.language === 'en' ? 'en' : 'sw' },
        });
        tokens.set(r.accessToken, r.refreshToken);
        setUser(r.user);
      },
      async logout() {
        const refresh = tokens.refresh;
        tokens.clear();
        setUser(null);
        if (refresh) await api('/auth/logout', { method: 'POST', json: { refreshToken: refresh } }).catch(() => undefined);
      },
    }),
    [user, loading, refreshMe],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
