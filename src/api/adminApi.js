import { API_BASE_URL, apiUrl, DEV_PROXY_TARGET } from '../config'

/** Must match backend ADMIN_API_KEY. Set VITE_ADMIN_API_KEY on Vercel to your production key. */
export const ADMIN_API_KEY =
  import.meta.env.VITE_ADMIN_API_KEY ?? 'temancukur-admin-2026'

function uvicornPortHint() {
  try {
    const p = new URL(DEV_PROXY_TARGET).port
    return p || '8010'
  } catch {
    return '8010'
  }
}

async function fetchOrExplain(url, options = {}) {
  try {
    return await fetch(url, options)
  } catch (e) {
    if (e instanceof TypeError) {
      const hint = API_BASE_URL
        ? API_BASE_URL
        : `this page (Vite proxies /api → ${DEV_PROXY_TARGET})`
      throw new Error(
        `Tidak dapat menghubungi API (${hint}). Jalankan backend: cd backend && .\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port ${uvicornPortHint()}`
      )
    }
    throw e
  }
}

function adminHeaders() {
  return {
    Accept: 'application/json',
    'X-Admin-Key': ADMIN_API_KEY,
  }
}

function adminHeadersJson() {
  return {
    ...adminHeaders(),
    'Content-Type': 'application/json',
  }
}

function normalizeDetail(data) {
  const d = data?.detail
  if (typeof d === 'string') {
    if (d === 'Not Found') {
      return (
        'Rute API tidak ditemukan (404). Samakan port dengan uvicorn: set VITE_DEV_PROXY_TARGET ' +
        `di .env.development ke URL API Anda (default ${DEV_PROXY_TARGET}), restart Vite, ` +
        'dan pastikan backend sudah versi terbaru (POST /api/admin/bookings/{id}/cancel).'
      )
    }
    return d
  }
  if (Array.isArray(d)) {
    return d
      .map((e) =>
        typeof e === 'string' ? e : e?.msg ?? e?.message ?? JSON.stringify(e)
      )
      .filter(Boolean)
      .join(' ')
  }
  return ''
}

/**
 * @param {{ from?: string, to?: string }} q
 */
export async function adminListBookings(q = {}) {
  const url = new URL(apiUrl('/api/admin/bookings'))
  if (q.from) url.searchParams.set('from', q.from)
  if (q.to) url.searchParams.set('to', q.to)
  const res = await fetchOrExplain(url.toString(), { headers: adminHeaders() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(normalizeDetail(data) || 'Gagal memuat booking.')
  }
  return Array.isArray(data) ? data : []
}

/**
 * @param {string} bookingId UUID
 */
export async function adminCancelBooking(bookingId) {
  const id = String(bookingId)
  const res = await fetchOrExplain(
    apiUrl(`/api/admin/bookings/${encodeURIComponent(id)}/cancel`),
    {
      method: 'POST',
      headers: adminHeadersJson(),
      body: '{}',
    }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(normalizeDetail(data) || 'Gagal membatalkan booking.')
  }
  return data
}

/**
 * @param {{ date: string, time_from: string, time_to: string }} body
 */
export async function adminCreateBlockRange(body) {
  const res = await fetchOrExplain(apiUrl('/api/admin/blocks/range'), {
    method: 'POST',
    headers: adminHeadersJson(),
    body: JSON.stringify({
      date: body.date,
      time_from: body.time_from,
      time_to: body.time_to,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(normalizeDetail(data) || 'Gagal membuat blok.')
  }
  return Array.isArray(data) ? data : []
}

export async function adminListBlocks() {
  const res = await fetchOrExplain(apiUrl('/api/admin/blocks'), {
    headers: adminHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(normalizeDetail(data) || 'Gagal memuat blok.')
  }
  return Array.isArray(data) ? data : []
}

/**
 * @param {{ date: string, time?: string | null }} body
 */
export async function adminCreateBlock(body) {
  const res = await fetchOrExplain(apiUrl('/api/admin/blocks'), {
    method: 'POST',
    headers: adminHeadersJson(),
    body: JSON.stringify({
      date: body.date,
      time: body.time && body.time.length ? body.time : null,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(normalizeDetail(data) || 'Gagal membuat blok.')
  }
  return data
}

/**
 * @param {string} blockId UUID
 */
export async function adminDeleteBlock(blockId) {
  const res = await fetchOrExplain(
    apiUrl(`/api/admin/blocks/${encodeURIComponent(blockId)}`),
    {
      method: 'DELETE',
      headers: adminHeaders(),
    }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(normalizeDetail(data) || 'Gagal menghapus blok.')
  }
  return data
}
