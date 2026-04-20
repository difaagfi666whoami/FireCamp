"""
lane_d_service.py — Hiring Signals via Serper Job Board Dorking.

Mengumpulkan sinyal "buying intent" dari lowongan kerja yang sedang dibuka
perusahaan target. Job posting reveals: investasi tim, transisi teknologi,
ekspansi geografis, dan pain points yang sedang aktif diselesaikan.

Output: list[dict] kompatibel dengan NewsItem schema (signal_type="hiring").
Title selalu di-prefix "[LOWONGAN] " agar visible di UI.
"""

from __future__ import annotations

import logging
from typing import Any

from app.services.external_apis import search_serper

logger = logging.getLogger(__name__)

JOB_BOARDS = [
    "site:linkedin.com/jobs",
    "site:glints.com/id/opportunities",
    "site:jobstreet.co.id",
    "site:kalibrr.com",
]


def _detect_source(link: str) -> str:
    if "linkedin.com" in link:
        return "LinkedIn Jobs"
    if "glints.com" in link:
        return "Glints"
    if "jobstreet" in link:
        return "JobStreet"
    if "kalibrr" in link:
        return "Kalibrr"
    return "Job Board"


async def _deep_read_hiring_signals(
    raw_results: list[dict[str, Any]],
    company_name: str,
) -> list[dict[str, Any]]:
    """
    Pass 2: Fetch halaman job posting via Jina, extract sinyal bisnis spesifik.
    Graceful fallback ke raw_results jika fetch gagal.
    """
    import json as _json
    from openai import AsyncOpenAI
    from app.services.external_apis import fetch_and_extract_urls
    from app.core.config import settings

    top_urls = [r["url"] for r in raw_results[:3] if r.get("url")]
    if not top_urls:
        return raw_results

    fetched_pages = await fetch_and_extract_urls(top_urls, max_urls=3)
    if not fetched_pages:
        return raw_results

    client    = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    enriched: list[dict[str, Any]] = []

    for page in fetched_pages:
        url      = page["url"]
        content  = page["content"]
        original = next((r for r in raw_results if r.get("url") == url), {})

        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=400,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Kamu adalah analis B2B. Dari halaman lowongan kerja ini, "
                            "ekstrak sinyal bisnis yang relevan untuk sales outbound. "
                            "HANYA fakta yang ada di halaman — jangan inference. "
                            "Balas JSON: {"
                            "\"job_title\": string, "
                            "\"key_requirements\": [string], "
                            "\"team_signal\": string, "
                            "\"business_signal\": string, "
                            "\"verified_date\": string|null"
                            "}"
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Perusahaan: {company_name}\n"
                            f"URL: {url}\n\n"
                            f"Konten halaman:\n{content[:3000]}"
                        ),
                    },
                ],
            )
            parsed = _json.loads(response.choices[0].message.content or "{}")
            reqs   = parsed.get("key_requirements", [])[:3]
            enriched.append({
                "title":        f"[LOWONGAN] {parsed.get('job_title', original.get('title', ''))}",
                "date":         parsed.get("verified_date") or original.get("date", ""),
                "source":       original.get("source", "Job Board"),
                "summary": (
                    f"{parsed.get('business_signal', '')}. "
                    f"Requirements: {', '.join(reqs)}"
                ).strip(". "),
                "url":          url,
                "signal_type":  "hiring",
                "verifiedDate": parsed.get("verified_date"),
            })
        except Exception as exc:
            logger.warning("[lane_d] _deep_read FAILED url=%r: %s", url[:60], exc)
            enriched.append(original)

    return enriched if enriched else raw_results


async def fetch_hiring_signals(
    company_name: str,
    domain: str,
    *,
    max_items: int = 4,
) -> list[dict[str, Any]]:
    """
    Cari lowongan kerja perusahaan target dari job board populer.

    Args:
        company_name: Nama perusahaan target.
        domain:       Domain perusahaan (untuk validasi tambahan).
        max_items:    Maksimal item yang dikembalikan.

    Returns:
        List dict NewsItem-compat dengan signal_type="hiring".
    """
    logger.info("[lane_d] START | company=%r", company_name)

    boards_filter = " OR ".join(JOB_BOARDS)
    query = f'({boards_filter}) "{company_name}"'

    try:
        data = await search_serper(query, endpoint="search", num=10)
    except Exception as exc:
        logger.warning("[lane_d] Serper FAILED: %s", exc)
        return []

    organic = data.get("organic", []) or []
    company_lower = company_name.lower()
    domain_keyword = domain.split(".")[0].lower() if domain else ""

    results: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in organic:
        link = item.get("link", "")
        if not link or link in seen:
            continue
        seen.add(link)

        title = item.get("title", "").strip()
        snippet = item.get("snippet", "").strip()
        combined = f"{title} {snippet}".lower()

        mention_company = company_lower in combined
        mention_domain = bool(domain_keyword) and len(domain_keyword) > 3 and domain_keyword in combined
        if not (mention_company or mention_domain):
            continue

        results.append({
            "title":       f"[LOWONGAN] {title}",
            "date":        item.get("date", ""),
            "source":      _detect_source(link),
            "summary":     snippet,
            "url":         link,
            "signal_type": "hiring",
        })
        if len(results) >= max_items:
            break

    # Pass 2: deep read untuk enriched summaries
    if results:
        results = await _deep_read_hiring_signals(results, company_name)

    logger.info("[lane_d] DONE | hiring_signals=%d", len(results))
    return results[:max_items]
