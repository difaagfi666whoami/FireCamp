"""
apollo_service.py — wrapper untuk Apollo.io People Search API.

Endpoint yang digunakan: POST /v1/mixed_people/search
Dipakai di Lane B (Contact Discovery) untuk mode Pro dan Free.

Mengembalikan list RawContact (dict) yang kemudian di-score oleh Claude Haiku
di anthropic_service. Apify fallback diaktifkan oleh pipeline orchestrator
jika jumlah hasil Apollo < FALLBACK_THRESHOLD (2 kontak).
"""

from __future__ import annotations

import logging
from typing import Any, TypedDict

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

APOLLO_BASE_URL = "https://api.apollo.io/v1"
FALLBACK_THRESHOLD = 2   # aktifkan Apify jika Apollo < 2 hasil

# Role titles target sesuai architecture.md
TARGET_TITLES: list[str] = [
    "VP Marketing",
    "VP of Marketing",
    "Head of Marketing",
    "Head of Digital Marketing",
    "Marketing Director",
    "Digital Marketing Manager",
    "CMO",
    "Chief Marketing Officer",
    "CTO",
    "Chief Technology Officer",
    "COO",
    "Operations Director",
    "Growth Manager",
    "Growth Lead",
]


class RawContact(TypedDict, total=False):
    """Struktur minimal hasil mapping dari Apollo people object."""
    id:          str
    name:        str
    title:       str
    email:       str
    phone:       str
    linkedin_url: str


def _map_person(person: dict[str, Any]) -> RawContact:
    """Petakan satu object Apollo 'person' ke RawContact yang lean."""
    # Apollo mengembalikan email di 'email' atau 'personal_emails[0]'
    email = person.get("email") or ""
    if not email:
        personal = person.get("personal_emails") or []
        if personal:
            email = personal[0]

    # Nomor telepon: ambil dari sanitized_phone atau phone_numbers[0].sanitized_number
    phone = person.get("sanitized_phone") or ""
    if not phone:
        phone_numbers = person.get("phone_numbers") or []
        if phone_numbers:
            phone = phone_numbers[0].get("sanitized_number", "")

    return RawContact(
        id=person.get("id", ""),
        name=person.get("name", ""),
        title=person.get("title", ""),
        email=email,
        phone=phone,
        linkedin_url=person.get("linkedin_url", ""),
    )


async def search_contacts(
    domain: str,
    *,
    titles: list[str] | None = None,
    per_page: int = 10,
) -> list[RawContact]:
    """
    Cari kontak PIC di domain perusahaan target menggunakan Apollo People Search.

    Args:
        domain:   Domain perusahaan, e.g. "kreasidigital.co.id"
        titles:   Filter jabatan; default = TARGET_TITLES dari architecture.md
        per_page: Jumlah kontak yang diminta (Apollo max 100)

    Returns:
        list[RawContact] — bisa kosong jika tidak ditemukan atau API gagal.

    Raises:
        RuntimeError jika Apollo API mengembalikan status error (4xx/5xx).
    """
    if not settings.APOLLO_API_KEY:
        raise RuntimeError("APOLLO_API_KEY belum diset di .env.local")

    target_titles = titles if titles is not None else TARGET_TITLES
    payload: dict[str, Any] = {
        "q_organization_domains_list": [domain],
        "person_titles":               target_titles,
        "per_page":                    per_page,
        "page":                        1,
    }
    headers = {
        "Content-Type":  "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key":     settings.APOLLO_API_KEY,
    }

    logger.info("[apollo] search_contacts | domain=%r titles_count=%d", domain, len(target_titles))

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{APOLLO_BASE_URL}/mixed_people/search",
                json=payload,
                headers=headers,
            )

        if resp.status_code == 401:
            raise RuntimeError("Apollo API key tidak valid atau tidak aktif.")
        if resp.status_code == 429:
            raise RuntimeError("Apollo API rate limit tercapai. Coba lagi nanti.")
        if resp.status_code >= 400:
            detail = resp.json().get("message", resp.text)
            raise RuntimeError(f"Apollo API error {resp.status_code}: {detail}")

        data = resp.json()
        people: list[dict] = data.get("people") or []
        contacts = [_map_person(p) for p in people]

        logger.info("[apollo] search_contacts OK | found=%d domain=%r", len(contacts), domain)
        return contacts

    except RuntimeError:
        raise
    except Exception as exc:
        logger.error("[apollo] search_contacts FAILED | domain=%r error=%s", domain, exc)
        raise RuntimeError(
            f"Apollo kontak search gagal untuk domain '{domain}': {exc}"
        ) from exc


def needs_fallback(contacts: list[RawContact]) -> bool:
    """
    Return True jika jumlah kontak Apollo di bawah FALLBACK_THRESHOLD,
    sehingga pipeline perlu mengaktifkan Apify fallback.
    """
    return len(contacts) < FALLBACK_THRESHOLD
