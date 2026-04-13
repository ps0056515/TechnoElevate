const TOKEN_KEY = 'te_token';

/** Backend origin for API calls when the SPA is not served with Vite’s /api proxy (e.g. remote static host). Set in .env: VITE_API_URL=http://host:6000 */
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Resolves a path like `/api/...` to a full URL when `VITE_API_URL` is set; otherwise keeps relative URLs for local dev.
 */
export function apiUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE) return p;
  return `${API_BASE}${p}`;
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
