/** Rupiah for display: Rp 100.000 */
export function fmtPrice(n) {
  return `Rp ${Number(n).toLocaleString('id-ID')}`
}
