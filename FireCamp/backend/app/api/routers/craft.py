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

from app.models.schemas import CraftRequest, CraftResponse, RewriteRequest, RewriteResponse
from app.services import craft_service
from app.services.token_writer import write_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["craft"])


@router.post(
    "/craft",
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
        result, craft_tokens = await craft_service.generate_campaign_emails(
            company_data, product_data
        )
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

    # Tulis token ke Supabase — non-fatal.
    # Recon & Match sudah selesai sebelum campaign_id ada, jadi nilainya
    # dibawa via payload dari sessionStorage frontend dan ditulis di sini.
    if payload.campaign_id:
        try:
            if payload.token_recon and payload.token_recon > 0:
                await write_token(payload.campaign_id, "token_recon", payload.token_recon)
            if payload.token_match and payload.token_match > 0:
                await write_token(payload.campaign_id, "token_match", payload.token_match)
            await write_token(payload.campaign_id, "token_craft", craft_tokens)
        except Exception as e:
            logger.warning("[POST /api/craft] token write FAILED (non-fatal): %s", e)

    logger.info(
        "[POST /api/craft] DONE | company=%r emails=%d",
        payload.companyProfile.name,
        len(result.get("emails", [])),
    )
    return CraftResponse(**result)


@router.post(
    "/craft/rewrite",
    response_model=RewriteResponse,
    summary="Rewrite AI Email Tone",
    description="Rewrite a specific email's tone while preserving the Challenger Sale context and reasoning.",
)
async def regenerate_craft_tone(payload: RewriteRequest) -> RewriteResponse:
    """
    POST /api/craft/rewrite
    """
    logger.info(
        "[POST /api/craft/rewrite] START | target=%r seq=%d tone=%s",
        payload.targetCompany,
        payload.sequenceNumber,
        payload.newTone,
    )

    try:
        result, polish_tokens = await craft_service.rewrite_email_tone_async(
            target_company=payload.targetCompany,
            original_subject=payload.originalSubject,
            original_body=payload.originalBody,
            campaign_reasoning=payload.campaignReasoning,
            new_tone=payload.newTone,
            sequence_number=payload.sequenceNumber,
        )
    except RuntimeError as exc:
        msg = str(exc)
        logger.error("[POST /api/craft/rewrite] error | %s", msg)
        raise HTTPException(status_code=502, detail=msg) from exc
    except Exception as exc:
        logger.exception("[POST /api/craft/rewrite] unexpected error")
        raise HTTPException(
            status_code=500,
            detail="Terjadi kesalahan internal saat merombak tone email.",
        ) from exc

    if payload.campaign_id:
        try:
            await write_token(payload.campaign_id, "token_polish", polish_tokens)
        except Exception as e:
            logger.warning("[POST /api/craft/rewrite] token write FAILED (non-fatal): %s", e)

    logger.info("[POST /api/craft/rewrite] DONE | tokens=%d", polish_tokens)
    return RewriteResponse(**result)
