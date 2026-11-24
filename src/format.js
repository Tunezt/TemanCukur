/** Rupiah for display: Rp 100.000 */
export function fmtPrice(n) {
  return `Rp ${Number(n).toLocaleString('id-ID')}`
}

/** Time for display: 11:00 -> 11.00 (Indonesian writes hours with a dot, same as the WhatsApp messages). */
export function fmtTime(hhmm) {
  return String(hhmm ?? '').replace(':', '.')
}
