"""
Database — Async MongoDB client via Motor.

This module:
  1. Creates a Motor AsyncIOMotorClient using the URL from settings.
  2. Provides a `get_database()` helper for use across the app.
  3. Exposes `lifespan` — a FastAPI context manager that connects on
     startup and closes the connection cleanly on shutdown.

Usage:
    from app.core.database import get_database
    db = get_database()
    collection = db["papers"]
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings

# ---------------------------------------------------------------------------
# Module-level client — initialised once, reused by every request.
# ---------------------------------------------------------------------------
_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    """Return (or lazily create) the shared Motor client."""
    global _client
    if _client is None:
        # AsyncIOMotorClient is non-blocking: it doesn't actually open the
        # TCP connection here — it does so on the first real operation.
        _client = AsyncIOMotorClient(settings.MONGODB_URL)
    return _client


def get_database() -> AsyncIOMotorDatabase:
    """Return the application database handle."""
    return get_client()[settings.DATABASE_NAME]


# ---------------------------------------------------------------------------
# FastAPI Lifespan — connect on startup, disconnect on shutdown.
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app):  # noqa: ARG001 — app arg required by FastAPI signature
    """
    FastAPI lifespan context manager.

    Everything BEFORE `yield` runs at startup.
    Everything AFTER  `yield` runs at shutdown.

    We ping MongoDB at startup so the app fails fast (with a clear error)
    if the database is unreachable, rather than failing on the first request.
    """
    client = get_client()

    # Ping the deployment to confirm connectivity.
    await client.admin.command("ping")
    print("✅ Connected to MongoDB")

    yield  # <-- app runs here

    # Gracefully close all Motor connection pool threads.
    client.close()
    print("🔌 MongoDB connection closed")
