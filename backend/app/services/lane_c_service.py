"""
lane_c_service.py — Dedicated Verified News & Hiring Signal Engine (Lane C).

Prinsip Anti-Pollution (Evidence-First):
  1. HANYA mencari berita dan lowongan yang benar-benar menyebut perusahaan target secara eksplisit.
  2. Jika perusahaan target adalah bisnis privat/SME yang tidak memiliki berita publik,
     secara jujur kembalikan array kosong ([]) daripada menginjeksi berita umum industri
     yang memicu halusinasi AI.
  3. Menggunakan Jina Reader untuk membaca isi artikel berita secara mendalam.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def _shorten_company_name(name: str) -> str:
    """Buat versi pendek nama perusahaan (tanpa PT, CV, Tbk, Ltd, Corp)."""
    shortened = re.sub(
        r"(?i)\b(PT\.?|CV\.?|Tbk\.?|Ltd\.?|Inc\.?|Corp\.?|Indonesia|Persero|Tbk)\b",
        "", name,
    ).strip()
    shortened = re.sub(r"[,.\s]+$", "", shortened).strip()
    return shortened or name


def _extract_summary(content: str, fallback_snippet: str, max_sentences: int = 2) -> str:
    """
    Ambil ringkasan bersih dari konten Jina atau fallback dari snippet Serper.
    """
    if fallback_snippet and len(fallback_snippet.strip()) >= 60:
        return fallback_snippet.strip()[:500]

    if not content or len(content) < 50:
        return fallback_snippet or ""

    # Strip Jina metadata header
    content = re.sub(r'^Title:.*?(?:Markdown Content:\s*)', '', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'URL Source:\s*https?://\S+\s*', '', content, flags=re.IGNORECASE)
    content = re.sub(r'!\[.*?\]\(.*?\)', '', content)
    content = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', content)
    content = re.sub(r'https?://\S+', '', content)
    content = re.sub(r'^#{1,6}\s+.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^\s*[-*]\s+\S.{0,60}$', '', content, flags=re.MULTILINE)
    content = re.sub(r'<[^>]+>', '', content)
    content = re.sub(r'\n{2,}', ' ', content).strip()
    content = re.sub(r'\s{2,}', ' ', content)

    if not content or len(content) < 50:
        return fallback_snippet or ""

    sentences = re.split(r'(?<=[.!?])\s+', content)
    good_sentences = [
        s.strip() for s in sentences
        if len(s.strip()) > 40 and not s.strip().startswith("http")
    ]

    if good_sentences:
        picked = " ".join(good_sentences[:max_sentences])
        if not picked.endswith("."):
            picked += "."
        return picked[:500]

    return (fallback_snippet or content[:200]).strip()


def _deduplicate_articles(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Hapus duplikasi berdasarkan URL."""
    seen_links: set[str] = set()
    unique: list[dict[str, Any]] = []
    for article in articles:
        link = article.get("link", "")
        if link and link not in seen_links:
            seen_links.add(link)
            unique.append(article)
    return unique


def _is_relevant_article(article: dict[str, Any], company_name: str, domain: str) -> bool:
    """
    Validasi ketat: pastikan artikel benar-benar menyebut nama perusahaan target atau domainnya.
    """
    title = article.get("title", "").lower()
    snippet = article.get("snippet", article.get("description", "")).lower()
    combined = f"{title} {snippet}"

    company_lower = company_name.lower().strip()
    short_name = _shorten_company_name(company_name).lower().strip()
    domain_keyword = domain.split(".")[0].lower().strip() if domain else ""

    # 1. Exact full company name
    if company_lower and company_lower in combined:
        return True

    # 2. Short name (min 4 chars to avoid generic false positives)
    if short_name and len(short_name) >= 4 and short_name in combined:
        return True

    # 3. Domain keyword (e.g. "kreasidigital" or "ruangguru")
    if domain_keyword and len(domain_keyword) >= 4 and domain_keyword in combined:
        return True

    return False


async def _try_serper_news(query: str, label: str, tbs: str | None = "qdr:y") -> list[dict[str, Any]]:
    """Cari di Serper /news dengan rentang waktu 1 tahun terakhir."""
    from app.services.external_apis import search_serper
    logger.info("[lane_c] %s | query=%r", label, query[:80])
    data = await search_serper(query, endpoint="news", num=6, tbs=tbs)
    articles = data.get("news", [])
    logger.info("[lane_c] %s | results=%d", label, len(articles))
    return articles


