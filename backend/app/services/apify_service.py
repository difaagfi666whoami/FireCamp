"""
apify_service.py — Contact Discovery via 2-step Apify pipeline.

Step 1: apify~google-search-scraper
  → Query LinkedIn dengan target jabatan, ambil 3 URL terbaik.

Step 2: dev_fusion~linkedin-profile-scraper
  → Scrape profil LinkedIn secara kaya (nama, jabatan, email, lokasi,
    koneksi, about, durasi jabatan) dari ke-3 URL tersebut.

Fallback: Jika Step 2 gagal/timeout, kembalikan data dasar dari
  Google Snippet sebagai RawContact standar.

Menggunakan httpx async. Error ditangani tanpa merusak eksekusi Lane A.
"""

from __future__ import annotations

import logging
from typing import Any, TypedDict

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

APIFY_BASE_URL = "https://api.apify.com/v2"
GOOGLE_SEARCH_ACTOR = "apify~google-search-scraper"
LINKEDIN_SCRAPER_ACTOR = "dev_fusion~linkedin-profile-scraper"

MAX_LINKEDIN_URLS = 3
LINKEDIN_SCRAPER_TIMEOUT = 90.0   # actor LinkedIn lebih lambat — beri waktu lebih


class RawContact(TypedDict, total=False):
    """Struktur kontak hasil pipeline Apify (diperkaya dari LinkedIn scraper)."""
    id:            str
    name:          str
    title:         str
    email:         str
    phone:         str
    linkedin_url:  str
    location:      str   # NEW — dari LinkedIn profile
    connections:   str   # NEW — jumlah koneksi, e.g. "500+"
    about:         str   # NEW — summary/about section
    role_duration: str   # NEW — lama menjabat, e.g. "2 tahun 3 bulan"
    source:        str


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _build_token_params(extra: dict | None = None) -> dict:
    params: dict = {"token": settings.APIFY_API_TOKEN}
    if extra:
        params.update(extra)
    return params


def _map_google_snippet(item: dict[str, Any]) -> RawContact | None:
    """
    Petakan satu organicResult dari Google Search ke RawContact dasar.
    Return None jika URL bukan profil LinkedIn.
    """
    url = item.get("url", "")
    if "linkedin.com/in/" not in url:
        return None

    title_text = item.get("title", "")
    desc_text = item.get("description", "")

    name_parts = title_text.split(" - ")
    name = name_parts[0].strip() if name_parts else title_text
    role = name_parts[1].strip() if len(name_parts) > 1 else desc_text[:100]

    return RawContact(
        id=url,
        name=name,
        title=role,
        linkedin_url=url,
        email="",
        phone="",
        source="apify",
    )


def _map_linkedin_profile(profile: dict[str, Any]) -> RawContact:
    """
    Petakan satu objek hasil dev_fusion~linkedin-profile-scraper ke RawContact kaya.

    Field yang di-map (nama field mengikuti output actor):
      fullName / name          → name
      headline / title         → title
      email                    → email
      location                 → location
      connectionsCount         → connections
      summary / about          → about
      positions[0].duration    → role_duration
      linkedInUrl / profileUrl → linkedin_url
    """
    name = (
        profile.get("fullName")
        or profile.get("name")
        or ""
    )
    title = (
        profile.get("headline")
        or profile.get("title")
        or ""
    )
    email = profile.get("email") or ""

    location = profile.get("location") or profile.get("geoRegion") or ""

    connections_raw = (
        profile.get("connectionsCount")
        or profile.get("connections")
        or ""
    )
    connections = str(connections_raw) if connections_raw else ""

    about = (
        profile.get("summary")
        or profile.get("about")
        or profile.get("description")
        or ""
    )

    # Ambil durasi dari jabatan pertama / terkini
    role_duration = ""
    positions = profile.get("positions") or profile.get("experience") or []
    if positions and isinstance(positions, list):
        first_pos = positions[0] if isinstance(positions[0], dict) else {}
        role_duration = (
            first_pos.get("duration")
            or first_pos.get("dateRange")
            or ""
        )

    linkedin_url = (
        profile.get("linkedInUrl")
        or profile.get("profileUrl")
        or profile.get("url")
        or ""
    )
    if linkedin_url and not linkedin_url.startswith("http"):
        linkedin_url = f"https://www.linkedin.com/in/{linkedin_url}"

    return RawContact(
        id=linkedin_url or name,
        name=name,
        title=title,
        email=email,
        phone="",
        linkedin_url=linkedin_url,
        location=location,
        connections=connections,
        about=about,
        role_duration=role_duration,
        source="apify",
    )


# ─── Step 1: Google Search → LinkedIn URLs ────────────────────────────────────

