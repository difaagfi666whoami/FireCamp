"""
recon.py — Router POST /api/recon + Three-Lane Orchestrator.

Pipeline flow (3-Lane Architecture — Zero Apollo/Apify):

  Input: url + mode
       │
       ▼
  Step 0: Tavily /extract → ground truth (nama, domain)
       │
  ┌────┴──────────┐
  │       │       │  ← asyncio.gather() — PARALEL
LANE A  LANE B  LANE C
Profiler Contact  News
(Tavily) (Serper) (Serper+Jina)
  │       │       │
  └───┬───┘       │
      └─────┬─────┘
            ▼
  OpenAI: synthesize_profile()
  Lane A + contacts + news → CompanyProfile JSON
"""

from __future__ import annotations

import asyncio
import logging
import re
from urllib.parse import urlparse
from typing import Any

from fastapi import APIRouter, HTTPException

from app.models.schemas import CompanyProfile, ReconMode, ReconRequest, ReconResponse
from app.services import (
    openai_service,
    tavily_service,
    lane_a_service,
    lane_b_service,
    lane_c_service,
)

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

    # ── Step 1: Lane A, B, C paralel ──────────────────────────────────────────
    try:
        lane_a_result, scored_contacts, lane_c_result = await asyncio.gather(
            _run_lane_a(canonical_url, company_name, domain, mode),
            _run_lane_b(domain, company_name, company_context),
            _run_lane_c(company_name, domain, industry_hint),
        )
        lane_a_summary, lane_a_evidence = lane_a_result
        parsed_news, pain_signals_from_news = lane_c_result
    except Exception as exc:
        logger.error("[pipeline] gather Lane A+B+C FAILED | error=%s", exc)
        raise RuntimeError(
            f"Pipeline riset gagal pada tahap pencarian data: {exc}"
        ) from exc

    logger.info(
        "[pipeline] gather OK | lane_a_chars=%d lane_b_contacts=%d lane_c_news=%d",
        len(lane_a_summary),
        len(scored_contacts),
        len(parsed_news),
    )

    # ── Step 2: Final Synthesis ───────────────────────────────────────────────
    try:
        profile, tokens_used = await openai_service.synthesize_profile(
            lane_a_summary=lane_a_summary,
            scored_contacts=scored_contacts,
            company_url=canonical_url,
            mode=mode,
            extracted_news=parsed_news,
            evidence_list=lane_a_evidence,
            pain_signals_from_news=pain_signals_from_news,
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
async def generate_recon(payload: ReconRequest) -> ReconResponse:
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

    try:
        profile, tokens_used = await run_recon_pipeline(url=url, mode=payload.mode)
        return ReconResponse.model_validate({**profile.model_dump(), "tokens_used": tokens_used})

    except RuntimeError as exc:
        # RuntimeError dari pipeline = error operasional yang sudah ter-log
        msg = str(exc)
        logger.error("[POST /api/recon] pipeline error | url=%r mode=%s: %s", url, payload.mode.value, msg)
        raise HTTPException(status_code=502, detail=msg) from exc

    except Exception as exc:
        # Exception tak terduga
        logger.exception("[POST /api/recon] unexpected error | url=%r mode=%s", url, payload.mode.value)
        raise HTTPException(
            status_code=500,
            detail="Terjadi kesalahan internal pada server. Silakan coba lagi.",
        ) from exc
