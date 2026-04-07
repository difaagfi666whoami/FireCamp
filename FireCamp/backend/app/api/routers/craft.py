"""
craft.py — Router POST /api/craft

Pipeline:
  1. Terima CraftRequest { companyProfile, selectedProduct }
  2. Lempar ke craft_service.generate_campaign_emails()
  3. Validasi respons sebagai CraftResponse dan kembalikan ke frontend
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.models.schemas import CraftRequest, CraftResponse
from app.services import craft_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/craft", tags=["craft"])


@router.post(
    "/",
    response_model=CraftResponse,
    summary="Generate AI Email Campaign",
    description=(
        "Terima profil perusahaan target dan produk yang dipilih, "
        "lalu gunakan gpt-4o untuk menghasilkan 3-email outreach sequence B2B "
        "dalam Bahasa Indonesia yang natural dan persuasif."
    ),
)
async def generate_craft(payload: CraftRequest) -> CraftResponse:
    """
    POST /api/craft

    Request body:  { "companyProfile": CompanyProfile, "selectedProduct": ProductCatalogItem }
    Response body: CraftResponse (Campaign dengan 3 emails)
    """
    company_data = payload.companyProfile.model_dump()
    product_data = payload.selectedProduct.model_dump()

    if not payload.companyProfile.painPoints:
        raise HTTPException(
            status_code=400,
            detail="Profil perusahaan tidak memiliki pain points. Jalankan Recon terlebih dahulu.",
        )

    logger.info(
        "[POST /api/craft] START | company=%r product=%r",
        payload.companyProfile.name,
        payload.selectedProduct.name,
    )

    try:
        result = await craft_service.generate_campaign_emails(company_data, product_data)
    except RuntimeError as exc:
        msg = str(exc)
        logger.error("[POST /api/craft] error | %s", msg)
        raise HTTPException(status_code=502, detail=msg) from exc
    except Exception as exc:
        logger.exception("[POST /api/craft] unexpected error")
        raise HTTPException(
            status_code=500,
            detail="Terjadi kesalahan internal saat membuat campaign.",
        ) from exc

    logger.info(
        "[POST /api/craft] DONE | company=%r emails=%d",
        payload.companyProfile.name,
        len(result.get("emails", [])),
    )
    return CraftResponse(**result)
