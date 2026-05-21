"""
recon_cache_service.py — 7-day TTL cache untuk Recon results.

Mengurangi biaya external API: user re-recon perusahaan yang sama dalam
7 hari → return cached profile tanpa debit credit. Cache key = (SHA-256 of
normalized URL, mode). Cache is GLOBAL — the recon profile is a function
of the target URL, not the requester.

Implementation uses httpx + Supabase REST (matches credits_service.py
pattern). Failures during lookup or set are non-fatal — pipeline continues
without cache.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Optional
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.models.schemas import CompanyProfile

logger = logging.getLogger(__name__)


def _headers() -> dict[str, str]:
    return {
        "apikey":        settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type":  "application/json",
    }


def _table_url(suffix: str = "") -> str:
    base = settings.NEXT_PUBLIC_SUPABASE_URL.rstrip("/")
    return f"{base}/rest/v1/recon_cache{suffix}"


def normalize_url(url: str) -> str:
    """Normalize URL untuk cache key: lowercase host, strip path/query/fragment."""
    parsed = urlparse(url.strip() if "://" in url.strip() else f"https://{url.strip()}")
    host = (parsed.netloc or parsed.path.split("/")[0]).lower()
    if host.startswith("www."):
        host = host[4:]
    return f"https://{host}"


def hash_url(url: str) -> str:
    """SHA-256 hash of the normalized URL."""
    return hashlib.sha256(normalize_url(url).encode()).hexdigest()


async def get_cached_profile(url: str, mode: str) -> Optional[CompanyProfile]:
    """Return cached CompanyProfile kalau ada dan belum expired."""
    url_hash = hash_url(url)
    query = (
        f"?url_hash=eq.{url_hash}"
        f"&mode=eq.{mode}"
        f"&expires_at=gt.now()"
        f"&select=profile_jsonb,hit_count"
        f"&limit=1"
    )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(_table_url(query), headers=_headers())
            resp.raise_for_status()
            rows = resp.json()
            if not rows:
                logger.info("[cache] MISS | url=%s mode=%s", url[:60], mode)
                return None

            row = rows[0]
            # Fire-and-forget hit-count increment.
            try:
                async with httpx.AsyncClient(timeout=3.0) as inc_client:
                    await inc_client.patch(
                        _table_url(f"?url_hash=eq.{url_hash}&mode=eq.{mode}"),
                        headers={**_headers(), "Prefer": "return=minimal"},
                        json={"hit_count": (row.get("hit_count") or 0) + 1},
                    )
            except Exception:
                pass  # non-critical

            logger.info(
                "[cache] HIT  | url=%s mode=%s hits=%d",
                url[:60], mode, (row.get("hit_count") or 0) + 1,
            )
            return CompanyProfile.model_validate(row["profile_jsonb"])

    except Exception as exc:
        logger.warning("[cache] lookup failed (proceed without cache): %s", exc)
        return None


async def set_cached_profile(
    url: str,
    mode: str,
    profile: CompanyProfile,
    token_usage: int = 0,
) -> None:
    """Upsert profile ke cache. Idempotent — overwrite kalau sudah ada."""
    url_hash = hash_url(url)
    payload = {
        "url_hash":       url_hash,
        "normalized_url": normalize_url(url),
        "mode":           mode,
        "profile_jsonb":  profile.model_dump(mode="json"),
        "token_usage":    token_usage,
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # PostgREST upsert via Prefer: resolution=merge-duplicates.
            resp = await client.post(
                _table_url(),
                headers={
                    **_headers(),
                    "Prefer": "return=minimal,resolution=merge-duplicates",
                },
                json=payload,
            )
            resp.raise_for_status()
            logger.info("[cache] SET  | url=%s mode=%s", url[:60], mode)
    except Exception as exc:
        logger.warning("[cache] set failed (non-fatal): %s", exc)
