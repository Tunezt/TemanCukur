# TemanCukur — Project Context

> **Purpose of this document:** Give an AI assistant (or new contributor) enough context to work on this codebase without re-discovering everything from scratch. Read this first before making changes.

---

## What this project is

**Repo name:** `temancukur`  
**Product / brand:** **Norm Studio** (formerly Paddy's Barbershop, renamed 23 Nov 2026) — a multi-barber shop in **Balikpapan, Indonesia** (est. 2019).

This is a **full-stack side project**: a marketing landing page plus an online booking system for a real local barbershop. Customers book haircuts online; payment happens **in-store** (no payment gateway). Confirmations and reminders go out via **WhatsApp**.

**Live URLs (as configured in code):**
- Frontend: `https://teman-cukur.vercel.app`
- API: deployed on **Railway** (see `backend/Procfile`, `backend/railpack.json`)
- Admin: `{frontend}/admin`

---

## Users & flows

### Customer (public)
1. Lands on `/` — marketing page (hero, portfolio cards, location, contact).
2. Clicks **Booking sekarang** → multi-step booking at `/book/*`:
   - `/book` — pick barber (or "no preference")
   - `/book/service` — pick service + price
   - `/book/schedule` — pick date + time slot
   - `/book/details` — name + WhatsApp number
   - `/book/confirm` — review + submit
3. On success: booking stored in DB; WhatsApp confirmation sent to customer; alert sent to shop owner; 2-hour reminder scheduled.

### Shop owner (admin)
- `/admin/login` — client-side auth (admin key stored in browser)
- `/admin/dashboard` — view bookings, cancel bookings, block dates or individual slots

---

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | React 19, React Router 7, Vite 8, plain CSS (no Tailwind) |
| Backend | Python 3, FastAPI, Pydantic, Uvicorn |
| Database | Supabase (PostgreSQL) via `supabase` Python client |
| WhatsApp | Fonnte API (`backend/app/fonnte.py`) |
| Reminders | APScheduler (in-process, WITA timezone) |
| Deploy | Vercel (SPA), Railway (API) |

---

## Repository layout

```
TemanCukur/
├── src/                          # React frontend
│   ├── App.jsx                   # Landing page + route definitions
│   ├── App.css                   # Landing page styles
│   ├── book.css                  # Booking flow styles
│   ├── config.js                 # API_BASE_URL, dev proxy config
│   ├── api/
│   │   ├── booking.js            # Public booking API client
│   │   └── adminApi.js           # Admin API client (X-Admin-Key header)
│   ├── pages/
│   │   ├── BookBarber.jsx
│   │   ├── BookService.jsx
│   │   ├── BookSchedule.jsx
│   │   ├── BookDetails.jsx
│   │   ├── BookConfirm.jsx
│   │   └── admin/
│   │       ├── AdminLogin.jsx
│   │       └── AdminDashboard.jsx
│   ├── components/
│   │   ├── BookHeader.jsx
│   │   ├── BookLayout.jsx        # Shared booking step shell
│   │   └── admin/BlockDateCalendar.jsx
│   ├── admin/
│   │   ├── auth.js               # Admin key in localStorage
│   │   ├── dates.js              # WITA date helpers
│   │   └── admin.css
│   └── bookingContactStorage.js  # Persist name/WhatsApp in sessionStorage
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app, CORS, lifespan (scheduler)
│   │   ├── config.py             # pydantic-settings env loading
│   │   ├── constants.py          # ALLOWED_SLOTS, SHOP_TZ (WITA UTC+8)
│   │   ├── db.py                 # Supabase client singleton
│   │   ├── schemas.py            # Pydantic request/response models
│   │   ├── services.py           # Slot availability, barber queries
│   │   ├── booking_whatsapp.py   # WhatsApp message templates + Fonnte send
│   │   ├── booking_reminders.py  # APScheduler 2h-before reminders
│   │   ├── fonnte.py             # Fonnte HTTP client
│   │   ├── deps.py               # Admin auth dependency
│   │   └── routes/
│   │       ├── barbers.py        # GET /api/barbers
│   │       ├── slots.py          # GET /api/slots
│   │       ├── bookings.py       # POST /api/bookings, cancel
│   │       └── admin.py          # Admin bookings + blocks CRUD
│   ├── supabase/migrations/
│   │   ├── 001_schema.sql        # bookings, blocks tables
│   │   └── 002_barbers_and_booking_fields.sql  # barbers, per-barber slots
│   ├── requirements.txt
│   ├── Procfile                    # Railway: uvicorn
│   └── .env.example
├── scripts/
│   ├── run-backend.mjs           # Starts uvicorn on 127.0.0.1:8010
│   └── kill-dev-servers.mjs      # Frees ports 8010, 8001, 5173
├── PRODUCT.md                      # Brand/product brief (design constraints)
├── vite.config.js                  # Dev proxy /api → FastAPI
├── vercel.json                     # SPA rewrite
└── package.json                    # npm scripts
```

---

## API reference

Base path: `/api`  
Interactive docs: `http://127.0.0.1:8010/docs` (local)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| GET | `/api/barbers` | — | List active barbers |
| GET | `/api/slots?date=YYYY-MM-DD&barber_id=` | — | Available slots; omit `barber_id` for union across barbers |
| POST | `/api/bookings` | — | Create booking |
| POST | `/api/bookings/{id}/cancel` | — | Customer cancel |
| GET | `/api/admin/bookings` | `X-Admin-Key` | List bookings |
| POST | `/api/admin/bookings/{id}/cancel` | `X-Admin-Key` | Admin cancel |
| POST | `/api/admin/blocks` | `X-Admin-Key` | Block day or slot |
| GET | `/api/admin/blocks` | `X-Admin-Key` | List blocks |
| DELETE | `/api/admin/blocks/{id}` | `X-Admin-Key` | Remove block |

### Booking create payload (example)

```json
{
  "customer_name": "Ahmad",
  "whatsapp": "+6281234567890",
  "service": "Haircut",
  "service_price": 100000,
  "date": "2026-04-20",
  "time": "14:00",
  "barber_id": "a1111111-1111-4111-8111-111111111111",
  "prefer_any_barber": false
}
```

Set `prefer_any_barber: true` and omit `barber_id` to auto-assign the barber with the most availability on that date.

### Allowed time slots

Defined in `backend/app/constants.py`:

```
09:00, 10:00, 11:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00
```

(No 12:00 — lunch break. Shop hours on landing page: Mon–Sat 09:00–20:00.)

### Timezone

All slot/date logic uses **WITA** (`Asia/Makassar`, UTC+8). Past slots for "today" are filtered out on both backend and frontend.

---

## Database schema (Supabase / PostgreSQL)

### `barbers`
- `id`, `name`, `specialty`, `photo_url`, `is_active`, `sort_order`
- Seeded with 3 placeholder barbers in migration 002

### `bookings`
- `id`, `customer_name`, `whatsapp`, `service`, `service_price`, `booking_date`, `booking_time`, `barber_id`, `status`, `created_at`
- Status: `pending`, `confirmed`, `completed`, `no_show`, `cancelled`
- **Unique constraint:** one active booking per `(barber_id, booking_date, booking_time)` where status in (`pending`, `confirmed`)

### `blocks`
- `id`, `block_date`, `block_time`, `created_at`
- `block_time = null` → entire day blocked
- `block_time = "15:00"` → single slot blocked (shop-wide, not per-barber)

### RLS
Row Level Security is enabled but **denies all anon access**. Backend uses `SUPABASE_SERVICE_KEY` (service role) and bypasses RLS.

---

## WhatsApp integration

After successful `POST /api/bookings`:

1. **Customer confirmation** — includes assigned barber, service, price, date/time
2. **Owner alert** — sent to `RIFKI_WHATSAPP` env var
3. **Reminder** — scheduled 2 hours before slot via APScheduler

If Fonnte is misconfigured or down, **the booking is still saved**; errors are logged only.

**Important:** Reminders live in memory on the running process. If Railway restarts, pending reminders for existing bookings are **not** recreated automatically.

Env vars: `FONNTE_TOKEN`, `RIFKI_WHATSAPP` (see `backend/.env.example`).

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (secret) |
| `ADMIN_API_KEY` | Required for `/api/admin/*` |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `FONNTE_TOKEN` | Fonnte API token (optional in dev) |
| `RIFKI_WHATSAPP` | Owner WhatsApp for new-booking alerts |

### Frontend (`.env.development` / Vercel)

| Variable | Purpose |
|----------|---------|
| `VITE_DEV_PROXY_TARGET` | FastAPI origin in dev (default `http://127.0.0.1:8010`) |
| `VITE_API_BASE_URL` | Production API origin (Railway URL on Vercel) |

In local dev, `API_BASE_URL` is empty → requests go to `/api/...` and Vite proxies to FastAPI.

---

## Local development

From repo root:

```bash
# Install frontend deps (once)
npm install

# Backend setup (once)
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Copy backend/.env.example → backend/.env and fill in Supabase + admin key

# Run both frontend + backend (from repo root)
npm run restart:dev
```

- **Frontend:** `http://127.0.0.1:5173` (or `localhost:5173`)
- **API:** `http://127.0.0.1:8010` (override with `TC_API_PORT`)
- **API docs:** `http://127.0.0.1:8010/docs`

**After any change** to `src/`, `backend/app/`, `vite.config.js`, `package.json`, or `.env.development`, run:

```bash
npm run restart:dev
```

Stale listeners on ports 8010/5173 can cause confusing 404s (e.g. admin cancel works on fresh server but not stale one).

Avoid `UVICORN_RELOAD=1` on Windows unless needed — reload can serve a truncated OpenAPI schema.

---

## Design & product constraints

See `PRODUCT.md` for the full brief. Key points:

- **Brand:** Premium, restrained, black/white. Shop-first (not individual-barber-as-hero).
- **Typography:** Playfair Display (headings), Inter (body).
- **Language:** Indonesian copy in customer-facing UI; some admin/English mixed in footer.
- **Do not redesign** the landing layout or booking UI patterns unless explicitly asked — rebrand + feature add only.
- **Out of scope:** Payment integration, admin reporting/analytics UI, purple SaaS gradients.

### Accessibility
- Skip link on landing page
- `prefers-reduced-motion` respected (animations disabled)
- Keyboard-reachable booking controls

---

## Frontend state & booking flow

Booking state is passed between steps via **React Router `location.state`** (not a global store). Each step validates required prior state and redirects back if missing.

Contact info (name, WhatsApp) is also persisted in **sessionStorage** via `bookingContactStorage.js` so returning users don't re-type.

Services and prices are defined in the frontend booking pages (not a DB table). Price is sent as `service_price` snapshot on create.

---

## Admin auth

Simple **API key** model:
- User enters admin key on `/admin/login`
- Key stored in `localStorage`
- All admin API calls send header: `X-Admin-Key: <key>`
- Backend validates against `ADMIN_API_KEY` env var

No JWT, no user accounts.

---

## Deployment

| Service | Platform | Notes |
|---------|----------|-------|
| Frontend | Vercel | SPA; `vercel.json` rewrites all routes to `index.html` |
| API | Railway | `Procfile` runs uvicorn on `$PORT` |
| Database | Supabase | Run migrations manually in SQL editor or migration tooling |

Production frontend must set `VITE_API_BASE_URL` to the Railway API origin. Backend must set `CORS_ORIGINS` to include the Vercel URL(s).

---

## Common tasks for AI assistants

| Task | Where to look |
|------|---------------|
| Add/change a booking step | `src/pages/Book*.jsx`, `src/components/BookLayout.jsx`, `src/App.jsx` routes |
| Change slot hours | `backend/app/constants.py` + frontend `SLOT_OPTIONS` in admin + schedule UI |
| Modify WhatsApp messages | `backend/app/booking_whatsapp.py` |
| Change slot logic | `backend/app/services.py`, `backend/app/routes/slots.py` |
| Add admin feature | `backend/app/routes/admin.py`, `src/pages/admin/AdminDashboard.jsx`, `src/api/adminApi.js` |
| DB schema change | New file in `backend/supabase/migrations/`, update `services.py` / `schemas.py` |
| Styling booking flow | `src/book.css` |
| Styling landing page | `src/App.css` |

---

## What this project demonstrates (for portfolio/internship)

- Full-stack product for a real local business use case
- REST API design with FastAPI + Pydantic validation
- PostgreSQL schema design with partial unique indexes (prevent double booking)
- Third-party integration (WhatsApp via Fonnte)
- Scheduled jobs (appointment reminders)
- Multi-step UX with timezone-aware availability
- Admin tooling for operational needs (blocks, cancellations)
- Production deployment split (Vercel + Railway + Supabase)

---

## Current git status note

This repo has active work on **multi-barber support** (barber selection step, per-barber slots, migration 002). If something looks half-finished, check uncommitted changes in:

- `backend/app/routes/barbers.py`
- `src/pages/BookBarber.jsx`
- `backend/supabase/migrations/002_barbers_and_booking_fields.sql`

---

*Last updated: July 2026*
