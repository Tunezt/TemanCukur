# Teman Cukur API (FastAPI + Supabase)

## Setup

1. Create a Supabase project and run `supabase/migrations/001_schema.sql` in the SQL Editor.

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
| GET | `/api/slots?date=YYYY-MM-DD` | — |
| POST | `/api/bookings` | — |
| POST | `/api/bookings/{id}/cancel` | — |
| GET | `/api/admin/bookings` | `X-Admin-Key` |
| POST | `/api/admin/bookings/{id}/cancel` | `X-Admin-Key` |
| POST | `/api/admin/blocks` | `X-Admin-Key` |
| GET | `/health` | — |

Allowed booking times: `09:00`, `10:00`, `11:00`, `13:00`–`19:00` (see `app/constants.py`).

Admin routes require header: `X-Admin-Key: <ADMIN_API_KEY>`.

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
X-Admin-Key: your-admin-key
```

```http
POST /api/admin/blocks
X-Admin-Key: your-admin-key
Content-Type: application/json

{ "date": "2026-04-20", "time": null }
```

Use `"time": "15:00"` to block a single slot instead of the whole day.
