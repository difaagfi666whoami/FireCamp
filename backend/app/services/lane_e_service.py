"""
lane_e_service.py — Money & Leadership Signals via Serper News.

Sinyal "kapan harus approach" — funding, M&A, leadership change, partnership.
Sinyal-sinyal ini menentukan "why now" yang membuat outreach campaign relevan.

Output: list[dict] kompatibel dengan NewsItem schema dengan signal_type spesifik.
Title selalu di-prefix tag (mis. "[FUNDING] ", "[KEPEMIMPINAN] ") agar visible di UI.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.services.external_apis import search_serper

logger = logging.getLogger(__name__)


async def _query_signal(
    company_name: str,
    keywords: str,
    signal_type: str,
    prefix: str,
) -> list[dict[str, Any]]:
    """1 Serper /news call → list of NewsItem-compat dicts."""
    query = f'"{company_name}" ({keywords})'
    try:
        data = await search_serper(query, endpoint="news", num=4, tbs="qdr:y")
    except Exception as exc:
        logger.warning("[lane_e] Serper FAILED | signal=%s: %s", signal_type, exc)
        return []

    articles = data.get("news", []) or []
    company_lower = company_name.lower()

    results: list[dict[str, Any]] = []
    for art in articles:
        title = art.get("title", "").strip()
        snippet = art.get("snippet", art.get("description", "")).strip()
        combined = f"{title} {snippet}".lower()

        if company_lower not in combined:
            continue

        results.append({
            "title":       f"[{prefix}] {title}",
            "date":        art.get("date", ""),
            "source":      art.get("source", ""),
            "summary":     snippet,
            "url":         art.get("link", ""),
            "signal_type": signal_type,
        })
    return results


async def _deep_read_money_signal(
    raw_items: list[dict[str, Any]],
    company_name: str,
    signal_type: str,
) -> list[dict[str, Any]]:
    """
    Pass 2: Baca artikel funding/leadership secara penuh untuk verified facts.
    Graceful fallback ke raw_items jika fetch gagal.
    """
    import json as _json
    from openai import AsyncOpenAI
    from app.services.external_apis import fetch_and_extract_urls
    from app.core.config import settings

    top_urls = [r["url"] for r in raw_items[:2] if r.get("url")]
    if not top_urls:
        return raw_items

    fetched_pages = await fetch_and_extract_urls(top_urls, max_urls=2)
    if not fetched_pages:
        return raw_items

    client   = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    enriched: list[dict[str, Any]] = []

    for page in fetched_pages:
        url      = page["url"]
        content  = page["content"]
        original = next((r for r in raw_items if r.get("url") == url), {})

        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=350,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Ekstrak HANYA fakta dari artikel ini. "
                            "DILARANG inference atau tambah informasi. "
                            "Balas JSON: {"
                            "\"verified_amount\": string|null, "
                            "\"verified_date\": string|null, "
                            "\"key_actors\": [string], "
                            "\"use_of_funds\": string|null, "
                            "\"summary_one_sentence\": string"
                            "}"
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Perusahaan: {company_name}\n"
                            f"Tipe sinyal: {signal_type}\n\n"
                            f"Konten artikel:\n{content[:3000]}"
                        ),
                    },
                ],
            )
            parsed = _json.loads(response.choices[0].message.content or "{}")
            enriched.append({
                **original,
                "summary":        parsed.get("summary_one_sentence") or original.get("summary", ""),
                "verifiedAmount": parsed.get("verified_amount"),
                "verifiedDate":   parsed.get("verified_date"),
            })
        except Exception as exc:
            logger.warning("[lane_e] _deep_read FAILED url=%r signal=%s: %s", url[:60], signal_type, exc)
            enriched.append(original)

    return enriched if enriched else raw_items


async def fetch_money_signals(
    company_name: str,
    *,
    max_items: int = 6,
) -> list[dict[str, Any]]:
    """
    Cari berita funding, M&A, leadership change, partnership secara paralel.

    Args:
        company_name: Nama perusahaan target.
        max_items:    Maksimal item gabungan dari semua kategori.

    Returns:
        List dict NewsItem-compat, deduplicated by URL.
    """
    logger.info("[lane_e] START | company=%r", company_name)

    queries = [
        ("funding OR investasi OR raises OR series OR valuasi",  "funding",     "FUNDING"),
        ("akuisisi OR acquires OR merger OR membeli",              "m_and_a",     "AKUISISI"),
        ("CEO OR CFO OR CTO OR appoints OR menunjuk OR resigns",  "leadership",  "KEPEMIMPINAN"),
        ("kemitraan OR partnership OR berkolaborasi OR meneken",  "partnership", "KEMITRAAN"),
    ]

    tasks = [
        _query_signal(company_name, kw, st, prefix)
        for (kw, st, prefix) in queries
    ]
    all_results = await asyncio.gather(*tasks, return_exceptions=True)

    flattened: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for res in all_results:
        if isinstance(res, BaseException):
            continue
        for item in res:
            url = item.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                flattened.append(item)

    # Pass 2: deep read per signal type for verified facts
    if flattened:
        enriched_all: list[dict[str, Any]] = []
        # Group by signal_type for targeted deep read
        by_type: dict[str, list[dict[str, Any]]] = {}
        for item in flattened:
            st = item.get("signal_type", "signal")
            by_type.setdefault(st, []).append(item)

        deep_tasks = [
            _deep_read_money_signal(items, company_name, st)
            for st, items in by_type.items()
        ]
        deep_results = await asyncio.gather(*deep_tasks, return_exceptions=True)
        for res in deep_results:
            if not isinstance(res, BaseException):
                enriched_all.extend(res)
        flattened = enriched_all

    flattened = flattened[:max_items]
    logger.info(
        "[lane_e] DONE | money_signals=%d (funding/m&a/leadership/partnership)",
        len(flattened),
    )
    return flattened
