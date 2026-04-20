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

from app.services.external_apis import search_serper, fetch_jina_reader, fetch_and_extract_urls

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
    """
    Ambil ringkasan bersih dari konten Jina atau fallback dari snippet Serper.
    Prioritaskan snippet Serper jika sudah cukup bersih — snippet Serper adalah
    1-2 kalimat yang sudah dipilih Google, jauh lebih bersih dari raw Jina markdown.
    """
    # Serper snippet sudah bersih dan compact — gunakan langsung jika cukup panjang
    if fallback_snippet and len(fallback_snippet.strip()) >= 60:
        return fallback_snippet.strip()[:500]

    if not content or len(content) < 50:
        return fallback_snippet or ""

    # Strip Jina metadata header
    content = re.sub(r'^Title:.*?(?:Markdown Content:\s*)', '', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'URL Source:\s*https?://\S+\s*', '', content, flags=re.IGNORECASE)

    # Strip markdown images: ![alt](url)
    content = re.sub(r'!\[.*?\]\(.*?\)', '', content)
    # Strip markdown links: [text](url) → keep text only
    content = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', content)
    # Strip raw URLs
    content = re.sub(r'https?://\S+', '', content)
    # Strip markdown headings
    content = re.sub(r'^#{1,6}\s+.*$', '', content, flags=re.MULTILINE)
    # Strip bullet/nav lines (short lines starting with * or -)
    content = re.sub(r'^\s*[-*]\s+\S.{0,60}$', '', content, flags=re.MULTILINE)
    # Strip horizontal rules
    content = re.sub(r'^[-=_*]{3,}\s*$', '', content, flags=re.MULTILINE)
    # Strip HTML tags
    content = re.sub(r'<[^>]+>', '', content)
    # Collapse whitespace
    content = re.sub(r'\n{2,}', ' ', content).strip()
    content = re.sub(r'\s{2,}', ' ', content)

    if not content or len(content) < 50:
        return fallback_snippet or ""

    # Split on sentence boundaries and pick first 2 good ones
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


async def _try_serper_news(query: str, label: str, tbs: str | None = "qdr:y") -> list[dict[str, Any]]:
    """Coba satu query ke Serper /news dengan limit 1 tahun terakhir (qdr:y) secara default."""
    logger.info("[lane_c] %s | query=%r tbs=%s", label, query[:80], tbs)
    data = await search_serper(query, endpoint="news", num=6, tbs=tbs)
    articles = data.get("news", [])
    logger.info("[lane_c] %s | results=%d", label, len(articles))
    return articles


async def _try_serper_search_as_news(query: str, tbs: str | None = "qdr:y") -> list[dict[str, Any]]:
    """Fallback: Serper /search biasa + filter domain media Indonesia (limit 1 tahun terakhir)."""
    logger.info("[lane_c] fallback_search | query=%r tbs=%s", query[:80], tbs)
    data = await search_serper(query, endpoint="search", num=10, tbs=tbs)
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


