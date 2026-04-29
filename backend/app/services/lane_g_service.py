"""
lane_g_service.py — Company Ground Truth via Hunter Companies Find.

Hunter Companies Find memberikan metadata ter-kurasi (industry, employees,
founded year, headquarters, social profiles, technology stack) untuk satu
domain. Cukup 1 API call.

Output: dict dengan keys: name, industry, employees, founded, hq, linkedin,
twitter, facebook, technologies, description. Field yang tidak ada di-default
ke string kosong / 0 / [] agar synthesizer aman dipakai langsung.
"""

from __future__ import annotations

import logging
from typing import Any

from app.services.external_apis import hunter_companies_find

logger = logging.getLogger(__name__)


def _format_hq(geo: dict[str, Any]) -> str:
    """Gabungkan city + country menjadi satu string HQ."""
    if not isinstance(geo, dict):
        return ""
    city = str(geo.get("city") or "").strip()
    country = str(geo.get("country") or "").strip()
    if city and country:
        return f"{city}, {country}"
    return city or country or ""


def _extract_socials(data: dict[str, Any]) -> dict[str, str]:
    """Hunter menyimpan social URL di top level (linkedin, twitter, facebook)."""
    return {
        "linkedin": str(data.get("linkedin") or "").strip(),
        "twitter":  str(data.get("twitter") or "").strip(),
        "facebook": str(data.get("facebook") or "").strip(),
    }


def _extract_employees(data: dict[str, Any]) -> int:
    """Coba ambil employees count → int. 0 jika tidak ada."""
    raw = data.get("metrics", {}).get("employees") if isinstance(data.get("metrics"), dict) else None
    if raw is None:
        raw = data.get("employees")
    try:
        return int(raw) if raw is not None else 0
    except (TypeError, ValueError):
        return 0


async def fetch_company_enrichment(domain: str) -> dict[str, Any]:
    """
    1 Hunter API call → metadata ground truth perusahaan.

    Args:
        domain: Domain perusahaan (tanpa schema, tanpa www).

    Returns:
        Dict dengan keys: name, industry, description, employees, founded, hq,
        linkedin, twitter, facebook, technologies.
        Semua field aman default jika data tidak ada.
    """
    logger.info("[lane_g] START | domain=%r", domain)

    output: dict[str, Any] = {
        "name":         "",
        "industry":     "",
        "description":  "",
        "employees":    0,
        "founded":      "",
        "hq":           "",
        "linkedin":     "",
        "twitter":      "",
        "facebook":     "",
        "technologies": [],
    }

    try:
        data = await hunter_companies_find(domain)
    except Exception as exc:
        logger.warning("[lane_g] companies_find FAILED: %s", exc)
        return output

    if not data:
        logger.info("[lane_g] DONE | empty (Hunter no data) | domain=%s", domain)
        return output

    socials = _extract_socials(data)
    output.update({
        "name":         str(data.get("name") or "").strip(),
        "industry":     str((data.get("category", {}).get("industry") if isinstance(data.get("category"), dict) else data.get("industry")) or "").strip(),
        "description":  str(data.get("description") or "").strip(),
        "employees":    _extract_employees(data),
        "founded":      str(data.get("foundedYear") or data.get("founded") or "").strip(),
        "hq":           _format_hq(data.get("geo") or {}),
        "linkedin":     socials["linkedin"],
        "twitter":      socials["twitter"],
        "facebook":     socials["facebook"],
        "technologies": data.get("tech", []) if isinstance(data.get("tech"), list) else [],
    })

    logger.info(
        "[lane_g] DONE | name=%r industry=%r employees=%d founded=%s techs=%d",
        output["name"][:40],
        output["industry"][:40],
        output["employees"],
        output["founded"],
        len(output["technologies"]),
    )
    return output
