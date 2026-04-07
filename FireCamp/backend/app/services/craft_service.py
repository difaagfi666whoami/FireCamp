"""
craft_service.py — Generate 3-email B2B outreach sequence via OpenAI gpt-4o.

Pipeline:
  1. Terima company_data + product_data sebagai dict
  2. Ekstrak pain points & USP yang relevan
  3. Kirim ke gpt-4o dengan strict JSON schema (CraftResponse)
  4. Kembalikan dict yang siap di-parse sebagai CraftResponse oleh router
"""

from __future__ import annotations

import json
import logging

from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

MODEL = "gpt-4o"

# ── Strict JSON schema — identik 1-to-1 dengan CraftResponse / Campaign ────────

CRAFT_JSON_SCHEMA = {
    "name": "craft_response",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "reasoning": {"type": "string"},
            "targetCompany": {"type": "string"},
            "emails": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "sequenceNumber": {"type": "integer"},
                        "dayLabel":       {"type": "string"},
                        "scheduledDay":   {"type": "integer"},
                        "subject":        {"type": "string"},
                        "body":           {"type": "string"},
                        "tone": {
                            "type": "string",
                            "enum": ["profesional", "friendly", "direct", "storytelling"],
                        },
                        "isApproved": {"type": "boolean"},
                    },
                    "required": [
                        "sequenceNumber", "dayLabel", "scheduledDay",
                        "subject", "body", "tone", "isApproved",
                    ],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["reasoning", "targetCompany", "emails"],
        "additionalProperties": False,
    },
}

SYSTEM_PROMPT = """\
Kamu adalah Elite B2B Sales Development Representative (SDR) yang sangat persuasif \
dan berpengalaman lebih dari 10 tahun dalam industri SaaS dan jasa konsultasi B2B Indonesia.

Tugasmu: Racik 3-email outreach sequence dalam BAHASA INDONESIA YANG NATURAL DAN PROFESIONAL \
untuk mendekati perusahaan target berdasarkan profil dan pain points mereka.

Aturan sequence:
- Email 1 (Hari 1)  — dayLabel: "Hari 1"  — Tone: profesional
  Ice-breaker: tunjukkan empati terhadap situasi bisnis target, singgung 1 pain point spesifik,
  perkenalkan produk secara halus. JANGAN langsung hard-sell.

- Email 2 (Hari 4)  — dayLabel: "Hari 4"  — Tone: friendly
  Follow-up: perdalam relevansi pain point, tawarkan bukti sosial atau use-case konkret,
  ajukan undangan diskusi ringan (demo / discovery call).

- Email 3 (Hari 10) — dayLabel: "Hari 10" — Tone: direct
  Breakup / Urgency close: singkat, langsung ke point, berikan value proposition final,
  buat CTA (Call to Action) yang tegas namun tetap sopan.

Aturan penulisan:
- Bahasa Indonesia yang natural, tidak kaku, tidak terlalu formal.
- Gunakan [Nama] sebagai placeholder penerima.
- Gunakan [Nama Anda] / [Jabatan Anda] sebagai placeholder pengirim.
- Setiap body email minimal 3 paragraf.
- isApproved selalu false — user harus approve manual.
- Field reasoning berisi analisis singkat kamu tentang MENGAPA angle yang dipilih \
  cocok untuk perusahaan ini.
"""


async def generate_campaign_emails(
    company_data: dict,
    product_data: dict,
) -> dict:
    """
    Generate 3-email outreach sequence.

    Args:
        company_data: dict dari CompanyProfile (dikirim langsung dari request body).
        product_data: dict dari ProductCatalogItem (produk yang dipilih user).

    Returns:
        Dict sesuai CraftResponse schema:
        { reasoning, targetCompany, emails: [...] }

    Raises:
        RuntimeError jika OpenAI API gagal atau JSON tidak valid.
    """
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY belum diset di .env.local")

    # Ekstrak data relevan untuk prompt
    company_name   = company_data.get("name", "Perusahaan Target")
    company_industry = company_data.get("industry", "")
    company_hq     = company_data.get("hq", "")
    pain_points    = company_data.get("painPoints", [])
    product_name   = product_data.get("name", "")
    product_tagline = product_data.get("tagline", "")
    product_desc   = product_data.get("description", "")
    product_usp    = product_data.get("usp", [])
    product_price  = product_data.get("price", "")

    # Format pain points untuk prompt (max 4 pain points terkuat)
    pain_summary = "\n".join(
        f"- [{p.get('severity', '').upper()}] [{p.get('category', '')}] {p.get('issue', '')}"
        for p in pain_points[:4]
    ) or "- Tidak ada pain point yang teridentifikasi"

    usp_summary = "\n".join(f"- {u}" for u in product_usp[:5]) or "- (tidak tersedia)"

    user_prompt = (
        f"=== PROFIL PERUSAHAAN TARGET ===\n"
        f"Nama      : {company_name}\n"
        f"Industri  : {company_industry}\n"
        f"HQ        : {company_hq}\n\n"
        f"Pain Points teridentifikasi:\n{pain_summary}\n\n"
        f"=== PRODUK YANG AKAN DIPITCH ===\n"
        f"Nama      : {product_name}\n"
        f"Tagline   : {product_tagline}\n"
        f"Deskripsi : {product_desc}\n"
        f"Harga     : {product_price}\n"
        f"USP utama :\n{usp_summary}\n\n"
        f"Buat 3-email sequence outbound B2B yang tajam, personal, dan meyakinkan."
    )

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    try:
        logger.info(
            "[craft_service] generate_campaign_emails | model=%s company=%r",
            MODEL, company_name,
        )

        response = await client.chat.completions.create(
            model=MODEL,
            max_tokens=3000,
            response_format={"type": "json_schema", "json_schema": CRAFT_JSON_SCHEMA},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
        )

        raw = response.choices[0].message.content or "{}"
        result = json.loads(raw)

        # Enforce isApproved = False — tidak percaya output AI
        for email in result.get("emails", []):
            email["isApproved"] = False

        logger.info(
            "[craft_service] OK | company=%r emails=%d tokens=%d",
            company_name,
            len(result.get("emails", [])),
            response.usage.total_tokens if response.usage else 0,
        )
        return result

    except json.JSONDecodeError as exc:
        logger.error("[craft_service] JSON parse error: %s", exc)
        raise RuntimeError(f"Respons AI bukan JSON valid: {exc}") from exc
    except Exception as exc:
        logger.error("[craft_service] OpenAI error: %s", exc)
        raise RuntimeError(f"Generate campaign gagal: {exc}") from exc