async def _try_serper_search_intent(query: str, tbs: str | None = "qdr:m") -> list[dict[str, Any]]:
    """Cari sinyal rekrutmen via Google Search organik (default 1 bulan terakhir)."""
    logger.info("[lane_c] intent_search | query=%r tbs=%s", query[:80], tbs)
    data = await search_serper(query, endpoint="search", num=10, tbs=tbs)
    organic = data.get("organic", [])

    intent_domains = {
        "linkedin.com/jobs", "glints.com", "jobstreet.co.id",
        "kalibrr.com", "techinasia.com/jobs",
    }

    intent_like: list[dict[str, Any]] = []
    for item in organic:
        link = item.get("link", "").lower()
        if any(d in link for d in intent_domains):
            item["_signal_type"] = "intent"
            intent_like.append(item)

    logger.info("[lane_c] intent_search | intent_like=%d", len(intent_like))
    return intent_like


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
    Pass 2: fetch full content untuk artikel yang masih snippet pendek.
    Return list NewsSignal-compatible dicts.
    """
    from openai import AsyncOpenAI
    from app.core.config import settings

    if not news_items:
        return []

    # ── Pass 2: deep read untuk konten yang masih pendek (snippet) ───────────
    short_content_urls = [
        item.get("link", "") for i, item in enumerate(news_items)
        if i < len(jina_contents) and len(jina_contents[i]) < 500 and item.get("link")
    ]
    if short_content_urls:
        deep_pages = await fetch_and_extract_urls(short_content_urls, max_urls=3)
        deep_lookup = {p["url"]: p["content"] for p in deep_pages}
        for i, item in enumerate(news_items):
            url = item.get("link", "")
            if url in deep_lookup and i < len(jina_contents):
                jina_contents[i] = deep_lookup[url]

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    system_content = (
        "Kamu adalah fact-extractor B2B. "
        "ATURAN KERAS: ekstrak HANYA fakta yang BENAR-BENAR ada di dalam artikel. "
        "DILARANG: inference, tambah konteks, atau generalisasi industri. "
        "Jika artikel tidak menyebut angka spesifik → jangan tulis angka. "
        "Jika tanggal tidak disebutkan eksplisit → isi verified_date dengan null. "
        "Balas JSON: {\n"
        "  \"event_summary\": \"1 kalimat, hanya fakta dari artikel\",\n"
        "  \"implied_challenge\": \"1 kalimat implikasi bisnis bagi perusahaan\",\n"
        "  \"pain_category\": \"Marketing|Operations|Technology|Growth\",\n"
        "  \"signal_type\": \"direct|regulatory|competitive|technology|intent\",\n"
        "  \"verified_amount\": \"angka exact dari artikel atau null\",\n"
        "  \"verified_date\": \"tanggal exact dari artikel atau null\"\n"
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
                "verified_amount": parsed.get("verified_amount"),
                "verified_date": parsed.get("verified_date"),
            }
        except Exception as exc:
            logger.warning("[lane_c] _extract_one FAILED: %s", exc)
            return None

    signals = await asyncio.gather(
        *[_extract_one(item, jina_contents[i] if i < len(jina_contents) else "")
          for i, item in enumerate(news_items[:3])],
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

    # ── Strategy 0: Intent Signals (Kebutuhan SDM / Ekspansi) ─────────────────
    query_intent = (
        f'site:linkedin.com/jobs OR site:glints.com/id/opportunities '
        f'OR site:jobstreet.co.id "{company_name}"'
    )
    logger.info("[lane_c] strategy0_intent | query=%r", query_intent)
    intent_raw = await _try_serper_search_intent(query_intent, tbs="qdr:m")
    intent_raw = [a for a in intent_raw if _is_relevant_article(a, company_name, domain)]
    saved_intents: list[dict[str, Any]] = []
    if intent_raw:
        for item in intent_raw:
            original_snippet = item.get("snippet", "")
            item["snippet"] = f"[LOWONGAN PEKERJAAN] {original_snippet}"
        saved_intents.extend(intent_raw[:2])

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

    # ── Strategy 5: CONTEXTUAL SIGNALS (regulatory/competitive yang relevan) ──
    # Hanya tambahkan jika kita punya named_entities atau industry_hint yang jelas.
    # JANGAN gunakan generic industry news — lebih baik news kosong daripada off-topic.
    if not raw_articles and industry_hint and (named_entities or _detect_industry(industry_hint)):
        logger.info("[lane_c] strategy5_contextual")
        raw_articles = await _try_contextual_signals(
            company_name, domain, named_entities or [], industry_hint
        )
        if raw_articles:
            is_industry_news = True
            # Batasi maksimal 2 item supaya tidak mendominasi
            raw_articles = raw_articles[:2]

    # NOTE: Strategy 6 (generic industry fallback) DIHAPUS pada audit 2026-04-18.
    # Berita generik seperti "ZTE Day", "Techpreneur 2025" tidak memberikan
    # value ke sales rep dan justru membuat report terasa off-topic.
    # Lebih baik news kosong → UI menampilkan empty state yang informatif.

    if not raw_articles and not saved_intents:
        logger.warning(
            "[lane_c] Tidak ada berita relevan untuk %r — return empty (anti-pollution)",
            company_name,
        )
        return [], []

    raw_articles = saved_intents + raw_articles
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
