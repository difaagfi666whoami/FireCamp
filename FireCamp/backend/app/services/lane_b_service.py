"""
lane_b_service.py — Contact Discovery via Serper.dev LinkedIn Dorking.

Menggantikan apify_service.py dan apollo_service.py yang terkena paywall.

Strategi:
  1. Kirim query dorking ke Serper: site:linkedin.com/in "company" (CEO OR Director ...)
  2. Ambil snippet organik Google (title + snippet) — TANPA mengunjungi LinkedIn langsung.
  3. VALIDASI: cek apakah snippet benar-benar menyebut perusahaan target.
  4. Parse snippet menjadi raw contacts (nama, jabatan, linkedinUrl, about).
  5. Kirim ke openai_service.score_contacts() untuk scoring + reasoning.

PENTING: JANGAN panggil fetch_jina_reader() untuk URL LinkedIn.
LinkedIn akan mengembalikan login wall / bot-block.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.services.external_apis import search_serper
from app.services import openai_service

logger = logging.getLogger(__name__)


def _parse_linkedin_title(title: str) -> tuple[str, str]:
    """
    Parse title LinkedIn dari Google snippet.
    Format umum: "Nama Orang - Jabatan - Perusahaan | LinkedIn"

    Returns:
        (name, title/jabatan)
    """
    # Buang suffix " | LinkedIn" atau " - LinkedIn"
    cleaned = re.sub(r"\s*[\|–-]\s*LinkedIn\s*$", "", title, flags=re.IGNORECASE).strip()

    parts = re.split(r"\s*[-–]\s*", cleaned, maxsplit=2)
    name = parts[0].strip() if parts else cleaned
    job_title = parts[1].strip() if len(parts) > 1 else ""

    return name, job_title


def _validate_contact_relevance(
    item: dict[str, Any],
    company_name: str,
    domain: str,
) -> bool:
    """
    Validasi apakah kontak ini BENAR-BENAR terkait dengan perusahaan target.
    
    Cek apakah snippet atau title Google menyebut:
    - Nama perusahaan (atau bagian dari nama)
    - Domain perusahaan
    - Variasi nama pendek perusahaan
    
    Returns:
        True jika kontak relevan dengan perusahaan target, False jika tidak.
    """
    title_text = item.get("title", "").lower()
    snippet = item.get("snippet", "").lower()
    combined = f"{title_text} {snippet}"

    # Buat variasi nama perusahaan untuk pencocokan
    company_lower = company_name.lower()
    name_words = [w for w in company_lower.split() if len(w) > 2]
    # Buang kata-kata umum yang tidak membedakan
    stop_words = {
        "pt", "tbk", "ltd", "inc", "corp", "indonesia", "persero",
        "the", "and", "for", "of", "at",
    }
    significant_words = [w for w in name_words if w not in stop_words]

    # Domain tanpa TLD sebagai keyword (paling unik)
    domain_keyword = domain.split(".")[0].lower() if domain else ""

    # ── PRIORITAS 1 (paling kuat): domain keyword muncul di title atau snippet
    if domain_keyword and len(domain_keyword) > 3 and domain_keyword in combined:
        return True

    # ── PRIORITAS 2: Nama perusahaan lengkap muncul di title (LinkedIn fmt)
    # Title LinkedIn umum: "Nama - Jabatan - Perusahaan | LinkedIn"
    # Cek HANYA di title, bukan snippet — snippet bisa menyebut perusahaan
    # untuk alasan lain (mantan kolega, kompetitor disebut, dst).
    if company_lower in title_text:
        return True

    # ── PRIORITAS 3: Title LinkedIn position (segment terakhir) menyebut company
    title_parts = re.split(r"\s*[-–|]\s*", title_text)
    if len(title_parts) >= 3:
        company_part = title_parts[-1].replace("linkedin", "").strip()
        # Match jika significant word muncul di segment perusahaan title
        if significant_words and any(w in company_part for w in significant_words):
            return True

    # ── PRIORITAS 4 (lemah, butuh ≥2 match): significant words di snippet
    # Hanya berlaku jika nama perusahaan punya ≥2 kata unik
    if len(significant_words) >= 2:
        match_count = sum(1 for w in significant_words if w in combined)
        if match_count >= 2:
            return True

    logger.debug(
        "[lane_b] REJECTED contact | title=%r NOT related to %r",
        item.get("title", "")[:60], company_name,
    )
    return False


def _build_raw_contact(
    item: dict[str, Any],
    index: int,
) -> dict[str, Any] | None:
    """
    Konversi satu item organic Serper menjadi raw contact dict.
    Return None jika URL bukan profil LinkedIn individual.
    """
    link = item.get("link", "")
    if "linkedin.com/in/" not in link:
        return None

    title_text = item.get("title", "")
    snippet = item.get("snippet", "")

    name, job_title = _parse_linkedin_title(title_text)

    # Filter nama tidak valid
    if not name or name.lower() in ("linkedin", "unknown", "linkedin member"):
        return None

    # Filter nama yang terlalu pendek (kemungkinan parsing error)
    if len(name) < 3:
        return None

    return {
        "id": f"serper-contact-{index}",
        "name": name,
        "title": job_title,
        "email": "",
        "phone": "",
        "linkedinUrl": link,
        "about": snippet,
        "source": "linkedin_public",
    }


def _has_past_employment_signals(item: dict[str, Any]) -> bool:
    """
    Deteksi apakah kontak ini adalah MANTAN karyawan berdasarkan snippet Google.
    Return True jika ada sinyal past employment → kontak harus di-REJECT.
    """
    combined = (item.get("title", "") + " " + item.get("snippet", "")).lower()
    
    # Pattern tahun range yang sudah berakhir: "2018–2022", "2019 - 2021"
    # Cek apakah ada range tahun yang end year-nya bukan "present"
    year_range = re.findall(r'(20\d{2})\s*[-–]\s*(20\d{2})', combined)
    for start, end in year_range:
        if int(end) < 2024:  # Range yang sudah berakhir sebelum 2024
            return True
    
    # Kata kunci past tense
    past_keywords = [
        "formerly", "ex-", " alumni", "previously at", "used to work",
        "mantan", "sebelumnya di", "dulu di", "pernah di"
    ]
    return any(kw in combined for kw in past_keywords)


async def _try_extract_team_page(url: str) -> list[str]:
    """
    Coba ekstrak nama eksekutif dari halaman /about atau /team perusahaan.
    Return list nama (lowercase) sebagai ground truth untuk validasi.
    """
    from app.services import tavily_service
    
    candidate_paths = ["/about", "/team", "/management", "/direksi", "/about-us", "/leadership"]
    base_url = f"https://{url}" if not url.startswith("http") else url
    base_url = base_url.rstrip("/")
    
    try_urls = [f"{base_url}{path}" for path in candidate_paths[:3]]
    
    try:
        resp = await tavily_service.extract(try_urls)
        results = resp.get("results", [])
        
        all_names: list[str] = []
        for result in results:
            content = result.get("raw_content", "")[:2000]
            lines = content.splitlines()
            for line in lines:
                line = line.strip()
                if any(title in line for title in ["CEO", "CTO", "COO", "CMO", "Director", "VP", "Head", "Manager", "Founder"]):
                    words = line.split()
                    if 2 <= len(words) <= 5:
                        all_names.append(line.lower())
        
        return all_names
    except Exception:
        return []


async def search_contacts_serper(
    domain: str,
    company_name: str,
    company_context: str,
) -> list[dict[str, Any]]:
    """
    Pipeline Contact Discovery dengan validasi ketat:

    Step 1: Serper Dorking → ambil snippet organik LinkedIn dari Google.
    Step 2: VALIDASI → buang kontak yang tidak terkait perusahaan target.
    Step 3: OpenAI score_contacts → beri prospect score + reasoning.

    Args:
        domain:          Domain perusahaan, e.g. "kreasidigital.co.id"
        company_name:    Nama perusahaan untuk query dorking.
        company_context: Konteks singkat untuk AI scoring.

    Returns:
        list[dict] — kontak tervalidasi dengan prospectScore dan reasoning.
    """
    logger.info("[lane_b] START | domain=%r company=%r", domain, company_name)

    # ── Step 1: Serper Dorking (Tiered) ───────────────────────────────────────
    tier1_query = (
        f'site:linkedin.com/in "{company_name}" '
        '("CEO" OR "CTO" OR "COO" OR "CMO" OR "Founder" OR "President" OR "Chief")'
    )
    tier2_query = (
        f'site:linkedin.com/in "{company_name}" '
        '("VP" OR "Vice President" OR "Director" OR "Head of" OR "GM" OR "General Manager")'
    )
    tier3_query = (
        f'site:linkedin.com/in "{company_name}" '
        '("Manager" OR "Lead" OR "Senior Manager" OR "Senior Lead")'
    )

    raw_contacts: list[dict[str, Any]] = []
    rejected_count = 0
    seen_urls = set()
    
    async def process_tier(query: str, needed: int):
        nonlocal rejected_count
        serper_data = await search_serper(query, endpoint="search", num=10)
        organic = serper_data.get("organic", [])
        for item in organic:
            if len(raw_contacts) >= needed:
                break
            
            link = item.get("link", "")
            if not link or link in seen_urls:
                continue
                
            seen_urls.add(link)
            
            # Validasi 1: Past employment signals
            if _has_past_employment_signals(item):
                logger.debug("[lane_b] REJECTED PAST_EMPLOYEE | title=%r", item.get("title", "")[:60])
                rejected_count += 1
                continue
                
            # Validasi 2: Relevance
            if not _validate_contact_relevance(item, company_name, domain):
                rejected_count += 1
                continue

            contact = _build_raw_contact(item, len(raw_contacts))
            if contact is not None:
                raw_contacts.append(contact)

    # Jalankan tier secara berurutan
    await process_tier(tier1_query, needed=5)
    
    if len(raw_contacts) < 2:
        logger.info("[lane_b] Tier 1 kurang dari 2, lanjut Tier 2")
        await process_tier(tier2_query, needed=5)
        
    if len(raw_contacts) < 2:
        logger.info("[lane_b] Tier 1+2 kurang dari 2, lanjut Tier 3")
        await process_tier(tier3_query, needed=5)

    # ── Fallback: broad query tanpa validasi jika semua tier kosong ──────────
    if not raw_contacts:
        logger.warning("[lane_b] Semua tier kosong — coba fallback query luas tanpa validasi")
        fallback_query = f'site:linkedin.com/in "{company_name}"'
        fallback_data = await search_serper(fallback_query, endpoint="search", num=8)
        fallback_organic = fallback_data.get("organic", [])
        for item in fallback_organic:
            if len(raw_contacts) >= 2:
                break
            link = item.get("link", "")
            if not link or link in seen_urls:
                continue
            seen_urls.add(link)
            contact = _build_raw_contact(item, len(raw_contacts))
            if contact is not None:
                contact["prospectScore"] = 50
                contact["reasoning"] = (
                    "Ditemukan dari pencarian luas (low confidence). Harap verifikasi manual."
                )
                raw_contacts.append(contact)
        if raw_contacts:
            logger.info("[lane_b] Fallback menghasilkan %d kontak (unverified)", len(raw_contacts))
            return raw_contacts
        else:
            logger.warning("[lane_b] Fallback juga kosong untuk company=%r", company_name)
            return []

    logger.info(
        "[lane_b] Parsed %d valid contacts (rejected %d irrelevant) dari Serper",
        len(raw_contacts), rejected_count,
    )

    # ── Step 3: AI Scoring + Hunter REST Email Enrichment (hybrid) ─────────────
    try:
        scored = await openai_service.score_and_enrich_contacts(
            raw_contacts, company_context, domain, company_name=company_name
        )
        # Post-filter: buang kontak dengan score terlalu rendah
        scored = [c for c in scored if c.get("prospectScore", 0) >= 55]
        # Fallback: jika semua diskor < 55, kembalikan raw_contacts tanpa filter
        if not scored and raw_contacts:
            logger.warning("[lane_b] Semua skor < 55 — fallback ke raw_contacts dengan score 50")
            for c in raw_contacts:
                c.setdefault("prospectScore", 50)
                c.setdefault("reasoning", f"Ditemukan dari LinkedIn publik — {company_name}")
            return raw_contacts[:3]
        logger.info("[lane_b] score_and_enrich OK | final=%d", len(scored))
        return scored
    except Exception as exc:
        logger.warning(
            "[lane_b] score_contacts FAILED (kembalikan kontak tanpa score): %s", exc
        )
        for c in raw_contacts:
            c.setdefault("prospectScore", 50)
            c.setdefault("reasoning", f"Ditemukan dari LinkedIn publik — {company_name}")
        return raw_contacts
