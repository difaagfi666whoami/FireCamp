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
            "reasoning": {"type": "string", "minLength": 40},
            "targetCompany": {"type": "string", "minLength": 1},
            "emails": {
                "type": "array",
                "minItems": 3,
                "maxItems": 3,
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
Kamu adalah Elite B2B Strategic Sales Advisor yang mengadopsi framework \
"The Challenger Sale" + "Consultative Selling". Kamu sudah 10+ tahun menutup deal SaaS & \
jasa konsultasi di pasar Indonesia dengan gaya insight-led — BUKAN product-led.

MISIMU: Racik 3-email outreach sequence dalam BAHASA INDONESIA YANG NATURAL, TAJAM, & \
INSIGHTFUL. Setiap email harus MENANTANG status quo prospek, bukan sekadar pitch produk.

=== PRINSIP INTI (WAJIB) ===
1. INSIGHT-LED — Setiap email harus membuka WAWASAN BARU yang prospek mungkin belum sadari \
   tentang bisnis / industri mereka. Manfaatkan data `executiveInsight`, `marketDynamics`, \
   dan `deepInsights` sebagai amunisi insight utama.
2. TEACH, TAILOR, TAKE CONTROL — Ajari sudut pandang baru, sesuaikan ke konteks mereka, \
   lalu pimpin percakapan ke arah solusi.
3. CHALLENGE — Jangan cuma "empati" ke pain point; reframe pain point menjadi biaya bisnis \
   yang tersembunyi (hidden cost / opportunity cost).
4. SPECIFIC — Sebut nama perusahaan, sebut angka/industri/konteks spesifik. JANGAN generik.
5. PAIN POINT RELEVAN SAJA — Hanya gunakan pain points yang di-address oleh produk \
   (sudah difilter di user prompt). JANGAN mention pain point lain.

=== YANG HARUS DIHINDARI (HARAM) ===
- Pembukaan kaku: "Dear Sir/Madam", "Kepada Yth", "Saya menulis email ini untuk...", \
  "Perkenalkan, nama saya...", "Semoga email ini menemukan Anda dalam keadaan baik..."
- Template-feel, basa-basi, atau korporat-speak berlebih.
- Menjual fitur produk di Email 1.
- Subject line panjang, formal, atau title-case.
- Subject line ber-emoji.

=== FORMAT SUBJECT LINE ===
- Pendek (3–7 kata), LOWERCASE, punchy, provokatif / insight-driven.
- Boleh mention nama perusahaan target.
- Contoh gaya: "ide efisiensi operasional [Company]", "angle yang mungkin terlewat", \
  "satu blind spot soal growth", "cara [Company] bisa hemat 20% opex".

=== STRUKTUR SEQUENCE ===
- Email 1 (Hari 1) — dayLabel: "Hari 1" — tone: profesional
  INSIGHT-LED ICE BREAKER. Buka dengan insight tajam dari `executiveInsight` / `marketDynamics`.
  Kaitkan ke pain point SPESIFIK yang sudah difilter. Sentil USP produk secara HALUS di akhir
  (1 kalimat maksimal). Tidak ada CTA hard — cukup "boleh saya share detail angle ini?".

- Email 2 (Hari 4) — dayLabel: "Hari 4" — tone: friendly
  BUSINESS CASE + SOCIAL PROOF. Tampilkan reasoning mengapa produk cocok (pakai data
  `reasoning` dari AI match). Sertakan bukti sosial atau use-case konkret (boleh dibuat realistic:
  "perusahaan sejenis di industri X mengalami..."). Ajak diskusi 15 menit / discovery call.

- Email 3 (Hari 10) — dayLabel: "Hari 10" — tone: direct
  DIRECT BREAKUP / URGENCY. Singkat (maks 2 paragraf pendek). Akui kalau timing-nya mungkin
  belum pas, tapi beri 1 urgency nyata (kompetitor bergerak, window opportunity, dst). CTA
  tegas: 1 kalimat, 1 pertanyaan ya/tidak.

=== ATURAN PENULISAN ===
- Bahasa Indonesia natural, percakapan level eksekutif — tidak kaku, tidak alay.
- Gunakan [Nama] sebagai placeholder penerima.
- Gunakan [Nama Anda] / [Jabatan Anda] sebagai placeholder pengirim.
- Email 1 & 2: 3–4 paragraf pendek. Email 3: 2 paragraf pendek.
- isApproved SELALU false.
- Field `reasoning` (top-level): jelaskan STRATEGIC ANGLE yang kamu pilih — insight utama,
  pain point yang di-address, dan mengapa angle ini menantang status quo perusahaan target.
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

    # ── Company context ───────────────────────────────────────────────────
    company_name     = company_data.get("name", "Perusahaan Target")
    company_industry = company_data.get("industry", "")
    company_hq       = company_data.get("hq", "")
    company_desc     = company_data.get("description", "")
    all_pain_points  = company_data.get("painPoints", [])
    deep_insights    = company_data.get("deepInsights", []) or []
    strategic_report = company_data.get("strategicReport") or {}

    strategic_title       = strategic_report.get("strategicTitle", "") if isinstance(strategic_report, dict) else ""
    executive_insight     = strategic_report.get("executiveInsight", "") if isinstance(strategic_report, dict) else ""
    internal_capabilities = strategic_report.get("internalCapabilities", "") if isinstance(strategic_report, dict) else ""
    market_dynamics       = strategic_report.get("marketDynamics", "") if isinstance(strategic_report, dict) else ""
    strategic_roadmap     = strategic_report.get("strategicRoadmap", []) if isinstance(strategic_report, dict) else []

    # ── Product context (dari ProductMatch) ───────────────────────────────
    product_name    = product_data.get("name", "")
    product_tagline = product_data.get("tagline", "")
    product_desc    = product_data.get("description", "")
    product_usp     = product_data.get("usp", [])
    product_price   = product_data.get("price", "")
    match_score     = product_data.get("matchScore", 0)
    match_reasoning = product_data.get("reasoning", "")
    addressed_idx   = product_data.get("addressedPainIndices", []) or []

    # ── Filter pain points: HANYA yang di-address produk ─────────────────
    if addressed_idx:
        relevant_pain_points = [
            all_pain_points[i] for i in addressed_idx
            if isinstance(i, int) and 0 <= i < len(all_pain_points)
        ]
    else:
        # Fallback: top 3 saja agar prompt tetap fokus
        relevant_pain_points = all_pain_points[:3]

    pain_summary = "\n".join(
        f"- [{p.get('severity', '').upper()}] [{p.get('category', '')}] {p.get('issue', '')}"
        for p in relevant_pain_points
    ) or "- (tidak ada pain point relevan yang teridentifikasi — fokus ke insight strategis)"

    usp_summary = "\n".join(f"- {u}" for u in product_usp[:5]) or "- (tidak tersedia)"

    deep_insights_summary = "\n".join(f"- {d}" for d in deep_insights[:5]) or "- (tidak tersedia)"
    roadmap_summary       = "\n".join(f"- {r}" for r in (strategic_roadmap or [])[:5]) or "- (tidak tersedia)"

    user_prompt = (
        f"=== PROFIL PERUSAHAAN TARGET ===\n"
        f"Nama       : {company_name}\n"
        f"Industri   : {company_industry}\n"
        f"HQ         : {company_hq}\n"
        f"Deskripsi  : {company_desc}\n\n"
        f"=== STRATEGIC INTELLIGENCE (BCG-style report) ===\n"
        f"Strategic Title       : {strategic_title}\n"
        f"Executive Insight     : {executive_insight}\n"
        f"Internal Capabilities : {internal_capabilities}\n"
        f"Market Dynamics       : {market_dynamics}\n"
        f"Strategic Roadmap     :\n{roadmap_summary}\n\n"
        f"=== DEEP INSIGHTS ===\n{deep_insights_summary}\n\n"
        f"=== PAIN POINTS RELEVAN (sudah difilter — HANYA yang di-address produk) ===\n"
        f"{pain_summary}\n\n"
        f"=== PRODUK YANG AKAN DIPITCH ===\n"
        f"Nama      : {product_name}\n"
        f"Tagline   : {product_tagline}\n"
        f"Deskripsi : {product_desc}\n"
        f"Harga     : {product_price}\n"
        f"USP utama :\n{usp_summary}\n\n"
        f"=== AI MATCH REASONING (dari tahap Match) ===\n"
        f"Match Score: {match_score}/100\n"
        f"Reasoning  : {match_reasoning or '(tidak tersedia)'}\n\n"
        f"INSTRUKSI:\n"
        f"Racik 3-email insight-led outreach sequence mengikuti framework Challenger Sale.\n"
        f"Gunakan `executiveInsight` dan `marketDynamics` sebagai amunisi insight utama di Email 1.\n"
        f"Gunakan `reasoning` dari AI match sebagai fondasi business case di Email 2.\n"
        f"HANYA address pain points yang tercantum di atas — JANGAN invent pain lain.\n"
        f"Subject line HARUS lowercase, punchy, insight-led.\n"
        f"JANGAN gunakan pembukaan kaku / template-feel."
    )

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    try:
        logger.info(
            "[craft_service] generate_campaign_emails | model=%s company=%r",
            MODEL, company_name,
        )

        response = await client.chat.completions.create(
            model=MODEL,
            max_tokens=6000,
            temperature=0.7,
            response_format={"type": "json_schema", "json_schema": CRAFT_JSON_SCHEMA},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
        )

        choice       = response.choices[0]
        finish       = choice.finish_reason
        message      = choice.message
        refusal      = getattr(message, "refusal", None)
        content      = message.content

        # ── Handle truncation ─────────────────────────────────────────────
        if finish == "length":
            raise RuntimeError(
                "Respons AI ter-truncate (max_tokens tercapai). "
                "Coba ulangi atau naikkan budget token."
            )

        # ── Handle refusal ────────────────────────────────────────────────
        if refusal:
            raise RuntimeError(f"AI menolak membuat campaign: {refusal}")

        if not content:
            raise RuntimeError("Respons AI kosong (content=None). Coba ulangi.")

        result = json.loads(content)

        # ── Hard validate payload (defense-in-depth vs schema drift) ──────
        emails    = result.get("emails") or []
        reasoning = (result.get("reasoning") or "").strip()
        target    = (result.get("targetCompany") or "").strip()

        if len(emails) < 3:
            raise RuntimeError(
                f"Respons AI invalid: hanya {len(emails)} email (harus 3). "
                f"finish_reason={finish}"
            )
        if not reasoning:
            raise RuntimeError("Respons AI invalid: field `reasoning` kosong.")
        if not target:
            raise RuntimeError("Respons AI invalid: field `targetCompany` kosong.")
        for i, e in enumerate(emails, start=1):
            if not (e.get("subject") or "").strip():
                raise RuntimeError(f"Respons AI invalid: Email {i} subject kosong.")
            if not (e.get("body") or "").strip():
                raise RuntimeError(f"Respons AI invalid: Email {i} body kosong.")

        # Enforce isApproved = False — tidak percaya output AI
        for email in emails:
            email["isApproved"] = False

        logger.info(
            "[craft_service] OK | company=%r emails=%d tokens=%d finish=%s",
            company_name,
            len(emails),
            response.usage.total_tokens if response.usage else 0,
            finish,
        )
        return result

    except json.JSONDecodeError as exc:
        logger.error("[craft_service] JSON parse error: %s", exc)
        raise RuntimeError(f"Respons AI bukan JSON valid: {exc}") from exc
    except Exception as exc:
        logger.error("[craft_service] OpenAI error: %s", exc)
        raise RuntimeError(f"Generate campaign gagal: {exc}") from exc
