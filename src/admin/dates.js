/** Today as YYYY-MM-DD in WITA (Asia/Makassar). */
export function todayWitaISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Tomorrow relative to today's WITA calendar date. */
export function tomorrowWitaISO() {
  const t = todayWitaISO()
  const [y, mo, d] = t.split('-').map(Number)
  const u = new Date(Date.UTC(y, mo - 1, d))
  u.setUTCDate(u.getUTCDate() + 1)
  const pad = (n) => String(n).padStart(2, '0')
  return `${u.getUTCFullYear()}-${pad(u.getUTCMonth() + 1)}-${pad(u.getUTCDate())}`
}

/** Minutes since local midnight in Asia/Makassar (WITA). */
export function witaNowMinutesSinceMidnight() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Makassar',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hour = Number(parts.find((p) => p.type === 'hour')?.value)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0
  return hour * 60 + minute
}

/**
 * First YYYY-MM-DD that should be selectable for blocks (Mon–Sat, aligns with booking).
 * After the shop day ends in WITA (last slot 19:00 → treat as closed from 20:00 onward),
 * "today" is no longer selectable — same idea as the main site when no times remain.
 */
export function earliestSelectableBlockDateISO() {
  const today = todayWitaISO()
  const closedFromMinutes = 20 * 60
  if (witaNowMinutesSinceMidnight() >= closedFromMinutes) {
    return tomorrowWitaISO()
  }
  return today
}

/** @param {string} iso YYYY-MM-DD */
export function isSundayISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return false
  return new Date(y, m - 1, d).getDay() === 0
}

/** Compare YYYY-MM-DD strings. */
export function compareDateStr(a, b) {
  return a.localeCompare(b)
}

/** Format YYYY-MM-DD for display (id-ID long). */
export function formatDateLabel(iso) {
  const [y, mo, d] = iso.split('-').map(Number)
  if (!y) return iso
  const dt = new Date(y, mo - 1, d)
  return dt.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** English uppercase heading e.g. "MONDAY, 20 APRIL" (legacy / export). */
export function formatDateHeadingEn(iso) {
  const [y, mo, d] = iso.split('-').map(Number)
  if (!y) return iso
  const dt = new Date(y, mo - 1, d)
  const wd = dt
    .toLocaleDateString('en-GB', { weekday: 'long' })
    .toUpperCase()
  const rest = dt
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
    .toUpperCase()
  return `${wd}, ${rest}`
}

/** Indonesian uppercase heading e.g. "SENIN, 20 APRIL" for admin. */
export function formatDateHeadingId(iso) {
  const [y, mo, d] = iso.split('-').map(Number)
  if (!y) return iso
  const dt = new Date(y, mo - 1, d)
  const wd = dt.toLocaleDateString('id-ID', { weekday: 'long' }).toUpperCase()
  const rest = dt
    .toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })
    .toUpperCase()
  return `${wd}, ${rest}`
}
