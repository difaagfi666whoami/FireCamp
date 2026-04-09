"""
main.py — FastAPI application entry point untuk Campfire Backend.

Menjalankan:
  cd backend
  uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import sys

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routers import recon as recon_router
from app.api.routers import match as match_router
from app.api.routers import catalog as catalog_router
from app.api.routers import craft as craft_router
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

# ─── Validation error handler (log 422 detail) ───────────────────────────────

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """
    Log full Pydantic validation errors untuk memudahkan debug 422 di frontend.
    Response body tetap mengikuti format FastAPI default (errors[]).
    """
    errors = exc.errors()
    logger.error(
        "[422] %s %s — %d validation error(s)",
        request.method, request.url.path, len(errors),
    )
    for err in errors:
        loc = ".".join(str(x) for x in err.get("loc", []))
        logger.error("  └─ loc=%s  msg=%s  type=%s", loc, err.get("msg"), err.get("type"))
    return JSONResponse(
        status_code=422,
        content={"detail": errors},
    )


# ─── Routers ──────────────────────────────────────────────────────────────────

app.include_router(recon_router.router)
app.include_router(match_router.router)
app.include_router(catalog_router.router)
app.include_router(craft_router.router)

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
