"""
lane_c_service.py — Dedicated News Engine (Lane C).

Lajur khusus yang menjamin komponen News di UI React SELALU terisi.
Dipisahkan dari Lane A agar data berita tidak pernah "dimakan"
oleh proses rangkuman umum AI.

Pipeline (Multi-Strategy Fallback):
  Strategy 1: Serper /news — nama company lengkap
  Strategy 2: Serper /news — nama pendek (tanpa suffix legal)
  Strategy 3: Serper /news — query luas tanpa kutip
  Strategy 4: Serper /search — filter domain media Indonesia
  Strategy 5: Serper /news — berita industri terkait (dari homepage hint)
  → Jina Reader baca isi artikel teratas secara PARALEL
  → Fallback snippet Serper jika Jina gagal/timeout
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from app.services.external_apis import search_serper, fetch_jina_reader

logger = logging.getLogger(__name__)

# ─── Keyword industri umum di Indonesia ───────────────────────────────────────
# Dipakai untuk menebak industri dari konten homepage jika industry_hint ada.
INDUSTRY_KEYWORDS: dict[str, list[str]] = {
    "fintech": ["fintech", "fintek", "pembayaran digital", "payment", "pinjaman online", "p2p lending"],
    "data keuangan": ["data keuangan", "pasar modal", "capital market", "bursa efek", "idx", "saham", "sekuritas", "broker"],
    "e-commerce": ["e-commerce", "marketplace", "toko online", "belanja online"],
    "logistik": ["logistik", "pengiriman", "kurir", "supply chain", "rantai pasok"],
    "edtech": ["edukasi", "pendidikan", "e-learning", "kursus online", "belajar"],
    "healthtech": ["kesehatan", "health", "rumah sakit", "klinik", "telemedicine", "farmasi"],
    "properti": ["properti", "real estate", "perumahan", "apartemen", "developer"],
    "asuransi": ["asuransi", "insurance", "polis", "klaim", "premi"],
    "perbankan": ["bank", "perbankan", "tabungan", "kredit", "deposito"],
    "SaaS": ["saas", "software", "cloud", "platform", "aplikasi bisnis", "enterprise"],
    "media": ["media", "berita", "konten", "publikasi", "jurnalisme"],
    "manufaktur": ["manufaktur", "pabrik", "produksi", "industri", "mesin"],
    "energi": ["energi", "listrik", "pembangkit", "solar", "minyak", "gas", "pertambangan"],
    "agritech": ["pertanian", "agritech", "pangan", "pupuk", "perkebunan"],
    "telekomunikasi": ["telekomunikasi", "operator", "jaringan", "internet", "broadband"],
}


def _shorten_company_name(name: str) -> str:
    """Buat versi pendek nama perusahaan."""
    shortened = re.sub(
        r"(?i)\b(PT\.?|Tbk\.?|Ltd\.?|Inc\.?|Corp\.?|Indonesia|Persero|Tbk)\b",
        "", name,
    ).strip()
    shortened = re.sub(r"[,.\s]+$", "", shortened).strip()
    return shortened or name


def _detect_industry(text: str) -> str | None:
    """
    Tebak industri dari teks homepage. Return label industri atau None.
    """
    text_lower = text.lower()
    for industry, keywords in INDUSTRY_KEYWORDS.items():
        matches = sum(1 for kw in keywords if kw in text_lower)
        if matches >= 2:  # minimal 2 keyword cocok untuk confident
            return industry
    return None


def _build_industry_queries(industry: str, company_name: str) -> list[str]:
    """
    Buat query pencarian berita industri yang relevan.
    Berita ini akan ditandai sebagai "Berita Industri Terkait".
    """
    short = _shorten_company_name(company_name)
    queries = []

    if industry == "data keuangan":
        queries = [
            "pasar modal Indonesia regulasi terbaru",
            "OJK bursa efek teknologi data",
        ]
    elif industry == "fintech":
        queries = [
            "fintech Indonesia regulasi OJK terbaru",
            "pembayaran digital Indonesia tren",
        ]
    elif industry == "e-commerce":
        queries = [
            "e-commerce Indonesia tren pertumbuhan",
            "marketplace Indonesia regulasi",
        ]
    elif industry == "perbankan":
        queries = [
            "perbankan digital Indonesia tren",
            "bank Indonesia regulasi terbaru",
        ]
    elif industry == "SaaS":
        queries = [
            "startup SaaS Indonesia tren enterprise",
            "transformasi digital Indonesia bisnis",
        ]
    else:
        # Generic industry query
        queries = [
            f"{industry} Indonesia tren terbaru",
            f"{industry} Indonesia tantangan regulasi",
        ]

    return queries


def _extract_summary(content: str, fallback_snippet: str, max_sentences: int = 2) -> str:
    """Ambil ringkasan dari konten Jina atau fallback dari snippet Serper."""
    if not content or len(content) < 50:
        return fallback_snippet or ""

    # Strip metadata Jina Reader yang sering muncul di awal konten
    content = re.sub(r'^Title:.*?(?:Markdown Content:\s*)', '', content, flags=re.DOTALL | re.IGNORECASE)
    # Strip juga pola "URL Source: ..." yang standalone
    content = re.sub(r'URL Source:\s*https?://\S+\s*', '', content, flags=re.IGNORECASE)
    content = content.strip()

    if not content or len(content) < 50:
        return fallback_snippet or ""

    sentences = content.split(". ")
    good_sentences = [s.strip() for s in sentences if len(s.strip()) > 30]

    if good_sentences:
        picked = ". ".join(good_sentences[:max_sentences])
        if not picked.endswith("."):
            picked += "."
        return picked[:500]

    return content[:200].strip()


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
    Cek apakah artikel BENAR-BENAR terkait perusahaan target.
    Return False jika title dan snippet tidak menyebut perusahaan sama sekali.
    """
    title = article.get("title", "").lower()
    snippet = article.get("snippet", article.get("description", "")).lower()
    combined = f"{title} {snippet}"

    company_lower = company_name.lower()
    short_name = _shorten_company_name(company_name).lower()
    domain_keyword = domain.split(".")[0].lower() if domain else ""

    # Minimal salah satu harus match
    if company_lower in combined:
        return True
    if short_name and short_name != company_lower and short_name in combined:
        return True
    if domain_keyword and len(domain_keyword) > 3 and domain_keyword in combined:
        return True

    # Cek kata-kata signifikan dari nama perusahaan
    stop_words = {"pt", "tbk", "ltd", "inc", "corp", "indonesia", "persero", "the", "and", "for", "of"}
    significant = [w for w in company_lower.split() if len(w) > 2 and w not in stop_words]
    if len(significant) >= 2:
        match_count = sum(1 for w in significant if w in combined)
        if match_count >= 2:
            return True

    return False


