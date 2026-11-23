/**
 * Shop facts in one place. Everything marked PLACEHOLDER must be replaced with
 * the client's real content before launch.
 *
 * Barbers (names, specialties, photos) live in the database, not here. The demo rows
 * "Andi Pratama", "Budi Santoso" and "Cahyo Wijaya" use STOCK PHOTOS (PLACEHOLDER).
 * To swap in the real team, run in Supabase > SQL Editor, one line per barber:
 *   update public.barbers set name = 'Nama', specialty = 'Fade & taper',
 *     photo_url = '/images/shop/barber-nama.webp' where sort_order = 1;
 * (put square photos in public/images/shop/; set is_active = false to hide a row).
 */

/**
 * PLACEHOLDER: shop WhatsApp in international format without "+", e.g. '6281234567890'.
 * While null, the optional "Kabari lewat WhatsApp" button after booking is hidden,
 * so a demo never opens a chat with a stranger's number.
 */
export const SHOP_WHATSAPP_E164 = null

/** PLACEHOLDER: shop Instagram profile URL. */
export const INSTAGRAM_URL = 'https://www.instagram.com/'

/** PLACEHOLDER: shop business email (the paddysbarbershop.com domain is not confirmed as his). */
export const BUSINESS_EMAIL = 'hello@paddysbarbershop.com'

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
