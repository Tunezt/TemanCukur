# Paddy's Barbershop API (FastAPI + Supabase)

## Setup

1. Create a Supabase project and run migrations in order:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_barbers_and_booking_fields.sql`
   - `supabase/migrations/003_service_role_grants.sql` (new projects no longer auto-grant table access)

2. Copy `.env.example` to `.env` in this folder (`backend/.env`) and fill in real values (see below). The app resolves that path automatically, so env vars load even if you start Uvicorn from the project root.

3. Create a virtualenv and install dependencies:

```bash
cd backend
python -m venv .venv
```

**Windows (PowerShell):**

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**macOS / Linux:**

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

4. Run the server (from repo root, `npm run dev:api` uses **`127.0.0.1:8010`** by default; set `TC_API_PORT` to override):

```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Open `http://127.0.0.1:8010/docs` for interactive API docs.

## Endpoints (summary)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/barbers` | — |
| GET | `/api/slots?date=YYYY-MM-DD&barber_id=` | — |
| POST | `/api/bookings` | — |
| POST | `/api/bookings/{id}/cancel` | — |
| POST | `/api/admin/login` | — |
| GET | `/api/admin/bookings` | `X-Admin-Key` |
| POST | `/api/admin/bookings/{id}/cancel` | `X-Admin-Key` |
| POST | `/api/admin/blocks` | `X-Admin-Key` |
| GET | `/health` | — |

Allowed booking times: `09:00`, `10:00`, `11:00`, `13:00`–`19:00` (see `app/constants.py`).

Slots are per barber. Omit `barber_id` to get the union of free slots across active barbers. Bookings may send `prefer_any_barber: true` to auto-assign the barber with the most availability on that date.

Admin login: `POST /api/admin/login {"password": ...}` checks `ADMIN_PASSWORD` on the server and returns a session token (valid 7 days, signed with `ADMIN_API_KEY`). Other admin routes require header `X-Admin-Key: <that token>`. Neither the password nor `ADMIN_API_KEY` is ever shipped to the browser.

## WhatsApp (Fonnte) and reminders

After a successful `POST /api/bookings`, the API sends:

1. A confirmation to the customer’s WhatsApp (Fonnte), including the assigned barber.
2. A “new booking” message to the shop owner number (`RIFKI_WHATSAPP`).
3. A one-off scheduled reminder to the customer **two hours before** the slot (WITA / `Asia/Makassar`), via APScheduler.

If Fonnte is down or misconfigured, the booking is still stored; errors are logged only.

**Railway / production:** set `FONNTE_TOKEN` and `RIFKI_WHATSAPP` in the service environment (see `.env.example`). Reminders are held in memory on the running web process; if the dyno restarts, pending reminders for already-created bookings are not automatically recreated (only new bookings after restart get reminders).

### Example requests

```http
GET /api/slots?date=2026-04-20
```

```http
POST /api/bookings
Content-Type: application/json

{
  "customer_name": "Ahmad",
  "whatsapp": "+6281234567890",
  "service": "Haircut",
  "date": "2026-04-20",
  "time": "14:00"
}
```

```http
POST /api/bookings/<uuid>/cancel
```

```http
GET /api/admin/bookings
X-Admin-Key: <token from /api/admin/login>
```

```http
POST /api/admin/blocks
X-Admin-Key: <token from /api/admin/login>
Content-Type: application/json

{ "date": "2026-04-20", "time": null }
```

Use `"time": "15:00"` to block a single slot instead of the whole day.