async def _try_serper_news(query: str, label: str) -> list[dict[str, Any]]:
    """Coba satu query ke Serper /news, return list artikel mentah."""
    logger.info("[lane_c] %s | query=%r", label, query[:80])
    data = await search_serper(query, endpoint="news", num=6)
    articles = data.get("news", [])
    logger.info("[lane_c] %s | results=%d", label, len(articles))
    return articles


async def _try_serper_search_as_news(query: str) -> list[dict[str, Any]]:
    """Fallback: Serper /search biasa + filter domain media Indonesia."""
    logger.info("[lane_c] fallback_search | query=%r", query[:80])
    data = await search_serper(query, endpoint="search", num=10)
    organic = data.get("organic", [])

    news_domains = {
        "detik.com", "kompas.com", "cnbcindonesia.com", "bisnis.com",
        "kontan.co.id", "katadata.co.id", "tempo.co", "liputan6.com",
        "idxchannel.com", "investor.id", "swa.co.id", "marketeers.com",
        "infobanknews.com", "beritasatu.com", "mediaindonesia.com",
        "republika.co.id", "antaranews.com",
    }

    news_like: list[dict[str, Any]] = []
    for item in organic:
        link = item.get("link", "")
        if any(nd in link for nd in news_domains):
            news_like.append(item)

    logger.info("[lane_c] fallback_search | news_like=%d", len(news_like))
    return news_like


