/**
 * Fetch wrapper for the Simulizi API. Unwraps the { success, data } envelope,
 * attaches the bearer token, refreshes it once on 401, and sends an anonymous
 * reader id so signed-out reads count once per device (doc 16).
 */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

const ACCESS = 'simulizi_access';
const REFRESH = 'simulizi_refresh';
const ANON = 'simulizi_anon';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS);
  },
  get refresh() {
    return localStorage.getItem(REFRESH);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

function anonId() {
  let id = localStorage.getItem(ANON);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANON, id);
  }
  return id;
}

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (!tokens.refresh) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refresh }),
      });
      if (!res.ok) return false;
      const body = await res.json();
      tokens.set(body.data.accessToken, body.data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { 'X-Anon-Id': anonId(), ...(init.headers as Record<string, string>) };
  if (init.json !== undefined) headers['Content-Type'] = 'application/json';
  if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (res.status === 401 && retry && tokens.refresh && (await tryRefresh())) {
    return api<T>(path, init, false);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) tokens.clear();
    const msg = body?.error?.message;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : msg ?? res.statusText, body?.error?.code);
  }
  return (body?.data ?? body) as T;
}
