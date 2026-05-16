"""
catalog.py — Router untuk operasi Product Catalog.

Endpoints:
  POST /api/catalog/pdf-extract  — Ekstrak info produk dari file PDF via AI
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, HTTPException, UploadFile, Depends
from app.core.auth import get_current_user
from app.core.rate_limit import enforce as rate_limit
from app.services import pdf_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

# Hard cap on uploaded PDF size. PDF parser holds the entire file in memory,
# so a 10MB limit keeps one user from OOM-ing the FastAPI process.
MAX_PDF_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post(
    "/pdf-extract",
    summary="Ekstrak informasi produk dari PDF brosur",
    description=(
        "Terima file PDF brosur produk, ekstrak teksnya, lalu gunakan "
        "gpt-4o-mini untuk menghasilkan informasi produk terstruktur. "
        "Kembalikan JSON sesuai kontrak PdfExtractionResult."
    ),
)
async def extract_pdf(file: UploadFile = File(...), user_id: str = Depends(get_current_user)) -> dict:
    """
    POST /api/catalog/pdf-extract

    Request: multipart/form-data dengan field 'file' berisi file PDF.
    Response: { extractedName, extractedTagline, extractedDescription,
                extractedPrice, extractedUsp, confidence }
    """
    # Rate limit: PDF extract has no credit cost yet, so cap requests directly.
    await rate_limit(user_id, bucket="pdf_extract", max_events=10, window_seconds=600)

    # MIME check — filename extensions can be spoofed (malware.exe → photo.pdf).
    if file.content_type and file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="MIME type harus application/pdf.",
        )
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Hanya file PDF yang diizinkan (.pdf).",
        )

    # Read at most MAX_PDF_BYTES+1 bytes so we can detect oversize without
    # buffering an arbitrarily large body.
    file_bytes = await file.read(MAX_PDF_BYTES + 1)

    if not file_bytes:
        raise HTTPException(status_code=400, detail="File PDF kosong.")

    if len(file_bytes) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Ukuran PDF melebihi batas {MAX_PDF_BYTES // (1024 * 1024)}MB.",
        )

    # Magic-bytes check — real PDFs start with "%PDF-".
    if not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="File bukan PDF yang valid (magic bytes salah).",
        )

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
