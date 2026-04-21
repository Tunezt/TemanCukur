from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.booking_reminders import (
    shutdown_reminder_scheduler,
    start_reminder_scheduler,
)
from app.config import cors_origin_list, get_settings
from app.routes.admin import router as admin_router
from app.routes.bookings import router as bookings_router
from app.routes.slots import router as slots_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Validate env early
    get_settings()
    start_reminder_scheduler()
    yield
    shutdown_reminder_scheduler()


app = FastAPI(
    title="Teman Cukur API",
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
app.include_router(bookings_router, prefix="/api")
app.include_router(admin_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
