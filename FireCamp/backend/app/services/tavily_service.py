"""
tavily_service.py — wrapper untuk tiga operasi Tavily API:

  • search()   → Tavily /search  (Free mode: riset umum + berita)
  • research() → Tavily /research (Pro mode: deep autonomous multi-step)
  • extract()  → Tavily /extract  (semua mode: baca konten mentah dari URL)

Setiap fungsi me-return dict mentah dari SDK agar layer pipeline yang memanggil
bisa mengolahnya sesuai kebutuhan (tidak ada business logic di sini).
"""

from __future__ import annotations

import logging
from typing import Any

from tavily import AsyncTavilyClient

from app.core.config import settings

logger = logging.getLogger(__name__)

# Singleton client — re-used lintas request untuk efisiensi koneksi
_client: AsyncTavilyClient | None = None


def _get_client() -> AsyncTavilyClient:
    global _client
    if _client is None:
        if not settings.TAVILY_API_KEY:
            raise RuntimeError("TAVILY_API_KEY belum diset di .env.local")
        _client = AsyncTavilyClient(api_key=settings.TAVILY_API_KEY)
    return _client


# ─── search ──────────────────────────────────────────────────────────────────

async def search(
    query: str,
    *,
    search_depth: str = "basic",        # "basic" | "advanced"
    topic: str = "general",             # "general" | "news"
    max_results: int = 5,
    include_answer: bool = True,
    include_raw_content: bool = False,
) -> dict[str, Any]:
    """
    Jalankan Tavily /search.

    Dipakai di Free mode recon pipeline:
      - query umum untuk overview perusahaan  (topic="general")
      - query berita terbaru                  (topic="news")

    Returns:
        dict berisi 'answer' (str), 'results' (list[dict]) dari Tavily.

    Raises:
        RuntimeError jika API call gagal.
    """
    client = _get_client()
    try:
        logger.info("[tavily] search | query=%r topic=%s depth=%s", query, topic, search_depth)
        response = await client.search(
            query=query,
            search_depth=search_depth,
            topic=topic,
            max_results=max_results,
            include_answer=include_answer,
            include_raw_content=include_raw_content,
        )
        logger.info(
            "[tavily] search OK | results=%d",
            len(response.get("results", [])),
        )
        return response
    except Exception as exc:
        logger.error("[tavily] search FAILED | query=%r error=%s", query, exc)
        raise RuntimeError(
            f"Tavily Search gagal untuk query '{query}': {exc}"
        ) from exc


# ─── research ────────────────────────────────────────────────────────────────

async def research(
    query: str,
    *,
    max_results: int = 10,
    include_answer: bool = True,
    include_raw_content: bool = True,
) -> dict[str, Any]:
    """
    Jalankan Tavily /research (autonomous deep research, Pro mode only).

    Dipakai di Pro mode recon pipeline untuk Lane A (company profiling).
    Tavily /research melakukan multi-step reasoning otomatis — lebih lambat
    tapi menghasilkan synthesis yang jauh lebih mendalam.

    Returns:
        dict berisi 'answer' (str panjang), 'results' (list[dict]).

    Raises:
        RuntimeError jika API call gagal.
    """
    client = _get_client()
    try:
        logger.info("[tavily] research | query=%r", query)
        # Tavily research menggunakan search dengan search_depth="advanced"
        # dan topic="general" sebagai proxy untuk deep research
        response = await client.search(
            query=query,
            search_depth="advanced",
            topic="general",
            max_results=max_results,
            include_answer=include_answer,
            include_raw_content=include_raw_content,
        )
        logger.info(
            "[tavily] research OK | results=%d",
            len(response.get("results", [])),
        )
        return response
    except Exception as exc:
        logger.error("[tavily] research FAILED | query=%r error=%s", query, exc)
        raise RuntimeError(
            f"Tavily Research gagal untuk query '{query}': {exc}"
        ) from exc


# ─── extract ─────────────────────────────────────────────────────────────────

async def extract(urls: list[str]) -> dict[str, Any]:
    """
    Jalankan Tavily /extract pada satu atau lebih URL.

    Dipakai di semua mode sebagai Step 0 pipeline:
    membaca homepage target untuk mendapatkan nama, domain, dan industri
    (ground truth sebelum search/research dimulai).

    Args:
        urls: list URL yang akan di-extract (max ~5 per call untuk efisiensi).

    Returns:
        dict berisi 'results' (list[dict]) — setiap item punya 'url' dan 'raw_content'.

    Raises:
        RuntimeError jika semua URL gagal di-extract.
    """
    if not urls:
        return {"results": []}

    client = _get_client()
    try:
        logger.info("[tavily] extract | urls=%s", urls)
        response = await client.extract(urls=urls)
        success_count = len(response.get("results", []))
        failed_count  = len(response.get("failed_results", []))
        logger.info(
            "[tavily] extract OK | success=%d failed=%d",
            success_count,
            failed_count,
        )
        return response
    except Exception as exc:
        logger.error("[tavily] extract FAILED | urls=%s error=%s", urls, exc)
        raise RuntimeError(
            f"Tavily Extract gagal untuk URL {urls}: {exc}"
        ) from exc
