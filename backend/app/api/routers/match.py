"""
match.py — Router POST /api/match

Pipeline:
  1. Terima CompanyProfile dari frontend (hasil Recon)
  2. Load product catalog dari Supabase tabel 'products' via REST API
  3. Panggil openai_service.run_matching() → list[ProductMatch] diurutkan score tertinggi
  4. Kembalikan hasil ke frontend
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Depends
from app.core.auth import get_current_user

from app.models.schemas import (
    CompanyProfile,
    MatchRequest,
    MatchResponse,
    ProductCatalogItem,
)
from app.core.billing import OpCost
from app.core.rate_limit import enforce as rate_limit
from app.services import openai_service, credits_service
from app.services.supabase_client import fetch_table
from app.services.token_writer import write_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["match"])


# ─── Catalog loader ───────────────────────────────────────────────────────────

async def _load_catalog(user_id: str) -> list[ProductCatalogItem]:
    """
    Load product catalog dari Supabase tabel 'products'.
    Fallback ke list kosong jika fetch gagal.
    """
    rows = await fetch_table("products", order="created_at.desc", eq={"user_id": user_id})
    if not rows:
        logger.warning("[match] Katalog produk kosong atau gagal di-fetch dari Supabase.")
        return []

    catalog: list[ProductCatalogItem] = []
    for row in rows:
        try:
            catalog.append(ProductCatalogItem(
                id=row["id"],
                name=row["name"],
                tagline=row.get("tagline", ""),
                description=row.get("description", ""),
                price=row.get("price", ""),
                painCategories=row.get("pain_categories", []),
                usp=row.get("usp", []),
                source=row.get("source", "manual"),
                createdAt=row.get("created_at", ""),
                updatedAt=row.get("updated_at", ""),
            ))
        except Exception as exc:
            logger.warning("[match] Skip invalid product row %r: %s", row.get("id"), exc)

    logger.info("[match] Catalog loaded from Supabase | products=%d", len(catalog))
    return catalog


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post(
    "/match",
    response_model=MatchResponse,
    summary="AI Product Matching",
    description=(
        "Hitung kesesuaian setiap produk dalam katalog terhadap pain points "
        "perusahaan target. Mengembalikan top 3-5 produk diurutkan matchScore tertinggi."
    ),
)
async def run_match(payload: MatchRequest, user_id: str = Depends(get_current_user)) -> MatchResponse:
    """
    POST /api/match

    Request body:  { "companyProfile": CompanyProfile }
    Response body: list[ProductMatch] — diurutkan matchScore DESC
    Error:         { "detail": "Pesan error Bahasa Indonesia" }
    """
    profile: CompanyProfile = payload.companyProfile

    if not profile.painPoints:
        raise HTTPException(
            status_code=400,
            detail="Profil perusahaan tidak memiliki pain points. Jalankan Recon terlebih dahulu.",
        )

    catalog = await _load_catalog(user_id)
    if not catalog:
        raise HTTPException(
            status_code=503,
            detail="Katalog produk kosong. Pastikan sudah ada produk di Supabase tabel 'products'.",
        )

    # Rate limit before credit debit so a 429 doesn't cost the user.
    await rate_limit(user_id, bucket="match", max_events=30, window_seconds=3600)

    # Match = 1 credit per call
    if not await credits_service.debit(user_id, OpCost.MATCH, f"Match: {profile.name}"):
        raise HTTPException(
            status_code=402,
            detail=f"Saldo credits tidak cukup. Match butuh {OpCost.MATCH} credit. Silakan top up di /pricing.",
        )

    logger.info(
        "[POST /api/match] START | company=%r painPoints=%d catalog=%d",
        profile.name, len(profile.painPoints), len(catalog),
    )

    try:
        matches, match_tokens = await openai_service.run_matching(profile, catalog)
    except RuntimeError as exc:
        msg = str(exc)
        logger.error("[POST /api/match] run_matching error | company=%r: %s", profile.name, msg)
        await credits_service.grant(user_id, OpCost.MATCH, f"Refund Match gagal: {profile.name}", tx_type="refund")
        raise HTTPException(status_code=502, detail=msg) from exc
    except Exception as exc:
        logger.exception("[POST /api/match] unexpected error | company=%r", profile.name)
        await credits_service.grant(user_id, OpCost.MATCH, f"Refund Match error: {profile.name}", tx_type="refund")
        raise HTTPException(
            status_code=500,
            detail="Terjadi kesalahan internal saat menjalankan pencocokan produk.",
        ) from exc

    logger.info(
        "[POST /api/match] DONE | company=%r matches=%d tokens=%d",
        profile.name, len(matches), match_tokens,
    )

    if payload.campaign_id:
        try:
            await write_token(payload.campaign_id, "token_match", match_tokens)
        except Exception as e:
            logger.warning("[POST /api/match] token write FAILED (non-fatal): %s", e)

    return MatchResponse(matches=matches, tokens_used=match_tokens)
