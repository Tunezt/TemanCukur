/**
 * Where Vite sends `/api` in dev (see vite.config.js). Set `VITE_DEV_PROXY_TARGET` if your
 * backend runs on another host/port (must match uvicorn).
 */
export const DEV_PROXY_TARGET = (
  import.meta.env.VITE_DEV_PROXY_TARGET ?? 'http://127.0.0.1:8010'
).replace(/\/$/, '')

/**
 * API origin (no trailing slash). In local dev, empty string = same origin as the Vite
 * app so requests go to `/api/...` and the dev server proxies to FastAPI (see vite.config.js).
 * Set `VITE_API_BASE_URL` to override (e.g. production API).
 */
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? '' : 'http://127.0.0.1:8001')
).replace(/\/$/, '')

/**
 * Build an absolute URL for an API path like `/api/slots`.
 * When using the dev proxy, `API_BASE_URL` is empty and we resolve against `window.location.origin`.
 */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  if (API_BASE_URL) {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`
    return new URL(p, base).href
  }
  if (typeof window !== 'undefined') {
    return new URL(p, window.location.origin).href
  }
  return p
}
