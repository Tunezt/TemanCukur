/** sessionStorage — same device/tab only; clears when the tab closes */

const KEY = 'temanCukur_booking_contact_v1'

/**
 * @param {{ name: string, whatsapp: string, notes?: string }} contact
 */
export function saveBookingContact(contact) {
  try {
    const name = String(contact?.name ?? '').trim()
    const whatsapp = String(contact?.whatsapp ?? '').trim()
    const notes = String(contact?.notes ?? '').trim()
    if (!name || !whatsapp) return
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ name, whatsapp, notes })
    )
  } catch {
    /* quota / private mode */
  }
}

/** @returns {{ name: string, whatsapp: string, notes: string } | null} */
export function loadBookingContact() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (!o || typeof o.name !== 'string' || typeof o.whatsapp !== 'string') {
      return null
    }
    return {
      name: o.name.trim(),
      whatsapp: o.whatsapp.trim(),
      notes: typeof o.notes === 'string' ? o.notes : '',
    }
  } catch {
    return null
  }
}