async def _get_linkedin_urls(domain: str, max_urls: int = MAX_LINKEDIN_URLS) -> tuple[list[str], list[RawContact]]:
    """
    Panggil apify~google-search-scraper untuk mencari profil LinkedIn
    dari domain target.

    Returns:
        (linkedin_urls, fallback_contacts)
        - linkedin_urls     : list URL LinkedIn yang ditemukan
        - fallback_contacts : RawContact dari Google Snippet (dipakai jika step 2 gagal)
    """
    query = (
        f'site:linkedin.com/in "{domain}" '
        '(VP OR "Head of" OR Director OR Manager OR CMO OR CTO OR COO OR "Growth Lead")'
    )

    logger.info("[apify] step1_google_search | domain=%r query=%r", domain, query)

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{APIFY_BASE_URL}/acts/{GOOGLE_SEARCH_ACTOR}/run-sync-get-dataset-items",
            params=_build_token_params({"timeout": 45}),
            json={
                "queries": query,
                "maxPagesPerQuery": 1,
                "resultsPerPage": max_urls + 3,   # lebih untuk filter
            },
        )

    if resp.status_code >= 400:
        raise RuntimeError(
            f"Apify Google Search error {resp.status_code}: {resp.text[:200]}"
        )

    search_items: list[dict] = resp.json()

    fallback_contacts: list[RawContact] = []
    linkedin_urls: list[str] = []

    for top_item in search_items:
        organic_results = top_item.get("organicResults", [])
        for item in organic_results:
            contact = _map_google_snippet(item)
            if contact is None:
                continue
            fallback_contacts.append(contact)
            url = contact.get("linkedin_url", "")
            if url and url not in linkedin_urls:
                linkedin_urls.append(url)
            if len(linkedin_urls) >= max_urls:
                break
        if len(linkedin_urls) >= max_urls:
            break

    logger.info(
        "[apify] step1_google_search OK | found=%d urls=%d",
        len(fallback_contacts),
        len(linkedin_urls),
    )
    return linkedin_urls, fallback_contacts


# ─── Step 2: LinkedIn Profile Scraper ────────────────────────────────────────

async def _scrape_linkedin_profiles(linkedin_urls: list[str]) -> list[RawContact]:
    """
    Panggil dev_fusion~linkedin-profile-scraper dengan list URL LinkedIn.
    Menggunakan endpoint /run-sync-get-dataset-items.

    Returns:
        list[RawContact] dengan data super-kaya (email, location, about, dll.)

    Raises:
        RuntimeError jika actor gagal atau timeout.
    """
    if not linkedin_urls:
        return []

    logger.info(
        "[apify] step2_linkedin_scraper | urls=%d actor=%s",
        len(linkedin_urls),
        LINKEDIN_SCRAPER_ACTOR,
    )

    async with httpx.AsyncClient(timeout=LINKEDIN_SCRAPER_TIMEOUT) as client:
        resp = await client.post(
            f"{APIFY_BASE_URL}/acts/{LINKEDIN_SCRAPER_ACTOR}/run-sync-get-dataset-items",
            params=_build_token_params({"timeout": int(LINKEDIN_SCRAPER_TIMEOUT - 15)}),
            json={
                "profileUrls": linkedin_urls,
                "proxyConfiguration": {"useApifyProxy": True},
            },
        )

    if resp.status_code >= 400:
        raise RuntimeError(
            f"dev_fusion LinkedIn scraper error {resp.status_code}: {resp.text[:200]}"
        )

    profiles: list[dict] = resp.json()
    if not isinstance(profiles, list):
        # Beberapa actor membungkus hasil di key
        profiles = profiles.get("items", []) if isinstance(profiles, dict) else []

    contacts = [_map_linkedin_profile(p) for p in profiles if isinstance(p, dict)]

    logger.info("[apify] step2_linkedin_scraper OK | scraped=%d", len(contacts))
    return contacts


# ─── Public API ───────────────────────────────────────────────────────────────

async def search_by_domain(domain: str, *, max_results: int = 5) -> list[RawContact]:
    """
    Pipeline 2-step Apify Contact Discovery:

    1. Google Search → ambil 3 URL LinkedIn terbaik (+ simpan fallback snippet)
    2. LinkedIn Scraper → scrape profil kaya per URL

    Jika step 2 gagal/timeout, kembalikan data fallback dari Google Snippet.
    Error handling tidak merusak eksekusi Lane A.

    Args:
        domain:      Domain perusahaan, e.g. "kreasidigital.co.id"
        max_results: Jumlah kontak maksimum yang dikembalikan

    Returns:
        list[RawContact] — bisa kosong jika semua step gagal.
    """
    if not settings.APIFY_API_TOKEN:
        raise RuntimeError("APIFY_API_TOKEN belum diset di .env.local")

    # ── Step 1: Google Search ────────────────────────────────────────────────
    try:
        linkedin_urls, fallback_contacts = await _get_linkedin_urls(
            domain, max_urls=MAX_LINKEDIN_URLS
        )
    except Exception as exc:
        logger.error("[apify] step1 FAILED | domain=%r error=%s", domain, exc)
        raise RuntimeError(f"Apify Google Search gagal: {exc}") from exc

    # ── Step 2: LinkedIn Scraper (kaya data) ─────────────────────────────────
    if linkedin_urls:
        try:
            rich_contacts = await _scrape_linkedin_profiles(linkedin_urls)
            if rich_contacts:
                logger.info(
                    "[apify] pipeline OK (rich) | domain=%r contacts=%d",
                    domain,
                    len(rich_contacts),
                )
                return rich_contacts[:max_results]
            else:
                logger.warning(
                    "[apify] step2 returned 0 results, menggunakan fallback snippet"
                )
        except Exception as exc:
            logger.warning(
                "[apify] step2 (LinkedIn scraper) FAILED | error=%s | "
                "menggunakan fallback Google Snippet",
                exc,
            )

    # ── Fallback: Google Snippet data ────────────────────────────────────────
    if fallback_contacts:
        logger.info(
            "[apify] pipeline OK (fallback) | domain=%r contacts=%d",
            domain,
            len(fallback_contacts),
        )
        return fallback_contacts[:max_results]

    logger.warning("[apify] pipeline: tidak ada kontak ditemukan untuk domain=%r", domain)
    return []
