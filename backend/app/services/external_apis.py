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
    tbs: str | None = None,
) -> dict[str, Any]:
    """
    Kirim query ke Serper.dev (Google Search API gratis).

    Args:
        query:    String pencarian.
        endpoint: "search" untuk pencarian umum, "news" untuk berita.
        num:      Jumlah hasil yang diminta.
        tbs:      Time Binding Search — filter waktu Google (contoh: "qdr:y" = 1 tahun, "qdr:m" = 1 bulan).

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
    payload: dict[str, Any] = {"q": query, "num": num, "gl": "id", "hl": "id"}
    if tbs:
        payload["tbs"] = tbs

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


# ─── Hunter.io Email Finder ───────────────────────────────────────────────────

async def hunter_companies_find(domain: str) -> dict[str, Any]:
    """
    Hunter Companies Find — 1 API call ground truth metadata.

    Returns:
        Dict company info (name, industry, employees, founded, social, technologies).
        Empty dict jika gagal atau 404.
    """
    if not settings.HUNTER_API_KEY:
        logger.warning("[hunter] HUNTER_API_KEY belum diset — skip companies_find")
        return {}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.hunter.io/v2/companies/find",
                params={"domain": domain, "api_key": settings.HUNTER_API_KEY},
            )
            if resp.status_code == 404:
                logger.info("[hunter] companies_find 404 | domain=%s (no data)", domain)
                return {}
            resp.raise_for_status()
            data = resp.json().get("data") or {}
            logger.info(
                "[hunter] companies_find OK | domain=%s name=%r industry=%r",
                domain, data.get("name", "")[:40], data.get("industry", "")[:40],
            )
            return data
    except httpx.HTTPStatusError as exc:
        logger.warning("[hunter] companies_find HTTP %d | domain=%s", exc.response.status_code, domain)
        return {}
    except Exception as exc:
        logger.warning("[hunter] companies_find FAILED | domain=%s: %s", domain, exc)
        return {}


async def hunter_domain_search(domain: str, limit: int = 25) -> list[dict[str, Any]]:
    """
    Bulk lookup semua email yang diketahui Hunter untuk satu domain.
    Hanya 1 API credit untuk satu call (vs 1 credit per email-finder).

    Returns:
        List dict dengan keys: value, first_name, last_name, position, confidence.
        Empty list jika gagal atau tidak ada hasil.
    """
    if not settings.HUNTER_API_KEY:
        logger.warning("[hunter] HUNTER_API_KEY belum diset — skip domain_search")
        return []

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(
                "https://api.hunter.io/v2/domain-search",
                params={
                    "domain":  domain,
                    "limit":   limit,
                    "api_key": settings.HUNTER_API_KEY,
                },
            )
            if resp.status_code == 404:
                logger.info("[hunter] domain_search 404 | domain=%s (no data)", domain)
                return []
            resp.raise_for_status()
            emails = resp.json().get("data", {}).get("emails", []) or []
            logger.info("[hunter] domain_search OK | domain=%s found=%d", domain, len(emails))
            return emails
    except httpx.HTTPStatusError as exc:
        logger.warning("[hunter] domain_search HTTP %d | domain=%s", exc.response.status_code, domain)
        return []
    except Exception as exc:
        logger.warning("[hunter] domain_search FAILED | domain=%s: %s", domain, exc)
        return []


async def find_email_hunter(first_name: str, last_name: str, domain: str) -> str:
    """
    Cari email terverifikasi via Hunter.io Email Finder API.

    Returns:
        Email string jika ditemukan, "" jika tidak ada atau gagal.
    """
    if not settings.HUNTER_API_KEY:
        logger.warning("[hunter] HUNTER_API_KEY belum diset — skip")
        return ""

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.hunter.io/v2/email-finder",
                params={
                    "domain":     domain,
                    "first_name": first_name,
                    "last_name":  last_name,
                    "api_key":    settings.HUNTER_API_KEY,
                },
            )
            if resp.status_code == 404:
                logger.debug("[hunter] 404 NOT FOUND | %s %s @ %s", first_name, last_name, domain)
                return ""
            resp.raise_for_status()
            email = resp.json().get("data", {}).get("email") or ""
            if email:
                logger.info("[hunter] FOUND | %s %s @ %s → %s", first_name, last_name, domain, email)
            else:
                logger.debug("[hunter] NO EMAIL | %s %s @ %s", first_name, last_name, domain)
            return email
    except httpx.HTTPStatusError as exc:
        logger.warning("[hunter] HTTP %d | %s %s @ %s", exc.response.status_code, first_name, last_name, domain)
        return ""
    except Exception as exc:
        logger.warning("[hunter] FAILED | %s %s @ %s: %s", first_name, last_name, domain, exc)
        return ""


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


async def fetch_and_extract_urls(
    urls: list[str],
    max_urls: int = 3,
    timeout_per_url: float = 10.0,
) -> list[dict[str, Any]]:
    """
    Two-Pass utility: fetch full content dari top URLs via Jina Reader.
    Dipakai oleh Lane A, C, D, E untuk deep read setelah Pass 1 discovery.

    Returns:
        List dict { url, content, fetched_at } — hanya URL yang berhasil.
        Empty list jika semua gagal — tidak pernah raise exception.
    """
    import asyncio
    from datetime import datetime, timezone

    target_urls = [u for u in urls if u and u.strip()][:max_urls]
    if not target_urls:
        return []

    semaphore = asyncio.Semaphore(3)

    async def _fetch_one(url: str) -> dict[str, Any] | None:
        async with semaphore:
            try:
                content = await asyncio.wait_for(
                    fetch_jina_reader(url),
                    timeout=timeout_per_url,
                )
                if content and len(content) > 200:
                    return {
                        "url": url,
                        "content": content[:8000],
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                    }
                return None
            except asyncio.TimeoutError:
                logger.warning("[extract_urls] TIMEOUT | url=%r", url[:60])
                return None
            except Exception as exc:
                logger.warning("[extract_urls] FAILED | url=%r: %s", url[:60], exc)
                return None

    results = await asyncio.gather(*[_fetch_one(u) for u in target_urls])
    fetched = [r for r in results if r is not None]
    logger.info(
        "[extract_urls] DONE | requested=%d fetched=%d",
        len(target_urls), len(fetched),
    )
    return fetched
