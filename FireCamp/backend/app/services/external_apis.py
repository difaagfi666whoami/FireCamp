"""
external_apis.py — Async wrappers untuk Serper.dev dan Jina Reader.

Menggantikan Apify dan Apollo yang terkendala paywall.
Semua fungsi bersifat async dan menggunakan httpx secara internal.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── Serper.dev ───────────────────────────────────────────────────────────────

async def search_serper(
    query: str,
    endpoint: str = "search",
    num: int = 5,
) -> dict[str, Any]:
    """
    Kirim query ke Serper.dev (Google Search API gratis).

    Args:
        query:    String pencarian.
        endpoint: "search" untuk pencarian umum, "news" untuk berita.
        num:      Jumlah hasil yang diminta.

    Returns:
        dict JSON response dari Serper, atau {} jika gagal.
    """
    if not settings.SERPER_API_KEY:
        logger.error("[serper] SERPER_API_KEY belum diset di .env.local")
        return {}

    url = f"https://google.serper.dev/{endpoint}"
    headers = {
        "X-API-KEY": settings.SERPER_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {"q": query, "num": num, "gl": "id", "hl": "id"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            logger.info(
                "[serper] OK | endpoint=%s query=%r results=%d",
                endpoint,
                query[:60],
                len(data.get("organic", data.get("news", []))),
            )
            return data
    except httpx.HTTPStatusError as exc:
        logger.error("[serper] HTTP %d | query=%r: %s", exc.response.status_code, query[:60], exc)
        return {}
    except Exception as exc:
        logger.error("[serper] FAILED | query=%r: %s", query[:60], exc)
        return {}


# ─── Jina Reader ──────────────────────────────────────────────────────────────

async def fetch_jina_reader(url: str) -> str:
    """
    Baca konten sebuah URL melalui Jina Reader (r.jina.ai).
    Mengembalikan teks markdown dari halaman target.

    PENTING:
    - Timeout 15 detik untuk menghindari hang pada situs anti-bot.
    - Error ditangkap rapat dan mengembalikan string kosong ""
      agar tidak memutuskan event loop asyncio.gather yang lain.

    Args:
        url: URL halaman yang akan dibaca.

    Returns:
        String markdown konten halaman, atau "" jika gagal.
    """
    jina_url = f"https://r.jina.ai/{url}"
    headers: dict[str, str] = {
        "Accept": "text/plain",
    }
    # Jina API key opsional — jika ada, tambahkan untuk rate limit lebih tinggi
    if settings.JINA_API_KEY:
        headers["Authorization"] = f"Bearer {settings.JINA_API_KEY}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(jina_url, headers=headers)
            resp.raise_for_status()
            text = resp.text
            logger.info("[jina] OK | url=%r chars=%d", url[:60], len(text))
            return text
    except httpx.TimeoutException:
        logger.warning("[jina] TIMEOUT (15s) | url=%r — mengembalikan kosong", url[:60])
        return ""
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "[jina] HTTP %d | url=%r — mengembalikan kosong",
            exc.response.status_code,
            url[:60],
        )
        return ""
    except Exception as exc:
        logger.warning("[jina] FAILED | url=%r: %s — mengembalikan kosong", url[:60], exc)
        return ""
