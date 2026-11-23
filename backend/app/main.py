import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.booking_reminders import (
    reschedule_pending_reminders,
    shutdown_reminder_scheduler,
    start_reminder_scheduler,
)
from app.config import cors_origin_list, get_settings
from app.routes.admin import login_router as admin_login_router
from app.routes.admin import router as admin_router
from app.routes.barbers import router as barbers_router
from app.routes.bookings import router as bookings_router
from app.routes.slots import router as slots_router

# App INFO logs (reminders, Fonnte sends) show in the Railway log stream.
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)  # skip a line per Supabase call


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Validate env early
    get_settings()
    start_reminder_scheduler()
    reschedule_pending_reminders()
    yield
    shutdown_reminder_scheduler()


app = FastAPI(
    title="Norm Studio API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(slots_router, prefix="/api")
app.include_router(barbers_router, prefix="/api")
app.include_router(bookings_router, prefix="/api")
app.include_router(admin_login_router, prefix="/api")
app.include_router(admin_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
