"""
main.py — FastAPI application entry point untuk Campfire Backend.

Menjalankan:
  cd backend
  uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import recon as recon_router
from app.core.config import settings

# ─── Logging setup ────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)

# ─── App factory ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Campfire API",
    description=(
        "AI-powered B2B outreach backend — Recon, Match, Craft pipeline. "
        "Ditenagai oleh Tavily, Serper.dev, Jina Reader, dan OpenAI."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# Allow Next.js dev server (localhost:3000) dan production origin jika ada.

ALLOWED_ORIGINS: list[str] = [
    "http://localhost:3000",   # Next.js dev
    "http://127.0.0.1:3000",  # alternatif localhost
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────

app.include_router(recon_router.router)

# Placeholder untuk router Match dan Craft (akan ditambah nanti)
# app.include_router(match_router.router)
# app.include_router(craft_router.router)

# ─── Startup / Shutdown events ────────────────────────────────────────────────

@app.on_event("startup")
async def on_startup() -> None:
    mock_mode = settings.NEXT_PUBLIC_USE_MOCK
    logger.info("=" * 60)
    logger.info("  Campfire API  —  starting up")
    logger.info("  Mock mode    : %s", mock_mode)
    logger.info("  Default mode : %s", settings.NEXT_PUBLIC_DEFAULT_RECON_MODE)
    logger.info(
        "  API keys     : Tavily=%s  OpenAI=%s  Serper=%s  Jina=%s",
        "✓" if settings.TAVILY_API_KEY  else "✗ (missing)",
        "✓" if settings.OPENAI_API_KEY  else "✗ (missing)",
        "✓" if settings.SERPER_API_KEY  else "✗ (missing)",
        "✓" if settings.JINA_API_KEY    else "✗ (opsional)",
    )
    logger.info("=" * 60)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    logger.info("Campfire API — shutting down")


# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"], summary="Health check")
async def health_check() -> dict[str, str]:
    """Endpoint sederhana untuk memverifikasi server berjalan."""
    return {"status": "ok", "app": "Campfire API"}
