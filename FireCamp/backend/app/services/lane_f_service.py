"""
lane_f_service.py — Deep Site Crawl via Tavily Multi-URL Extract.

Homepage saja seringkali tidak cukup. Halaman /about, /products, /services,
/careers, /clients membawa sinyal jauh lebih kaya: tim manajemen,
katalog produk lengkap, daftar klien, posisi yang sedang dibuka.

Output: dict dengan content per page-type yang berhasil di-fetch.
Field yang tidak ditemukan di-default ke string kosong.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.services import tavily_service

logger = logging.getLogger(__name__)

CANDIDATE_PATHS: list[str] = [
    "/about", "/about-us", "/tentang-kami",
    "/products", "/services", "/solutions",
    "/clients", "/customers", "/case-studies",
    "/careers", "/jobs", "/lowongan",
    "/team", "/leadership", "/management",
]


def _strip_noise(text: str) -> str:
    """Bersihkan markdown/HTML/nav noise dari raw_content Tavily."""
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{2,}", "\n", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


def _bucket_for_url(url: str) -> str | None:
    """Map URL path → bucket key dalam output dict."""
    url_lower = url.lower()
    if any(k in url_lower for k in ["/about", "/tentang"]):
        return "about"
    if any(k in url_lower for k in ["/products", "/services", "/solutions"]):
        return "products"
    if any(k in url_lower for k in ["/clients", "/customers", "/case"]):
        return "clients"
    if any(k in url_lower for k in ["/careers", "/jobs", "/lowongan"]):
        return "careers"
    if any(k in url_lower for k in ["/team", "/leadership", "/management"]):
        return "team"
    return None


async def deep_site_crawl(
    base_url: str,
    *,
    max_paths: int = 6,
    snippet_chars: int = 1500,
) -> dict[str, Any]:
    """
    Tavily extract pada beberapa URL kandidat di domain target.

    Args:
        base_url:      URL homepage (dengan/tanpa schema).
        max_paths:     Maksimal path yang diuji.
        snippet_chars: Maksimal karakter per page yang disimpan.

    Returns:
        Dict dengan keys: about, products, clients, careers, team, raw_pages.
        Semua string default ke "" jika page tidak ada.
    """
    logger.info("[lane_f] START | base=%r", base_url)

    base = base_url.rstrip("/")
    if not base.startswith("http"):
        base = f"https://{base}"

    candidate_urls = [f"{base}{path}" for path in CANDIDATE_PATHS[:max_paths]]

    output: dict[str, Any] = {
        "about":     "",
        "products":  "",
        "clients":   "",
        "careers":   "",
        "team":      "",
        "raw_pages": [],
    }

    try:
        resp = await tavily_service.extract(candidate_urls)
    except Exception as exc:
        logger.warning("[lane_f] extract FAILED: %s", exc)
        return output

    results = resp.get("results", []) or []
    pages_found = 0

    for r in results:
        url = r.get("url", "")
        content = (r.get("raw_content") or "")[:snippet_chars * 2]
        if not content:
            continue

        clean = _strip_noise(content)
        if not clean:
            continue

        bucket = _bucket_for_url(url)
        snippet = clean[:snippet_chars]

        output["raw_pages"].append({"url": url, "content": snippet})

        if bucket and not output[bucket]:
            output[bucket] = snippet
            pages_found += 1

    logger.info(
        "[lane_f] DONE | pages_categorized=%d total_raw=%d",
        pages_found, len(output["raw_pages"]),
    )
    return output
