"""
AskThePaper — FastAPI Entry Point (updated: Step 2)
=====================================================
Changes from Step 1:
  - Added `lifespan` context manager to connect/disconnect MongoDB on startup/shutdown.
  - Added `GET /test-db` endpoint to verify MongoDB connectivity and version.

Run with:
    uv run uvicorn app.main:app --reload
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.database import get_database, lifespan
from app.admin.router import router as admin_router
from app.chat.router import router as chat_router

# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------
# All module loggers (app.chunking, app.embedding, app.llm, app.chat.router,
# app.evaluation, etc.) inherit from the root logger configured here.
# To see debug-level messages, change INFO → DEBUG below.
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)
logger.info("🚀 AskThePaper API starting up — logging configured.")

# ---------------------------------------------------------------------------
# App Initialization
# ---------------------------------------------------------------------------
# `lifespan=lifespan` wires up our startup/shutdown logic from database.py.
# FastAPI calls the lifespan context manager when the server starts and stops.
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AskThePaper API",
    description="Research Paper RAG — ask questions, get grounded answers.",
    version="0.2.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # TODO: restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
app.include_router(admin_router, prefix="/admin")
app.include_router(chat_router, prefix="/chat")

@app.get("/", tags=["General"])
async def root():
    """Welcome endpoint — confirms the API is reachable."""
    return {
        "message": "Welcome to AskThePaper API 🚀",
        "docs": "/docs",
    }


@app.get("/health", tags=["General"])
async def health_check():
    """Health-check endpoint for monitoring and CI pipelines."""
    return {"status": "ok"}


@app.get("/test-db", tags=["Database"])
async def test_db():
    """
    Ping MongoDB and return its server version.

    This endpoint:
    1. Gets the database handle from database.py.
    2. Runs the admin `ping` and `buildInfo` commands.
    3. Returns the MongoDB version string on success.

    If the database is unreachable, it raises an HTTP 503 error
    so the caller knows it's a DB issue, not an app bug.
    """
    try:
        db = get_database()
        # `command()` is an async call — we `await` it to get the result.
        info = await db.client.admin.command("buildInfo")
        return {
            "status": "connected",
            "mongodb_version": info["version"],
            "database": db.name,
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Database unreachable: {e}",
        )