async def _try_serper_search_as_news(query: str, tbs: str | None = "qdr:y") -> list[dict[str, Any]]:
    """Pencarian ke portal berita nasional terpercaya Indonesia."""
    from app.services.external_apis import search_serper
    logger.info("[lane_c] search_media | query=%r", query[:80])
    data = await search_serper(query, endpoint="search", num=10, tbs=tbs)
    organic = data.get("organic", [])

    news_domains = {
        "detik.com", "kompas.com", "cnbcindonesia.com", "bisnis.com",
        "kontan.co.id", "katadata.co.id", "tempo.co", "liputan6.com",
        "techinasia.com", "dailysocial.id", "swa.co.id", "kumparan.com",
        "idxchannel.com", "investor.id", "marketeers.com", "antaranews.com",
    }

    news_like: list[dict[str, Any]] = []
    for item in organic:
        link = item.get("link", "").lower()
        if any(nd in link for nd in news_domains):
            news_like.append(item)

    logger.info("[lane_c] search_media | verified_media_results=%d", len(news_like))
    return news_like


async def _try_serper_search_intent(query: str, tbs: str | None = "qdr:m") -> list[dict[str, Any]]:
    """Cari sinyal rekrutmen aktif via portal karir terpercaya (1 bulan terakhir)."""
    from app.services.external_apis import search_serper
    logger.info("[lane_c] intent_search | query=%r", query[:80])
    data = await search_serper(query, endpoint="search", num=10, tbs=tbs)
    organic = data.get("organic", [])

    intent_domains = {
        "linkedin.com/jobs", "glints.com", "jobstreet.co.id",
        "kalibrr.com", "techinasia.com/jobs", "klob.id", "karir.com",
    }

    intent_like: list[dict[str, Any]] = []
    for item in organic:
        link = item.get("link", "").lower()
        if any(d in link for d in intent_domains):
            item["_signal_type"] = "intent"
            intent_like.append(item)

    logger.info("[lane_c] intent_search | active_job_signals=%d", len(intent_like))
    return intent_like


async def _enrich_with_jina(articles: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    """Baca konten artikel via Jina Reader secara paralel."""
    from app.services.external_apis import fetch_jina_reader
    article_urls = [a.get("link", "") for a in articles]
    valid_urls = [u for u in article_urls if u]

    jina_contents: list[str] = []
    if valid_urls:
        jina_contents = list(await asyncio.gather(
            *[fetch_jina_reader(url) for url in valid_urls]
        ))

    news_items: list[dict[str, Any]] = []
    for i, article in enumerate(articles):
        jina_text = jina_contents[i] if i < len(jina_contents) else ""
        snippet = article.get("snippet", article.get("description", ""))
        summary = _extract_summary(jina_text, fallback_snippet=snippet)

        news_items.append({
            "title": article.get("title", ""),
            "date": article.get("date", ""),
            "source": article.get("source", ""),
            "summary": summary,
            "url": article.get("link", ""),
            "signalType": article.get("_signal_type", "direct"),
        })

    return news_items, jina_contents


async def _extract_news_signals(
    news_items: list[dict[str, Any]],
    company_name: str,
    jina_contents: list[str],
) -> list[dict[str, Any]]:
    """
    Ekstrak pain signal terstruktur dari artikel berita terverifikasi via OpenAI mini.
    """
    from openai import AsyncOpenAI
    from app.core.config import settings

    if not news_items or not settings.OPENAI_API_KEY:
        return []

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    system_content = (
        "Kamu adalah fact-extractor B2B analitis. "
        "ATURAN: Ekstrak HANYA fakta yang BENAR-BENAR tertulis di dalam teks artikel. "
        "DILARANG membuat inferensi fiktif atau generalisasi industri. "
        "Balas format JSON:\n"
        "{\n"
        '  "event_summary": "Ringkasan 1 kalimat peristiwa bisnis nyata",\n'
        '  "implied_challenge": "1 kalimat tantangan/kebutuhan bisnis yang muncul",\n'
        '  "pain_category": "Marketing|Operations|Technology|Growth",\n'
        '  "signal_type": "direct|regulatory|competitive|technology|intent",\n'
        '  "verified_amount": "nominal uang/angka jika ada, atau null",\n'
        '  "verified_date": "tanggal peristiwa jika ada, atau null"\n'
        "}"
    )

    async def _extract_one(item: dict, jina_text: str) -> dict | None:
        title = item.get("title", "")
        snippet = item.get("snippet", item.get("description", ""))
        url = item.get("link", "")
        signal_type = item.get("_signal_type", "direct")

        content_for_prompt = jina_text[:1200] if jina_text else snippet

        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=300,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_content},
                    {
                        "role": "user",
                        "content": (
                            f"Perusahaan target: {company_name}\n"
                            f"Judul: {title}\n"
                            f"Konten: {content_for_prompt}"
                        ),
                    },
                ],
            )
            import json
            parsed = json.loads(response.choices[0].message.content or "{}")
            return {
                "event_summary": parsed.get("event_summary", ""),
                "implied_challenge": parsed.get("implied_challenge", ""),
                "pain_category": parsed.get("pain_category", "Operations"),
                "source_url": url,
                "signal_type": parsed.get("signal_type", signal_type),
                "verified_amount": parsed.get("verified_amount"),
                "verified_date": parsed.get("verified_date"),
            }
        except Exception as exc:
            logger.warning("[lane_c] _extract_one signal extraction FAILED: %s", exc)
            return None

    signals = await asyncio.gather(
        *[_extract_one(item, jina_contents[i] if i < len(jina_contents) else "")
          for i, item in enumerate(news_items[:3])],
        return_exceptions=True,
    )

    return [s for s in signals if s is not None and not isinstance(s, Exception)]


