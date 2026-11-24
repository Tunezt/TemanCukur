/**
 * Shop facts in one place. Everything marked PLACEHOLDER must be replaced with
 * the client's real content before launch.
 *
 * BARBERS: PLACEHOLDER until the client sends names, specialties and square photos.
 * They live in the database (bookings point at them), not in this file. Live on the site now:
 *   sort_order 1: "Andi Pratama", Fade & taper, stock photo   (PLACEHOLDER)
 *   sort_order 2: "Budi Santoso", Texture & crop, stock photo (PLACEHOLDER)
 *   sort_order 3: "Cahyo Wijaya" exists but is hidden (is_active = false).
 * To swap in the real team, run in Supabase > SQL Editor, one line per barber:
 *   update public.barbers set name = 'Nama', specialty = 'Fade & taper',
 *     photo_url = '/images/shop/barber-nama.webp' where sort_order = 1;
 * (put square photos in public/images/shop/; is_active = true/false shows or hides a row).
 */

/**
 * Shop WhatsApp for customers (client's number, given 23 Nov 2026; its WhatsApp profile name
 * is "Norm studio"). International format without "+". Used by the WhatsApp buttons on the
 * landing page and after booking. Set to null to hide them all.
 * Booking alerts to the shop go to RIFKI_WHATSAPP on the server, a different setting.
 */
export const SHOP_WHATSAPP_E164 = '62895342413552'
export const SHOP_WHATSAPP_DISPLAY = '+62 895-3424-13552'

/** TikTok from the previous site (@rfkiimhmmd). TO CONFIRM it is the shop's account. */
export const TIKTOK_URL = 'https://www.tiktok.com/@rfkiimhmmd'

/** PLACEHOLDER: shop Instagram profile URL. While null, every Instagram link is hidden. */
export const INSTAGRAM_URL = null

/**
 * PLACEHOLDER: shop business email. While null, the email link is hidden and the
 * business-inquiry band offers WhatsApp instead. (Old sites used invented addresses
 * hello@temancukur.com / hello@paddysbarbershop.com; neither is confirmed to receive mail.)
 */
export const BUSINESS_EMAIL = null

/** PLACEHOLDER: stock photo of a generic barbershop interior. Replace with a photo of his shop. */
export const INTERIOR_PHOTO = {
  src: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&h=800&q=75',
  width: 1200,
  height: 800,
}

/**
 * TO CONFIRM with the client: services and prices. The backend keeps the same list in
 * backend/app/booking_whatsapp.py SERVICE_PRICES_IDR and rejects anything else, so change both.
 */
export const SERVICES = [
  { id: 'haircut-wash', name: 'Haircut + wash', price: 120_000, durationLabel: '1 jam' },
  { id: 'haircut', name: 'Haircut', price: 100_000, durationLabel: '45 menit' },
]

/**
 * TO CONFIRM with the client: opening days and hours as shown on the site.
 * Bookable slots live in backend/app/constants.py ALLOWED_SLOTS (09:00–19:00, lunch 12:00 off).
 */
export const OPENING_DAYS = 'Senin – Sabtu'
export const OPENING_HOURS = '09.00 – 20.00'
export const OPENING_SHORT = 'Sen–Sab 09.00–20.00'

/** TO CONFIRM with the client: year the shop opened (hero line "Est. 2019"). */
export const ESTABLISHED_YEAR = '2019'

/** Google Maps place page for the physical shop (real listing). */
export const LOCATION_MAPS_URL =
  "https://www.google.com/maps/place/Paddy's+Barbershop/@-1.2413192,116.856102,15z/data=!4m15!1m8!3m7!1s0x2df1470a0221d381:0xd55e9fd09aa16b03!2sPaddy's+Barbershop!8m2!3d-1.2445323!4d116.8610554!10e5!16s%2Fg%2F11hz2drsgz!3m5!1s0x2df1470a0221d381:0xd55e9fd09aa16b03!8m2!3d-1.2445323!4d116.8610554!16s%2Fg%2F11hz2drsgz"

/**
 * Pay before book: how long a slot is held while the customer pays by QRIS (display only;
 * the server's HOLD_MINUTES in backend/app/payments.py decides). Whether payment is on at all
 * is the server setting PAYMENT_MODE. Full price or a fixed deposit (DP) is DEPOSIT_IDR in
 * backend/app/booking_whatsapp.py (TO CONFIRM with the client: currently full price).
 */
export const PAYMENT_HOLD_MINUTES = 15
