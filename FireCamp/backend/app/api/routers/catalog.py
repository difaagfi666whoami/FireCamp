"""
catalog.py — Router untuk operasi Product Catalog.

Endpoints:
  POST /api/catalog/pdf-extract  — Ekstrak info produk dari file PDF via AI
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services import pdf_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.post(
    "/pdf-extract",
    summary="Ekstrak informasi produk dari PDF brosur",
    description=(
        "Terima file PDF brosur produk, ekstrak teksnya, lalu gunakan "
        "gpt-4o-mini untuk menghasilkan informasi produk terstruktur. "
        "Kembalikan JSON sesuai kontrak PdfExtractionResult."
    ),
)
async def extract_pdf(file: UploadFile = File(...)) -> dict:
    """
    POST /api/catalog/pdf-extract

    Request: multipart/form-data dengan field 'file' berisi file PDF.
    Response: { extractedName, extractedTagline, extractedDescription,
                extractedPrice, extractedUsp, confidence }
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Hanya file PDF yang diizinkan (.pdf).",
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="File PDF kosong.")

    logger.info(
        "[POST /api/catalog/pdf-extract] START | file=%r size=%d bytes",
        file.filename,
        len(file_bytes),
    )

    try:
        result = await pdf_service.extract_product_from_pdf(file_bytes, file.filename)
    except RuntimeError as exc:
        msg = str(exc)
        logger.error("[POST /api/catalog/pdf-extract] error | %s", msg)
        raise HTTPException(status_code=422, detail=msg) from exc
    except Exception as exc:
        logger.exception("[POST /api/catalog/pdf-extract] unexpected error")
        raise HTTPException(
            status_code=500,
            detail="Terjadi kesalahan internal saat mengekstrak PDF.",
        ) from exc

    logger.info(
        "[POST /api/catalog/pdf-extract] DONE | file=%r name=%r",
        file.filename,
        result.get("extractedName", ""),
    )
    return result
