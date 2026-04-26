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

/**
 * Fetches a JSON body and throws a clear error if the server returned HTML (e.g. Vite
 * index page when the /api proxy target is wrong or the API is down).
 */
export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  if (res == null) return null;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) {
    const text = await res.text();
    if (text.trim().startsWith('<!')) {
      const hint = import.meta.env.DEV
        ? ' In Vite dev, set frontend/.env.local: VITE_API_URL=http://localhost:YOUR_API_PORT, or VITE_DEV_PROXY=the same (see .env.example).'
        : '';
      throw new Error(
        `API returned HTML instead of JSON (is the backend running on the right port, and the Vite proxy matching?).${hint}`
      );
    }
    throw new Error(text.slice(0, 200) || res.statusText || 'Non-JSON response');
  }
  return res.json();
}
