import { apiUrl } from '../config'

/**
 * Drop slot times that are already past for this calendar day in WITA (UTC+8),
 * same rule as the backend — keeps UI correct if the API omits this filter.
 * @param {string} dateISO YYYY-MM-DD
 * @param {string[]} slots HH:MM strings
 */
export function filterPastSlotsWita(dateISO, slots) {
  if (!dateISO || !Array.isArray(slots)) return []

  const witaDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = +witaDateParts.find((p) => p.type === 'year').value
  const mo = +witaDateParts.find((p) => p.type === 'month').value
  const d = +witaDateParts.find((p) => p.type === 'day').value

  const [ty, tmo, td] = dateISO.split('-').map(Number)
  if (ty < y || (ty === y && tmo < mo) || (ty === y && tmo === mo && td < d)) {
    return []
  }
  if (ty > y || (ty === y && tmo > mo) || (ty === y && tmo === mo && td > d)) {
    return slots.slice()
  }

  const timeParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const curH = +timeParts.find((p) => p.type === 'hour').value
  const curMin = +timeParts.find((p) => p.type === 'minute').value
  const nowMins = curH * 60 + curMin

  return slots.filter((s) => {
    const [h, m] = s.split(':').map(Number)
    return h * 60 + m > nowMins
  })
}

/**
 * @param {string} dateISO YYYY-MM-DD
 * @returns {Promise<{ date: string, slots: string[] }>}
 */
export async function fetchAvailableSlots(dateISO) {
  const url = new URL(apiUrl('/api/slots'))
  url.searchParams.set('date', dateISO)
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = normalizeErrorDetail(data)
    throw new Error(msg || 'Gagal memuat jam tersedia. Coba lagi.')
  }
  const raw = Array.isArray(data.slots) ? data.slots : []
  return { ...data, slots: filterPastSlotsWita(dateISO, raw) }
}

/**
 * @param {{ customer_name: string, whatsapp: string, service: string, date: string, time: string }} body
 */
export async function createBooking(body) {
  const res = await fetch(apiUrl('/api/bookings'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = normalizeErrorDetail(data)
    throw new Error(msg || 'Booking tidak bisa diselesaikan. Coba lagi.')
  }
  return data
}

function normalizeErrorDetail(data) {
  const d = data?.detail
  if (typeof d === 'string') return d
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

/** Normalize Indonesian mobile input to E.164 for the API (e.g. +6281234567890). */
export function formatWhatsappForApi(input) {
  let d = String(input ?? '')
    .trim()
    .replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (!d.startsWith('62')) d = '62' + d
  return '+' + d
}
