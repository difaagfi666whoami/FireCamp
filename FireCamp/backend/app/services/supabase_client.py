"""
supabase_client.py — Lightweight async Supabase REST client via httpx.

Menggunakan Service Role Key untuk akses penuh tanpa RLS.
Tidak membutuhkan supabase-py — cukup httpx yang sudah terinstall.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _headers() -> dict[str, str]:
    """Headers standar untuk Supabase REST API."""
    return {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def fetch_table(
    table: str,
    select: str = "*",
    order: str | None = None,
) -> list[dict[str, Any]]:
    """
    GET seluruh baris dari tabel Supabase.

    Args:
        table:  Nama tabel (contoh: "products")
        select: Kolom yang diminta (default "*")
        order:  Kolom untuk ordering (contoh: "created_at.desc")

    Returns:
        List of dict (row data), atau [] jika gagal.
    """
    base_url = settings.NEXT_PUBLIC_SUPABASE_URL.rstrip("/")
    url = f"{base_url}/rest/v1/{table}?select={select}"
    if order:
        url += f"&order={order}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=_headers())
            resp.raise_for_status()
            data = resp.json()
            logger.info("[supabase] fetch_table OK | table=%s rows=%d", table, len(data))
            return data
    except Exception as exc:
        logger.error("[supabase] fetch_table FAILED | table=%s: %s", table, exc)
        return []
