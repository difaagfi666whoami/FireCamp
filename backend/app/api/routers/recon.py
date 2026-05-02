"""
recon.py — Router POST /api/recon + Seven-Lane Orchestrator.

Pipeline flow (7-Lane Architecture — Zero Apollo/Apify):

  Input: url + mode
       │
       ▼
  Step 0: Tavily /extract → ground truth (nama, domain)
       │
  ┌────┬────┬────┬────┬────┬────┐  ← asyncio.gather() — PARALEL
  │    │    │    │    │    │    │
LANE  LANE  LANE LANE LANE LANE LANE
  A     B    C    D    E    F    G
Profil Cont. News Hire Money Site Hunter
       │    └─┬──┘    └─┬──┘   │   GroundTruth
       │      ▼         ▼      │
       │   merged news[]       │
       └──────┬─────────────┬──┘
              ▼             ▼
        OpenAI synthesize_profile()
        Lane A + contacts + news (C+D+E)
        + deep_site_pages (F) + company_enrichment (G)
        → CompanyProfile JSON
"""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse
from typing import Any, Optional

import httpx

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.models.schemas import CompanyProfile, ReconMode, ReconRequest, ReconResponse
from app.services import (
    openai_service,
    tavily_service,
    lane_a_service,
    lane_b_service,
    lane_c_service,
    lane_d_service,
    lane_e_service,
    lane_f_service,
    lane_g_service,
)
from app.core.config import settings
from app.core.auth import get_current_user
from app.core.billing import OpCost
from app.services import credits_service
from app.services.openai_service import extract_from_tavily_report
from app.services.tavily_research_service import run_tavily_research

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["recon"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _extract_domain(url: str) -> str:
    """
    Ambil domain bersih dari URL, tanpa 'www.' dan tanpa path.
    Contoh: "https://www.kreasidigital.co.id/about" → "kreasidigital.co.id"
    """
    parsed = urlparse(url if "://" in url else f"https://{url}")
    netloc = parsed.netloc or parsed.path.split("/")[0]
    return re.sub(r"^www\.", "", netloc)


def _extract_company_name(extract_results: list[dict[str, Any]], domain: str) -> str:
    """
    Heuristik sederhana: ambil <title> dari hasil extract homepage.
    Fallback ke domain jika tidak ditemukan.
    """
    for result in extract_results:
        content = result.get("raw_content", "") or ""
        # Cari tag <title>...</title>
        match = re.search(r"<title[^>]*>(.*?)</title>", content, re.IGNORECASE | re.DOTALL)
        if match:
            title = match.group(1).strip()
            # Buang suffix umum seperti " | Home" atau " - Official Site"
            title = re.split(r"\s*[\|\-–]\s*", title)[0].strip()
            if title:
                return title
        # Fallback: baris pertama non-kosong dari raw_content
        for line in content.splitlines():
            line = line.strip()
            # Buang markdown heading prefix
            line = line.lstrip("#").strip()
            # Buang suffix setelah | atau —
            line = re.split(r"\s*[\|–—]\s*", line)[0].strip()
            if len(line) > 3 and not line.startswith("<"):
                return line[:80]

    # Ultimate fallback: domain tanpa TLD
    return domain.split(".")[0].replace("-", " ").title()



# ─── Lane A: Company Profiling (delegasi ke lane_a_service) ──────────────────

async def _run_lane_a(
    url: str,
    company_name: str,
    domain: str,
    mode: ReconMode,
) -> tuple[str, list[dict]]:
    """
    Wrapper Lane A — mendelegasikan ke lane_a_service.run_lane_a_advanced.

    Advanced 7-Step pipeline:
      Step 0: Tavily Extract homepage
      Step 1: Gap Analysis (OpenAI mini, Structured Output)
      Step 2: Generate 3 query sets (OpenAI mini, Structured Output)
      Step 3: [PARALEL] Tavily Search R1 (General) + R2 (News)
      Step 4: [PARALEL] OpenAI mini distill R1 + R2 → wawasan entitas
      Step 5: Tavily Deep Targeted Search R3 (domain lokal Indonesia)
      Step 6: Gabungkan seluruh summary → return string kaya data
    """
    return await lane_a_service.run_lane_a_advanced(
        url=url,
        company_name=company_name,
        domain=domain,
        mode=mode,
    )


# ─── Lane B: Contact Discovery (Serper Dorking) ──────────────────────────────

async def _run_lane_b(
    domain: str,
    company_name: str,
    company_context: str,
) -> list[dict[str, Any]]:
    """
    Lane B Contact Discovery (Zero Apollo/Apify):
      1. Serper LinkedIn Dorking — cari profil via Google snippet
      2. OpenAI score_contacts() — beri prospect score
    """
    logger.info("[lane_b] START | domain=%r (Serper Dorking Mode)", domain)
    try:
        scored = await lane_b_service.search_contacts_serper(
            domain=domain,
            company_name=company_name,
            company_context=company_context,
        )
        logger.info("[lane_b] OK | contacts=%d", len(scored))
        return scored
    except Exception as exc:
        logger.warning("[lane_b] FAILED: %s", exc)
        return []


# ─── Lane C: Dedicated News Engine ────────────────────────────────────────────

async def _run_lane_c(
    company_name: str,
    domain: str,
    industry_hint: str = "",
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Lane C News Engine — menjamin UI News selalu terisi.
    Jika berita langsung tentang perusahaan kosong, cari berita industri terkait.
    """
    logger.info("[lane_c] START | company=%r domain=%r", company_name, domain)
    try:
        news_items, pain_signals = await lane_c_service.run_lane_c_news(
            company_name, domain=domain, industry_hint=industry_hint
        )
        logger.info("[lane_c] OK | news=%d signals=%d", len(news_items), len(pain_signals))
        return news_items, pain_signals
    except Exception as exc:
        logger.warning("[lane_c] FAILED: %s", exc)
        return [], []


# ─── Lane D: Hiring Signals (Job Board Dorking) ──────────────────────────────

async def _run_lane_d(company_name: str, domain: str) -> list[dict[str, Any]]:
    """Lane D Hiring Signals — sinyal investasi tim dari lowongan kerja."""
    logger.info("[lane_d] START | company=%r", company_name)
    try:
        items = await lane_d_service.fetch_hiring_signals(company_name, domain)
        logger.info("[lane_d] OK | hiring=%d", len(items))
        return items
    except Exception as exc:
        logger.warning("[lane_d] FAILED: %s", exc)
        return []


# ─── Lane E: Money & Leadership Signals (Serper News) ───────────────────────

async def _run_lane_e(company_name: str) -> list[dict[str, Any]]:
    """Lane E Money/Leadership/M&A/Partnership signals — 'why now' triggers."""
    logger.info("[lane_e] START | company=%r", company_name)
    try:
        items = await lane_e_service.fetch_money_signals(company_name)
        logger.info("[lane_e] OK | money_signals=%d", len(items))
        return items
    except Exception as exc:
        logger.warning("[lane_e] FAILED: %s", exc)
        return []


# ─── Lane F: Deep Site Crawl (Multi-URL Tavily Extract) ─────────────────────

async def _run_lane_f(canonical_url: str) -> dict[str, Any]:
    """Lane F Deep Site Crawl — about/products/clients/careers/team pages."""
    logger.info("[lane_f] START | url=%r", canonical_url)
    try:
        pages = await lane_f_service.deep_site_crawl(canonical_url)
        logger.info(
            "[lane_f] OK | about=%s products=%s clients=%s careers=%s team=%s",
            bool(pages.get("about")), bool(pages.get("products")),
            bool(pages.get("clients")), bool(pages.get("careers")),
            bool(pages.get("team")),
        )
        return pages
    except Exception as exc:
        logger.warning("[lane_f] FAILED: %s", exc)
        return {"about": "", "products": "", "clients": "", "careers": "", "team": "", "raw_pages": []}


# ─── Lane G: Hunter Company Ground Truth ────────────────────────────────────

async def _run_lane_g(domain: str) -> dict[str, Any]:
    """Lane G Hunter companies/find — ground truth metadata 1 API call."""
    logger.info("[lane_g] START | domain=%r", domain)
    try:
        enrichment = await lane_g_service.fetch_company_enrichment(domain)
        logger.info("[lane_g] OK | name=%r employees=%d", enrichment.get("name", "")[:40], enrichment.get("employees", 0))
        return enrichment
    except Exception as exc:
        logger.warning("[lane_g] FAILED: %s", exc)
        return {}


# ─── Main Orchestrator ────────────────────────────────────────────────────────

async def run_recon_pipeline(url: str, mode: ReconMode) -> tuple[CompanyProfile, int]:
    """
    Orkestrator utama Two-Lane Recon Pipeline.

    Step 0  → Tavily /extract homepage (ground truth: nama, domain)
    Step 1  → asyncio.gather(Lane A, Lane B) — berjalan PARALEL
    Step 2  → Sonnet synthesize_profile() — final JSON

    Args:
        url:  URL website target (bisa dengan atau tanpa schema).
        mode: ReconMode.free atau ReconMode.pro

    Returns:
        CompanyProfile ter-validasi Pydantic.

    Raises:
        RuntimeError dengan pesan Bahasa Indonesia jika pipeline gagal kritis.
    """
    domain       = _extract_domain(url)
    canonical_url = url if "://" in url else f"https://{url}"

    logger.info(
        "[pipeline] START | url=%r domain=%r mode=%s",
        canonical_url, domain, mode.value,
    )

    # ── Step 0: Extract homepage ─────────────────────────────────────────────
    company_name: str = domain.split(".")[0].replace("-", " ").title()  # safe default
    homepage_raw = ""  # konten homepage untuk industry hint
    try:
        extract_resp  = await tavily_service.extract([canonical_url])
        extract_items = extract_resp.get("results", [])
        if extract_items:
            company_name = _extract_company_name(extract_items, domain)
            homepage_raw = extract_items[0].get("raw_content", "")[:500]
            logger.info("[pipeline] Step0 extract OK | name=%r", company_name)
    except Exception as exc:
        # Non-fatal: lanjut dengan domain sebagai fallback name
        logger.warning("[pipeline] Step0 extract FAILED (dilanjutkan): %s", exc)

    # Industry hint untuk Lane C (berita industri terkait)
    industry_hint = homepage_raw

    company_context = f"{company_name} ({domain})"

    # ── Step 1: Lane A–G paralel ──────────────────────────────────────────────
    try:
        (
            lane_a_result,
            scored_contacts,
            lane_c_result,
            hiring_news,
            money_news,
            deep_site_pages,
            company_enrichment,
        ) = await asyncio.gather(
            _run_lane_a(canonical_url, company_name, domain, mode),
            _run_lane_b(domain, company_name, company_context),
            _run_lane_c(company_name, domain, industry_hint),
            _run_lane_d(company_name, domain),
            _run_lane_e(company_name),
            _run_lane_f(canonical_url),
            _run_lane_g(domain),
        )
        lane_a_summary, lane_a_evidence = lane_a_result
        news_c, pain_signals_from_news = lane_c_result
    except Exception as exc:
        logger.error("[pipeline] gather Lane A–G FAILED | error=%s", exc)
        raise RuntimeError(
            f"Pipeline riset gagal pada tahap pencarian data: {exc}"
        ) from exc

    # ── Merge news C + D + E (deduplicate by URL) ────────────────────────────
    # Lane C -> regular news
    # Lane D + E -> intent signals
    news_c_unique: list[dict[str, Any]] = []
    intent_signals: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for item in news_c:
        url_key = (item.get("url") or "").strip()
        if url_key and url_key in seen_urls:
            continue
        if url_key:
            seen_urls.add(url_key)
        news_c_unique.append(item)

    for source in (hiring_news, money_news):
        for item in source:
            url_key = (item.get("url") or "").strip()
            if url_key and url_key in seen_urls:
                continue
            if url_key:
                seen_urls.add(url_key)
            intent_signals.append(item)

    logger.info(
        "[pipeline] gather OK | lane_a=%d contacts=%d news_c=%d news_d=%d news_e=%d "
        "intent_signals=%d site_pages=%d enrichment=%s",
        len(lane_a_summary), len(scored_contacts),
        len(news_c), len(hiring_news), len(money_news),
        len(intent_signals),
        sum(1 for k in ("about", "products", "clients", "careers", "team") if deep_site_pages.get(k)),
        bool(company_enrichment.get("name")),
    )

    # ── Step 2: Final Synthesis ───────────────────────────────────────────────
    try:
        profile, tokens_used = await openai_service.synthesize_profile(
            lane_a_summary=lane_a_summary,
            scored_contacts=scored_contacts,
            company_url=canonical_url,
            mode=mode,
            extracted_news=news_c_unique,
            evidence_list=lane_a_evidence,
            pain_signals_from_news=pain_signals_from_news,
            deep_site_pages=deep_site_pages,
            company_enrichment=company_enrichment,
            intent_signals=intent_signals,
        )
    except Exception as exc:
        logger.error("[pipeline] synthesize_profile FAILED | error=%s", exc)
        raise RuntimeError(
            f"Gagal mensintesis profil perusahaan: {exc}"
        ) from exc

    logger.info(
        "[pipeline] DONE | company=%r mode=%s contacts=%d painPoints=%d news=%d tokens=%d",
        profile.name,
        mode.value,
        len(profile.contacts),
        len(profile.painPoints),
        len(profile.news),
        tokens_used,
    )
    return profile, tokens_used


# ─── Router endpoint ──────────────────────────────────────────────────────────

@router.post(
    "/recon",
    response_model=ReconResponse,
    summary="Generate Company Profile",
    description=(
        "Jalankan Two-Lane Recon Pipeline: Tavily (profiling) + Apollo/Apify (contacts) "
        "+ Claude Sonnet (synthesis). Mode 'free' ~8-12 detik, mode 'pro' ~25-45 detik."
    ),
)
async def generate_recon(payload: ReconRequest, user_id: str = Depends(get_current_user)) -> ReconResponse:
    """
    POST /api/recon

    Request body:  { "url": "...", "mode": "free" | "pro" }
    Response body: CompanyProfile JSON (sesuai api-contract.md)
    Error:         { "detail": "Pesan error Bahasa Indonesia" }
    """
    if not payload.url or not payload.url.strip():
        raise HTTPException(status_code=400, detail="URL perusahaan tidak boleh kosong.")

    url = payload.url.strip()

    # Validasi format URL minimal
    domain = _extract_domain(url)
    if not domain or "." not in domain:
        raise HTTPException(
            status_code=400,
            detail=f"Format URL tidak valid: '{url}'. Contoh yang benar: https://example.com",
        )

    # Debit credits BEFORE running expensive AI pipeline. Free=1, Pro=5.
    cost = OpCost.RECON_PRO if payload.mode == ReconMode.pro else OpCost.RECON_FREE
    if not await credits_service.debit(user_id, cost, f"Recon {payload.mode.value}: {url}"):
        raise HTTPException(
            status_code=402,
            detail=f"Saldo credits tidak cukup. Operasi ini butuh {cost} credits. Silakan top up di /pricing.",
        )

    try:
        profile, tokens_used = await run_recon_pipeline(url=url, mode=payload.mode)
        return ReconResponse.model_validate({**profile.model_dump(), "tokens_used": tokens_used})

    except RuntimeError as exc:
        # RuntimeError dari pipeline = error operasional yang sudah ter-log
        msg = str(exc)
        logger.error("[POST /api/recon] pipeline error | url=%r mode=%s: %s", url, payload.mode.value, msg)
        await credits_service.grant(user_id, cost, f"Refund Recon gagal: {url}", tx_type="refund")
        raise HTTPException(status_code=502, detail=msg) from exc

    except Exception as exc:
        # Exception tak terduga
        logger.exception("[POST /api/recon] unexpected error | url=%r mode=%s", url, payload.mode.value)
        await credits_service.grant(user_id, cost, f"Refund Recon error: {url}", tx_type="refund")
        raise HTTPException(
            status_code=500,
            detail="Terjadi kesalahan internal pada server. Silakan coba lagi.",
        ) from exc


# ─── Pro Mode endpoint ────────────────────────────────────────────────────────

class ProReconRequest(BaseModel):
    query:   str                       # free-form: URL only, or URL + research directives


@router.post("/recon/pro")
async def recon_pro(req: ProReconRequest, user_id: str = Depends(get_current_user)):
    """
    Pro Mode: call Tavily Research API directly, save markdown report to Supabase.
    Returns company_id for redirect to /recon/[id].
    """
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query tidak boleh kosong")

    if not user_id:
        raise HTTPException(status_code=401, detail="user_id wajib disertakan. Silakan login ulang.")

    # Pro mode = 5 credits, debit upfront
    if not await credits_service.debit(user_id, OpCost.RECON_PRO, f"Recon Pro: {query[:80]}"):
        raise HTTPException(
            status_code=402,
            detail=f"Saldo credits tidak cukup. Recon Pro butuh {OpCost.RECON_PRO} credits. Silakan top up di /pricing.",
        )

    try:
        result = await run_tavily_research(query)
    except Exception as exc:
        logger.error("[recon_pro] Tavily research failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Tavily Research gagal: {exc}")

    content: str = result["content"]

    url_match = re.search(r"https?://[^\s]+", query)
    company_url = url_match.group(0).rstrip("/") if url_match else query[:120]

    # Domain-based fallback name (used as hint for extraction and as final fallback)
    domain_fallback = _extract_domain(company_url).split(".")[0].replace("-", " ").title()

    # ── Run extraction BEFORE Supabase insert so we get a clean company_name ──
    try:
        extracted = await extract_from_tavily_report(
            report=content,
            company_name=domain_fallback,
        )
    except Exception as exc:
        logger.warning("[recon_pro] extraction skipped: %s", exc)
        extracted = None

    # Use AI-extracted clean name if available, else fall back to domain-based name
    company_name = (
        extracted.company_name.strip()
        if extracted and extracted.company_name.strip()
        else domain_fallback
    )

    company_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    supabase_base = settings.NEXT_PUBLIC_SUPABASE_URL.rstrip("/")
    supabase_key  = settings.SUPABASE_SERVICE_ROLE_KEY
    rest_url = f"{supabase_base}/rest/v1/companies"
    headers = {
        "apikey":        supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(rest_url, headers=headers, json={
                "id":               company_id,
                "user_id":          user_id,
                "name":             company_name,
                "url":              company_url,
                "recon_mode":       "pro",
                "tavily_report":    content,
                "industry":         "",
                "size":             "",
                "hq":               "",
                "description":      "",
                "deep_insights":    [],
                "anomalies":        [],
                "citations":        [],
                "linkedin_followers": "0",
                "linkedin_employees": 0,
                "linkedin_growth":  "0%",
                "progress_recon":   True,
                "progress_match":   False,
                "progress_craft":   False,
                "progress_polish":  False,
                "progress_launch":  False,
                "progress_pulse":   False,
                "created_at":       now,
                "cached_at":        now,
            })
            resp.raise_for_status()
    except Exception as exc:
        logger.error("[recon_pro] Supabase insert failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Gagal menyimpan laporan: {exc}")

    if extracted:
        # Save pain_points
        if extracted.painPoints:
            pain_rows = [
                {
                    "user_id":     user_id,
                    "company_id":  company_id,
                    "category":    p.category,
                    "issue":       p.issue,
                    "severity":    p.severity,
                    "match_angle": p.matchAngle or None,
                }
                for p in extracted.painPoints
            ]
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        f"{supabase_base}/rest/v1/pain_points",
                        headers=headers,
                        json=pain_rows,
                    )
            except Exception as exc:
                logger.warning("[recon_pro] pain_points insert failed: %s", exc)

        # Save contacts
        if extracted.contacts:
            contact_rows = [
                {
                    "user_id":        user_id,
                    "company_id":     company_id,
                    "name":           c.name,
                    "title":          c.title,
                    "email":          c.email or "",
                    "linkedin_url":   c.linkedin_url or None,
                    "reasoning":      c.reasoning or "",
                    "prospect_score": 50,
                    "phone":          "",
                }
                for c in extracted.contacts
            ]
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        f"{supabase_base}/rest/v1/contacts",
                        headers=headers,
                        json=contact_rows,
                    )
            except Exception as exc:
                logger.warning("[recon_pro] contacts insert failed: %s", exc)

        # Save news
        if extracted.news:
            news_rows = [
                {
                    "user_id":        user_id,
                    "company_id":     company_id,
                    "title":          n.title,
                    "published_date": n.date or None,
                    "source":         n.source or "",
                    "summary":        n.summary or "",
                    "url":            n.url or "",
                    "signal_type":    None,
                }
                for n in extracted.news
            ]
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        f"{supabase_base}/rest/v1/news",
                        headers=headers,
                        json=news_rows,
                    )
            except Exception as exc:
                logger.warning("[recon_pro] news insert failed: %s", exc)

        logger.info(
            "[recon_pro] extracted | pain_points=%d contacts=%d news=%d",
            len(extracted.painPoints),
            len(extracted.contacts),
            len(extracted.news),
        )

    logger.info("[recon_pro] DONE | company_id=%s name=%r", company_id, company_name[:40])
    return {"company_id": company_id, "name": company_name}