async def run_lane_c_news(
    company_name: str,
    *,
    domain: str = "",
    industry_hint: str = "",
    named_entities: list[str] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Dedicated Verified News Engine (Lane C).

    Mengumpulkan berita & sinyal rekrutmen nyata.
    Jika tidak ada berita spesifik tentang perusahaan, return ([], []) tanpa polusi berita umum.
    """
    logger.info("[lane_c] START | company=%r domain=%r", company_name, domain)

    short_name = _shorten_company_name(company_name)
    saved_intents: list[dict[str, Any]] = []

    # ── Strategy 0: Intent Signals (Lowongan Pekerjaan Aktif) ─────────────────
    query_intent = (
        f'site:linkedin.com/jobs OR site:glints.com/id/opportunities '
        f'OR site:jobstreet.co.id "{company_name}"'
    )
    intent_raw = await _try_serper_search_intent(query_intent, tbs="qdr:m")
    intent_raw = [a for a in intent_raw if _is_relevant_article(a, company_name, domain)]
    if intent_raw:
        for item in intent_raw:
            original_snippet = item.get("snippet", "")
            item["snippet"] = f"[LOWONGAN PEKERJAAN] {original_snippet}"
        saved_intents.extend(intent_raw[:2])

    # ── Strategy 1: Serper /news dengan nama perusahaan lengkap ──────────────
    raw_articles = await _try_serper_news(
        f'"{company_name}"', "strategy1_news_full"
    )
    raw_articles = [a for a in raw_articles if _is_relevant_article(a, company_name, domain)]

    # ── Strategy 2: Serper /news dengan nama pendek ───────────────────────────
    if not raw_articles and short_name != company_name:
        raw_articles = await _try_serper_news(
            f'"{short_name}"', "strategy2_news_short"
        )
        raw_articles = [a for a in raw_articles if _is_relevant_article(a, company_name, domain)]

    # ── Strategy 3: Pencarian ke Portal Media Terpercaya ─────────────────────
    if not raw_articles:
        raw_articles = await _try_serper_search_as_news(
            f'"{short_name}" (bisnis OR pendanaan OR peluncuran OR ekspansi OR teknologi)'
        )
        raw_articles = [a for a in raw_articles if _is_relevant_article(a, company_name, domain)]

    # ── Evaluasi Anti-Pollution ───────────────────────────────────────────────
    all_raw = saved_intents + raw_articles
    if not all_raw:
        logger.info(
            "[lane_c] Tidak ada berita/hiring publik untuk %r — return empty (anti-pollution)",
            company_name,
        )
        return [], []

    # ── Deduplikasi & ambil top 4 ─────────────────────────────────────────────
    unique_articles = _deduplicate_articles(all_raw)[:4]
    logger.info("[lane_c] Memproses %d artikel terverifikasi", len(unique_articles))

    # ── Enrich dengan Jina Reader ─────────────────────────────────────────────
    news_items, jina_contents = await _enrich_with_jina(unique_articles)

    # ── Signal Extraction ─────────────────────────────────────────────────────
    pain_signals = await _extract_news_signals(unique_articles, company_name, jina_contents)

    logger.info("[lane_c] DONE | company=%r news_count=%d signals=%d", company_name, len(news_items), len(pain_signals))
    return news_items, pain_signals