async def _enrich_with_jina(articles: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    """Baca konten artikel via Jina Reader (paralel, error-tolerant) dan kembalikan (news_items, jina_contents)."""
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
    Jalankan GPT-4o-mini per artikel untuk mengekstrak pain signal terstruktur.
    Return list NewsSignal-compatible dicts.
    """
    from openai import AsyncOpenAI
    from app.core.config import settings
    
    if not news_items:
        return []
    
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    
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
                    {
                        "role": "system",
                        "content": (
                            "Kamu adalah analis B2B. Dari artikel berita ini, ekstrak sinyal bisnis "
                            "yang relevan untuk tim sales yang menargetkan perusahaan tersebut. "
                            "Balas JSON: {event_summary, implied_challenge, pain_category, signal_type} "
                            "pain_category harus salah satu dari: Marketing, Operations, Technology, Growth. "
                            "signal_type harus salah satu dari: direct, regulatory, competitive, technology."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Perusahaan target: {company_name}\n"
                            f"Judul artikel: {title}\n"
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
            }
        except Exception as exc:
            logger.warning("[lane_c] _extract_one FAILED: %s", exc)
            return None
    
    signals = await asyncio.gather(
        *[_extract_one(item, jina_contents[i] if i < len(jina_contents) else "") 
          for i, item in enumerate(news_items[:3])],  # Maksimal 3 artikel untuk NewsSignal
        return_exceptions=True,
    )
    
    return [s for s in signals if s is not None and not isinstance(s, Exception)]

async def _try_contextual_signals(
    company_name: str,
    domain: str,
    named_entities: list[str],
    industry_hint: str,
) -> list[dict[str, Any]]:
    """
    Cari sinyal kontekstual yang mempengaruhi perusahaan target secara tidak langsung.
    BUKAN generic industry news — harus ada koneksi ke situasi spesifik target.
    """
    industry = _detect_industry(industry_hint)
    
    queries = []
    
    # Regulatory signal
    if industry:
        queries.append(
            (f"OJK OR Kominfo regulasi {industry} 2025 2026", "regulatory")
        )
    
    # Competitive signal
    if named_entities:
        competitor_hint = named_entities[0] if named_entities else ""
        if competitor_hint and len(competitor_hint) > 3:
            queries.append(
                (f'"{competitor_hint}" ekspansi OR "market share" OR peluncuran 2025', "competitive")
            )
    
    # Technology signal
    tech_signals = {
        "SaaS": "transformasi digital enterprise Indonesia AI automation 2025",
        "fintech": "open banking API Indonesia regulasi data 2025",
        "e-commerce": "social commerce quick commerce Indonesia trend 2025",
        "perbankan": "digital banking Indonesia core banking modernisasi",
        "logistik": "supply chain disruption Indonesia last mile 2025",
    }
    if industry and industry in tech_signals:
        queries.append((tech_signals[industry], "technology"))
    
    if not queries:
        return []
    
    articles: list[dict[str, Any]] = []
    for query, signal_type in queries[:2]:
        results = await _try_serper_news(query, f"contextual_{signal_type}")
        for r in results[:2]:
            r["_signal_type"] = signal_type
        articles.extend(results[:2])
        if articles:
            break
    
    return articles


async def run_lane_c_news(
    company_name: str,
    *,
    domain: str = "",
    industry_hint: str = "",
    named_entities: list[str] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Dedicated News Engine — menjamin array berita tidak pernah kosong.

    Returns:
        (news_items, pain_signals_from_news)
    """
    logger.info("[lane_c] START | company=%r domain=%r", company_name, domain)

    short_name = _shorten_company_name(company_name)
    raw_articles: list[dict[str, Any]] = []
    is_industry_news = False

    # ── Strategy 1: Serper /news dengan nama lengkap ──────────────────────────
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

    # ── Strategy 3: Serper /news tanpa tanda kutip ────────────────────────────
    if not raw_articles:
        raw_articles = await _try_serper_news(
            f"{short_name} berita terbaru", "strategy3_news_broad"
        )
        raw_articles = [a for a in raw_articles if _is_relevant_article(a, company_name, domain)]

    # ── Strategy 4: Fallback ke /search + filter domain berita ────────────────
    if not raw_articles:
        raw_articles = await _try_serper_search_as_news(
            f"{short_name} berita OR artikel OR laporan"
        )
        raw_articles = [a for a in raw_articles if _is_relevant_article(a, company_name, domain)]

    # ── Strategy 5: CONTEXTUAL SIGNALS ─────────────────────────────────────────
    if not raw_articles and industry_hint:
        logger.info("[lane_c] strategy5_contextual")
        raw_articles = await _try_contextual_signals(
            company_name, domain, named_entities or [], industry_hint
        )
        if raw_articles:
            is_industry_news = True

    # ── Strategy 6: Fallback generik industri ─────────────────────────────────
    if not raw_articles:
        industry = _detect_industry(industry_hint) if industry_hint else None
        if industry:
            fallback_query = f"{industry} Indonesia tren teknologi 2025"
        else:
            fallback_query = "bisnis Indonesia tren inovasi transformasi digital 2025"
        logger.info("[lane_c] strategy6_industry_fallback | query=%r", fallback_query)
        raw_articles = await _try_serper_news(fallback_query, "strategy6_industry_fallback")
        if raw_articles:
            is_industry_news = True

    if not raw_articles:
        logger.warning("[lane_c] SEMUA strategy gagal untuk %r — 0 berita", company_name)
        return [], []

    # ── Deduplikasi & ambil top 4 ─────────────────────────────────────────────
    unique_articles = _deduplicate_articles(raw_articles)[:4]
    logger.info(
        "[lane_c] Akan memproses %d artikel (industry_related=%s)",
        len(unique_articles), is_industry_news,
    )

    # ── Enrich dengan Jina Reader ─────────────────────────────────────────────
    news_items, jina_contents = await _enrich_with_jina(unique_articles)

    # ── Signal Extraction ─────────────────────────────────────────────────────
    pain_signals = await _extract_news_signals(unique_articles, company_name, jina_contents)
    logger.info("[lane_c] pain_signals extracted: %d", len(pain_signals))

    # ── Tandai berita industri jika bukan mention langsung ────────────────────
    if is_industry_news:
        for item in news_items:
            if not item["title"].startswith("[Industri]"):
                item["title"] = f"[Industri] {item['title']}"

    logger.info("[lane_c] DONE | company=%r news_count=%d", company_name, len(news_items))
    return news_items, pain_signals
