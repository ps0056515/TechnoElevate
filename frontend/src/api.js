const TOKEN_KEY = 'te_token';

/**
 * API origin:
 * - `VITE_API_URL` in `.env` (recommended for odd ports / HTTPS) — see `frontend/.env.example`
 * - Dev (`vite`): empty → relative `/api` so the Vite proxy can forward to the backend
 * - Production build without env: same host as the page, port **6000** (matches backend default)
 */
function resolveApiBase() {
  const fromEnv = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return '';
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:6000`;
  }
  return '';
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Resolves a path like `/api/...` to a full URL for production; relative in Vite dev (proxy).
 */
export function apiUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = resolveApiBase();
  if (!base) return p;
  return `${base}${p}`;
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(apiUrl(path), { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return;
  }

  return res;
}
