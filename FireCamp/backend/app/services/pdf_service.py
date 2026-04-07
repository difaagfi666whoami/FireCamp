"""
pdf_service.py — Ekstraksi informasi produk dari file PDF menggunakan OpenAI.

Pipeline:
  1. Baca teks dari file PDF menggunakan pypdf.PdfReader
  2. Kirim teks ke gpt-4o-mini dengan JSON schema output
  3. Kembalikan dict sesuai kontrak PdfExtractionResult frontend
"""

from __future__ import annotations

import io
import json
import logging

from openai import AsyncOpenAI
from pypdf import PdfReader

from app.core.config import settings

logger = logging.getLogger(__name__)

MODEL = "gpt-4o-mini"

PDF_JSON_SCHEMA = {
    "name": "pdf_extraction_result",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "extractedName":        {"type": "string"},
            "extractedTagline":     {"type": "string"},
            "extractedDescription": {"type": "string"},
            "extractedPrice":       {"type": "string"},
            "extractedUsp":         {"type": "array", "items": {"type": "string"}},
            "confidence":           {"type": "number"},
        },
        "required": [
            "extractedName",
            "extractedTagline",
            "extractedDescription",
            "extractedPrice",
            "extractedUsp",
            "confidence",
        ],
        "additionalProperties": False,
    },
}

SYSTEM_PROMPT = (
    "Kamu adalah Product Manager berpengalaman yang ahli menganalisa brosur produk B2B. "
    "Tugasmu: ekstrak informasi produk dari teks brosur PDF yang diberikan, lalu kembalikan "
    "dalam format JSON yang telah ditentukan.\n\n"
    "Panduan pengisian field:\n"
    "- extractedName: Nama produk/layanan utama. Jika ada beberapa, pilih yang paling menonjol.\n"
    "- extractedTagline: Slogan atau value proposition singkat (1 kalimat, max 15 kata).\n"
    "- extractedDescription: Deskripsi lengkap produk dalam 2-4 kalimat. Fokus pada manfaat bisnis.\n"
    "- extractedPrice: Harga atau model pricing jika disebutkan (misal: 'Rp 500.000/bulan', 'Custom pricing'). "
    "Jika tidak ada, isi string kosong.\n"
    "- extractedUsp: Array 2-5 poin keunggulan utama produk (Unique Selling Points). "
    "Setiap poin 1 kalimat singkat dan spesifik.\n"
    "- confidence: Angka 0.0-1.0 yang merepresentasikan seberapa lengkap informasi yang berhasil diekstrak. "
    "1.0 = semua field terisi dengan data nyata dari brosur."
)


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    """Ekstrak seluruh teks dari file PDF menggunakan pypdf."""
    reader = PdfReader(io.BytesIO(file_bytes))
    pages_text: list[str] = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages_text.append(text.strip())
    return "\n\n".join(pages_text)


async def extract_product_from_pdf(file_bytes: bytes, filename: str = "") -> dict:
    """
    Ekstrak informasi produk dari file PDF.

    Args:
        file_bytes: Konten binary file PDF.
        filename:   Nama file asli (untuk logging).

    Returns:
        Dict sesuai kontrak PdfExtractionResult:
        { extractedName, extractedTagline, extractedDescription,
          extractedPrice, extractedUsp, confidence }

    Raises:
        RuntimeError jika ekstraksi teks atau OpenAI API gagal.
    """
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY belum diset di .env.local")

    # 1. Ekstrak teks dari PDF
    try:
        pdf_text = _extract_text_from_pdf(file_bytes)
    except Exception as exc:
        logger.error("[pdf_service] Gagal membaca PDF %r: %s", filename, exc)
        raise RuntimeError(f"Gagal membaca PDF: {exc}") from exc

    if not pdf_text.strip():
        raise RuntimeError(
            "PDF tidak mengandung teks yang dapat dibaca. "
            "Pastikan PDF bukan hasil scan gambar tanpa OCR."
        )

    char_count = len(pdf_text)
    logger.info("[pdf_service] PDF dibaca | file=%r chars=%d", filename, char_count)

    # Batasi teks agar tidak melebihi context window gpt-4o-mini (128k token)
    # Ambil max 8000 karakter pertama — cukup untuk brosur produk normal
    truncated_text = pdf_text[:8000]

    # 2. Panggil OpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    user_prompt = (
        f"Berikut adalah teks dari brosur produk (file: {filename or 'unknown.pdf'}):\n\n"
        f"{truncated_text}\n\n"
        "Ekstrak informasi produk dari teks di atas."
    )

    try:
        logger.info("[pdf_service] Memanggil OpenAI | model=%s", MODEL)
        response = await client.chat.completions.create(
            model=MODEL,
            max_tokens=1024,
            response_format={"type": "json_schema", "json_schema": PDF_JSON_SCHEMA},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
        )

        raw = response.choices[0].message.content or "{}"
        result = json.loads(raw)

        logger.info(
            "[pdf_service] Ekstraksi selesai | file=%r name=%r confidence=%s tokens=%d",
            filename,
            result.get("extractedName", ""),
            result.get("confidence", 0),
            response.usage.total_tokens if response.usage else 0,
        )
        return result

    except json.JSONDecodeError as exc:
        logger.error("[pdf_service] JSON parse error: %s", exc)
        raise RuntimeError(f"Respons AI bukan JSON valid: {exc}") from exc
    except Exception as exc:
        logger.error("[pdf_service] OpenAI error: %s", exc)
        raise RuntimeError(f"Ekstraksi PDF gagal: {exc}") from exc
