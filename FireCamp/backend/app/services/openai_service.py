"""
openai_service.py — AI Synthesizer berbasis OpenAI (pengganti anthropic_service).

Model yang digunakan:
  • gpt-4o-mini  → tugas ringan & volume tinggi (hemat cost)
      - distill_lane_a()   : ringkas Tavily results → teks terstruktur
      - score_contacts()   : prospect score 0-100 + reasoning per kontak

  • gpt-4o       → tugas berat, output final JSON ter-validasi
      - synthesize_profile() : Lane A + Lane B → CompanyProfile (Structured Output)
      - run_matching()        : score produk vs pain points → list[ProductMatch]
      - generate_campaign()   : 3 email sequence → Campaign

Fungsi synthesize_profile menggunakan OpenAI Structured Output
(beta.chat.completions.parse + response_format=PydanticModel) agar output
selalu ter-validasi Pydantic tanpa regex parsing manual.

Interface (nama fungsi, signature, return type) identik 1-to-1 dengan
anthropic_service yang dihapus — router tidak perlu diubah selain import.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings
from app.models.schemas import (
    Campaign,
    CompanyProfile,
    ProductCatalogItem,
    ProductMatch,
    ReconMode,
)

logger = logging.getLogger(__name__)

MODEL_MINI   = "gpt-4o-mini"
MODEL_MAIN   = "gpt-4o"


# ─── Client factory ───────────────────────────────────────────────────────────

def _get_client() -> AsyncOpenAI:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY belum diset di .env.local")
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


# ─── distill_lane_a ───────────────────────────────────────────────────────────

async def distill_lane_a(
    raw_search_results: list[dict[str, Any]],
    company_name: str,
    mode: ReconMode,
) -> str:
    """
    Distill hasil Tavily search/research (Lane A) menjadi teks terstruktur
    yang siap dikonsumsi synthesize_profile().

    Model: gpt-4o-mini (hemat, cukup untuk summarisation).

    Args:
        raw_search_results: list item dari Tavily 'results'.
        company_name:       Nama perusahaan untuk konteks.
        mode:               ReconMode.free → ringkasan umum,
                            ReconMode.pro  → sertakan angka/persentase spesifik.
        company_name:       Nama perusahaan untuk konteks.

    Returns:
        String summary terstruktur (bukan JSON).

    Raises:
        RuntimeError jika API call gagal.
    """
    depth_instruction = (
        "Sintesis mendalam: sertakan angka spesifik, persentase, dan indikator "
        "finansial jika ditemukan dalam data."
        if mode == ReconMode.pro
        else "Sintesis umum: ringkasan solid tanpa perlu detail angka spesifik."
    )

    results_text = "\n\n---\n\n".join(
        f"[{i+1}] {r.get('title', 'No title')}\n"
        f"URL: {r.get('url', '')}\n"
        f"{r.get('content', r.get('raw_content', ''))}"
        for i, r in enumerate(raw_search_results[:10])
    )

    system_prompt = (
        "Kamu adalah analis bisnis B2B. "
        "Distill informasi berikut menjadi ringkasan terstruktur tentang perusahaan target. "
        "Format output:\n"
        "OVERVIEW: [2-6 kalimat tentang bisnis, model revenue, dan posisi pasar]\n"
        "PAIN_POINTS: [bullet list masalah bisnis yang teridentifikasi, lengkap dengan konteks]\n"
        "NEWS: [bullet list berita penting dengan TANGGAL dan URL SOURCE jika ada. JANGAN KOSONG jika ada data!]\n"
        "LINKEDIN_STATS: [Ekstraksi jika ada: jumlah followers, jumlah karyawan, persentase YoY growth. Jika tidak tahu, tulis 'Tidak Diketahui']\n"
        "METADATA: [industri, ukuran perusahaan, HQ, tahun berdiri jika ditemukan]\n"
        f"{depth_instruction}"
    )
    user_prompt = (
        f"Perusahaan target: {company_name}\n\n"
        f"Data riset:\n{results_text}"
    )

    client = _get_client()
    try:
        logger.info("[openai] distill_lane_a | model=%s mode=%s", MODEL_MINI, mode.value)
        response = await client.chat.completions.create(
            model=MODEL_MINI,
            max_tokens=2048,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
        )
        result = response.choices[0].message.content or ""
        logger.info(
            "[openai] distill_lane_a OK | chars=%d tokens=%d",
            len(result),
            response.usage.total_tokens if response.usage else 0,
        )
        return result.strip()

    except Exception as exc:
        logger.error("[openai] distill_lane_a FAILED | error=%s", exc)
        raise RuntimeError(f"Lane A distill gagal: {exc}") from exc


# ─── score_contacts ───────────────────────────────────────────────────────────

async def score_contacts(
    contacts_raw: list[dict[str, Any]],
    company_context: str,
    *,
    company_name: str = "",
) -> list[dict[str, Any]]:
    """
    Beri prospect score (0-100) dan reasoning singkat untuk setiap kontak.

    Model: gpt-4o-mini dengan JSON mode.

    Args:
        contacts_raw:    list kontak mentah (dari Serper Dorking).
        company_context: Deskripsi singkat perusahaan untuk konteks scoring.
        company_name:    Nama perusahaan target untuk validasi relevansi.

    Returns:
        contacts_raw yang sudah ditambahkan 'prospectScore' (int) dan
        'reasoning' (str 1 kalimat Bahasa Indonesia).

    Raises:
        RuntimeError jika API call gagal kritis.
    """
    if not contacts_raw:
        return []

    contacts_json = json.dumps(contacts_raw, ensure_ascii=False, indent=2)

    system_prompt = (
        "Kamu adalah AI yang menilai relevansi kontak B2B untuk tim sales. "
        "Balas HANYA dalam format JSON array (tanpa markdown, tanpa penjelasan). "
        f"Perusahaan target: {company_name or company_context}.\n\n"
        
        "ATURAN VALIDASI KETAT:\n"
        "- Jika kontak TIDAK bekerja di perusahaan target, beri prospectScore = 0.\n"
        "- Hanya kontak yang terbukti CURRENT bekerja di sana boleh score > 0.\n\n"
        
        "Kriteria scoring (0-100):\n"
        "  80-100: C-suite, VP, Founder — budget authority penuh\n"
        "  55-79:  Director, Head of, GM — influencer kuat / champion\n"
        "  0-54:   Manager/Lead tanpa authority jelas, atau tidak relevan\n\n"
        
        "Untuk setiap kontak, tambahkan field 'prospectScore' (integer) dan "
        "'reasoning' (string PERSIS 4 kalimat dengan format berikut — JANGAN kurang dari 4):\n"
        "Kalimat 1 dimulai dengan '[MANDATE] ' — apa yang kemungkinan sedang dikerjakan orang ini saat ini berdasarkan jabatannya.\n"
        "Kalimat 2 dimulai dengan '[PAIN OWNERSHIP] ' — kategori pain mana yang dia miliki dan kenapa.\n"
        "Kalimat 3 dimulai dengan '[HOOK] ' — satu kalimat opening conversation yang tepat dan spesifik.\n"
        "Kalimat 4 dimulai dengan '[RECENCY] ' — apakah ada sinyal bahwa dia masih bekerja di sana saat ini.\n"
        "Semua kalimat dalam Bahasa Indonesia."
    )
    user_prompt = (
        f"Konteks perusahaan: {company_context}\n\n"
        f"Daftar kontak:\n{contacts_json}\n\n"
        "Kembalikan JSON array yang sama dengan tambahan field prospectScore dan reasoning yang formatnya 4 kalimat dengan awalan [MANDATE], [PAIN OWNERSHIP], [HOOK], dan [RECENCY]."
    )

    client = _get_client()
    try:
        logger.info(
            "[openai] score_contacts | model=%s contacts=%d",
            MODEL_MINI, len(contacts_raw),
        )
        response = await client.chat.completions.create(
            model=MODEL_MINI,
            max_tokens=1024,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        user_prompt
                        + '\n\nFormat wajib: {"contacts": [array hasil scoring]}'
                    ),
                },
            ],
        )

        raw_text = response.choices[0].message.content or "{}"
        parsed   = json.loads(raw_text)

        # Normalise: model bisa return {"contacts": [...]} atau langsung [...]
        if isinstance(parsed, list):
            scored = parsed
        elif isinstance(parsed, dict):
            # Cari key apapun yang berisi list
            scored = next(
                (v for v in parsed.values() if isinstance(v, list)),
                contacts_raw,
            )
        else:
            scored = contacts_raw

        logger.info("[openai] score_contacts OK | scored=%d", len(scored))
        return scored

    except json.JSONDecodeError as exc:
        logger.error("[openai] score_contacts JSON parse error: %s", exc)
        for c in contacts_raw:
            c.setdefault("prospectScore", 0)
            c.setdefault("reasoning", "")
        return contacts_raw

    except Exception as exc:
        logger.error("[openai] score_contacts FAILED | error=%s", exc)
        raise RuntimeError(f"Contact scoring gagal: {exc}") from exc


# ─── synthesize_profile ───────────────────────────────────────────────────────

async def synthesize_profile(
    lane_a_summary: str,
    scored_contacts: list[dict[str, Any]],
    company_url: str,
    mode: ReconMode,
    extracted_news: list[dict[str, Any]] | None = None,
    evidence_list: list[dict[str, str]] | None = None,
    pain_signals_from_news: list[dict[str, Any]] | None = None,
) -> CompanyProfile:
    """
    Final synthesis: gabungkan Lane A + Lane B → CompanyProfile JSON
    ter-validasi Pydantic menggunakan OpenAI Structured Output.

    Model: gpt-4o dengan beta.chat.completions.parse(response_format=CompanyProfile).
    OpenAI menjamin output JSON selalu sesuai schema — tidak perlu regex/try-parse manual.

    Args:
        lane_a_summary:  Output distill_lane_a().
        scored_contacts: Output score_contacts() dari Lane B.
        company_url:     URL target (diinjeksikan ke output).
        mode:            ReconMode — untuk label reconMode di profil.
        extracted_news:  Output Lane C — array berita siap pakai (opsional).
        evidence_list:   List bukti fakta dari riset (opsional).
        pain_signals_from_news: Sinyal pain bisnis dari berita (opsional).

    Returns:
        CompanyProfile ter-validasi.

    Raises:
        RuntimeError jika API atau validasi Pydantic gagal.
    """
    import uuid

    contacts_json = json.dumps(scored_contacts, ensure_ascii=False)
    news_json = json.dumps(extracted_news or [], ensure_ascii=False)
    evidence_json = json.dumps(evidence_list or [], ensure_ascii=False)
    news_signals_json = json.dumps(pain_signals_from_news or [], ensure_ascii=False)
    
    depth_note = (
        "Mode Pro: pain points WAJIB mengandung angka/persentase spesifik. "
        "Sertakan 4-5 pain points. deepInsights harus 5-8 item sangat mendalam."
        if mode == ReconMode.pro
        else "Mode Free: 3-4 pain points. deepInsights minimal 5 item terstruktur."
    )

    system_prompt = (
        "Anda adalah Senior Business Intelligence Analyst & Strategic Consultant. "
        "Ubah data mentah riset menjadi laporan analitis-subjektif. "
        "Berikan 'Expert Voice' yang tajam dan berwibawa. "
        "JANGAN gunakan bahasa deskriptif datar. "
        "Gunakan format poin singkat, bold kata kunci penting, dan fokus pada efektivitas operasional serta posisi kompetitif. "
        "Semua teks dalam Bahasa Indonesia. "
        f"{depth_note} "
        "\n\n=== ATURAN WAJIB ===\n\n"

        "1. STRATEGIC REPORT (field 'strategicReport') — WAJIB DIISI:\n"
        "   Ini adalah laporan intelijen utama bergaya konsultan. Isi SEMUA sub-field berikut:\n"
        "   a) 'strategicTitle': Judul tajam 1 baris yang menggambarkan MASALAH INTI + PELUANG perusahaan.\n"
        "      Format: '[Nama Perusahaan]: [Masalah Inti] di Tengah [Peluang/Konteks]'\n"
        "      Contoh: 'PT Maju Bersama: Bottleneck Digitalisasi di Tengah Ekspansi Ritel yang Agresif'\n"
        "      JANGAN gunakan Markdown di field ini — plain text saja.\n"
        "   b) 'executiveInsight': 2-3 kalimat SINTESIS STRATEGIS dengan expert voice. "
        "      Ini adalah 'verdict' analis senior — tajam, berwibawa, langsung ke inti permasalahan bisnis. "
        "      JANGAN gunakan Markdown di field ini — plain text saja.\n"
        "   c) 'internalCapabilities': WAJIB gunakan format Markdown berikut:\n"
        "      - Mulai dengan 1 kalimat pembuka singkat (plain text, tanpa heading).\n"
        "      - Gunakan ## untuk sub-topik utama (contoh: ## Produk & Layanan, ## Infrastruktur Teknologi, ## Skala Operasional).\n"
        "      - Di bawah setiap ## heading, gunakan bullet points (- item) untuk fakta spesifik.\n"
        "      - Gunakan **bold** untuk kata kunci penting di dalam bullet.\n"
        "      - Jika ada URL sumber di evidence_list yang mendukung fakta tersebut, tambahkan sitasi inline di akhir bullet: [Sumber](url).\n"
        "      - JANGAN tulis sebagai satu paragraf panjang. HARUS ada heading + bullets.\n"
        "   d) 'marketDynamics': WAJIB gunakan format Markdown berikut:\n"
        "      - Mulai dengan 1 kalimat pembuka singkat (plain text).\n"
        "      - Gunakan ## untuk sub-topik (contoh: ## Lanskap Kompetitif, ## Peluang Pasar, ## Tekanan & Risiko).\n"
        "      - Di bawah setiap ## heading, gunakan bullet points (- item) untuk insight spesifik.\n"
        "      - Gunakan **bold** untuk nama kompetitor, tren penting, atau angka kunci.\n"
        "      - Jika ada URL sumber di evidence_list yang mendukung fakta tersebut, tambahkan sitasi inline di akhir bullet: [Sumber](url).\n"
        "      - JANGAN tulis sebagai satu paragraf panjang. HARUS ada heading + bullets.\n"
        "   e) 'strategicRoadmap': Array string berisi 3-5 PRIORITAS STRATEGIS actionable (rekomendasi konsultan). "
        "      Setiap item adalah 1 kalimat singkat berformat: 'Prioritaskan [aksi] untuk [outcome bisnis]'. "
        "      Ini adalah array — JANGAN gunakan Markdown, cukup plain text per item.\n\n"

        "2. DESCRIPTION (field 'description'):\n"
        "   Tulis 5-8 kalimat PANJANG yang mencakup: identitas perusahaan, model bisnis utama, "
        "   ekosistem klien/partner, positioning strategis, dan konteks kompetitif. "
        "   BUKAN ringkasan generik — harus ada insight yang membuat sales rep mengerti "
        "   perusahaan ini secara mendalam tanpa perlu riset tambahan.\n\n"

        "3. DEEP INSIGHTS (field 'deepInsights') — MINI REPORT 5 KATEGORI:\n"
        "   Isi array string ini dengan PERSIS 5 item terstruktur menggunakan prefix label:\n"
        "   - Item 1: '[IDENTITAS] ...' — Tahun berdiri, HQ, jumlah karyawan, status legal, "
        "     group/holding, partnership ecosystem, sertifikasi.\n"
        "   - Item 2: '[PRODUK] ...' — Daftar lengkap produk/layanan, fitur unggulan, "
        "     pricing model, target segmen per produk.\n"
        "   - Item 3: '[DIGITAL] ...' — Kehadiran online (website, LinkedIn, Instagram, dll), "
        "     kualitas konten digital, hiring signals, tech stack jika terlihat.\n"
        "   - Item 4: '[POSISI PASAR] ...' — Kompetitor langsung, market share estimasi, "
        "     keunggulan kompetitif (moat), klien besar yang diketahui, validasi pasar.\n"
        "   - Item 5: '[VULNERABILITIES] ...' — Kelemahan bisnis yang teridentifikasi, "
        "     ketergantungan, ancaman kompetitor, gap teknologi, area yang bisa di-approach sales.\n"
        "   Setiap item HARUS berupa 2-4 kalimat lengkap dengan fakta spesifik. "
        "   JANGAN hanya 1 kalimat pendek.\n\n"

        "4. PAIN POINTS — B2B BUSINESS CHALLENGES ONLY:\n"
        "   Setiap pain point HARUS RELEVAN untuk sales approach B2B — masalah bisnis yang bisa di-solve oleh vendor/partner.\n"
        "   DILARANG KERAS: keluhan karyawan internal, rating Glassdoor, budaya kerja, work-life balance, diversity score.\n"
        "   WAJIB: tantangan operasional, gap teknologi, tekanan regulasi, kebutuhan pertumbuhan, efisiensi proses.\n"
        "   Setiap pain point HARUS memiliki:\n"
        "   - 'issue': kalimat lengkap menjelaskan TANTANGAN BISNIS dengan konteks spesifik\n"
        "   - 'sourceUrl': HARUS diambil dari 'EVIDENCE DENGAN URL CITATION' atau 'PAIN SIGNALS DARI BERITA'.\n"
        "   - 'sourceTitle': judul halaman/artikel sumber bukti tersebut\n"
        "   - Jika tidak ada URL yang relevan → sourceUrl = '' dan severity = 'low'.\n"
        "   - DILARANG mengisi sourceUrl dengan URL yang tidak ada dalam evidence/pain_signals.\n\n"

        "5. CONTACTS (field 'contacts'):\n"
        "   SALIN UTUH 1:1 seluruh data kontak dari input Lane B tanpa filter. "
        "   Field email, location, connections, roleDuration, about HARUS disalin persis.\n\n"

        "6. NEWS: field news akan di-inject secara terpisah. Kosongkan array news = [].\n\n"

        "7. LINKEDIN: ambil dari LINKEDIN_STATS input. Konversi karyawan ke integer murni.\n\n"

        "8. Jika data tidak tersedia, gunakan string kosong (jangan null)."
    )
    user_prompt = (
        f"URL perusahaan: {company_url}\n\n"
        f"=== RINGKASAN RISET (Lane A) ===\n{lane_a_summary}\n\n"
        f"=== EVIDENCE DENGAN URL CITATION (Lane A) ===\n"
        f"Ini adalah fakta DENGAN URL sumber. GUNAKAN URL ini untuk mengisi sourceUrl di painPoints.\n"
        f"{evidence_json}\n\n"
        f"=== KONTAK PIC (Lane B) ===\n{contacts_json}\n\n"
        f"=== PAIN SIGNALS DARI BERITA (Lane C) ===\n"
        f"Ini adalah implikasi bisnis yang diekstrak dari berita. Gunakan untuk memperkuat painPoints.\n"
        f"{news_signals_json}\n\n"
        f"=== [BERITA_LANE_C] (untuk konteks saja — akan di-inject ke news secara terpisah) ===\n{news_json}\n\n"
        "Sintesis seluruh data di atas menjadi profil perusahaan lengkap.\n\n"
        "INGAT format deepInsights:\n"
        "- Item 1 harus dimulai dengan '[IDENTITAS] ...'\n"
        "- Item 2 harus dimulai dengan '[PRODUK] ...'\n"
        "- Item 3 harus dimulai dengan '[DIGITAL] ...'\n"
        "- Item 4 harus dimulai dengan '[POSISI PASAR] ...'\n"
        "- Item 5 harus dimulai dengan '[VULNERABILITIES] ...'\n\n"
        "INGAT format strategicReport — WAJIB ISI SEMUA SUB-FIELD:\n"
        "- strategicTitle: judul 1 baris tajam (masalah inti + peluang)\n"
        "- executiveInsight: 2-3 kalimat verdict analis senior\n"
        "- internalCapabilities: narasi kapabilitas internal (produk, SDM, skala)\n"
        "- marketDynamics: narasi dinamika pasar & posisi kompetitif\n"
        "- strategicRoadmap: array 3-5 prioritas actionable ('Prioritaskan ...')\n\n"
        "PENTING untuk field contacts:\n"
        "Salin SEMUA field dari setiap kontak secara verbatim."
    )

    client = _get_client()
    try:
        logger.info(
            "[openai] synthesize_profile | model=%s mode=%s",
            MODEL_MAIN, mode.value,
        )
        # ── OpenAI Structured Output ──────────────────────────────────────────
        # beta.chat.completions.parse() menerima Pydantic model sebagai
        # response_format dan mengembalikan .parsed yang sudah ter-validasi.
        response = await client.beta.chat.completions.parse(
            model=MODEL_MAIN,
            max_tokens=6000,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            response_format=CompanyProfile,
        )

        profile: CompanyProfile = response.choices[0].message.parsed

        if profile is None:
            raise RuntimeError(
                "OpenAI Structured Output mengembalikan None — kemungkinan refusal."
            )

        # Override / inject field deterministik
        object.__setattr__(profile, "id",        profile.id or str(uuid.uuid4()))
        object.__setattr__(profile, "url",        company_url)
        object.__setattr__(profile, "reconMode",  mode)

        # ── INJECT berita Lane C secara deterministik ─────────────────────────
        # GPT-4o Structured Output sering mengabaikan/memodifikasi data berita
        # saat diminta "copy 1:1". Solusi: bypass AI total, inject langsung.
        if extracted_news:
            from app.models.schemas import NewsItem
            injected_news: list[NewsItem] = []
            for n in extracted_news:
                try:
                    injected_news.append(NewsItem(
                        title=n.get("title", ""),
                        date=n.get("date", ""),
                        source=n.get("source", ""),
                        summary=n.get("summary", ""),
                        url=n.get("url", ""),
                    ))
                except Exception:
                    pass  # skip malformed news item
            if injected_news:
                object.__setattr__(profile, "news", injected_news)
                logger.info(
                    "[openai] synthesize_profile | injected %d news from Lane C",
                    len(injected_news),
                )

        logger.info(
            "[openai] synthesize_profile OK | company=%r tokens=%d news=%d",
            profile.name,
            response.usage.total_tokens if response.usage else 0,
            len(profile.news),
        )
        return profile

    except Exception as exc:
        logger.error("[openai] synthesize_profile FAILED | error=%s", exc)
        raise RuntimeError(
            f"Gagal mensintesis profil perusahaan (OpenAI): {exc}"
        ) from exc


# ─── run_matching ─────────────────────────────────────────────────────────────

async def run_matching(
    profile: CompanyProfile,
    catalog: list[ProductCatalogItem],
) -> list[ProductMatch]:
    """
    Hitung relevance score setiap produk terhadap pain points perusahaan.

    Model: gpt-4o dengan JSON mode.
    Mengembalikan top 3-5 produk diurutkan dari matchScore tertinggi.

    Raises:
        RuntimeError jika API call atau parsing gagal.
    """
    pain_points_json = json.dumps(
        [
            {
                "index":    i,
                "category": p.category.value,
                "issue":    p.issue,
                "severity": p.severity.value,
            }
            for i, p in enumerate(profile.painPoints)
        ],
        ensure_ascii=False,
    )
    catalog_json = json.dumps(
        [
            {
                "id":             p.id,
                "name":           p.name,
                "tagline":        p.tagline,
                "description":    p.description,
                "painCategories": [c.value for c in p.painCategories],
                "usp":            p.usp,
            }
            for p in catalog
        ],
        ensure_ascii=False,
    )

    system_prompt = (
        "Kamu adalah AI yang menilai kesesuaian produk B2B dengan pain point perusahaan target. "
        "Scoring (0-100): 85+ sangat relevan, 70-84 relevan, <70 kurang relevan. "
        "isRecommended: true HANYA untuk 1 produk dengan matchScore tertinggi. "
        "Reasoning harus spesifik — referensikan nama perusahaan dan pain point konkret. "
        "Kembalikan JSON: {\"matches\": [...]} dengan top 3-5 produk, "
        "urut dari matchScore tertinggi. "
        "Setiap item: {productId, matchScore, addressedPainIndices, reasoning, isRecommended}."
    )
    user_prompt = (
        f"Perusahaan: {profile.name} ({profile.industry})\n\n"
        f"Pain Points:\n{pain_points_json}\n\n"
        f"Katalog Produk:\n{catalog_json}"
    )

    client = _get_client()
    try:
        logger.info("[openai] run_matching | model=%s products=%d", MODEL_MAIN, len(catalog))
        response = await client.chat.completions.create(
            model=MODEL_MAIN,
            max_tokens=2048,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
        )

        raw      = json.loads(response.choices[0].message.content or "{}")
        matches  = raw.get("matches", [])
        catalog_map = {p.id: p for p in catalog}

        result: list[ProductMatch] = []
        for m in matches:
            base = catalog_map.get(m.get("productId", ""))
            if base is None:
                logger.warning("[openai] run_matching | unknown productId=%r, skip", m.get("productId"))
                continue
            try:
                result.append(ProductMatch(
                    **base.model_dump(),
                    matchScore=m.get("matchScore", 0),
                    addressedPainIndices=m.get("addressedPainIndices", []),
                    reasoning=m.get("reasoning", ""),
                    isRecommended=m.get("isRecommended", False),
                ))
            except Exception as ve:
                logger.warning("[openai] run_matching ProductMatch validation error: %s", ve)

        result.sort(key=lambda x: x.matchScore, reverse=True)
        logger.info("[openai] run_matching OK | matches=%d", len(result))
        return result

    except Exception as exc:
        logger.error("[openai] run_matching FAILED | error=%s", exc)
        raise RuntimeError(f"AI matching gagal: {exc}") from exc


# ─── generate_campaign ────────────────────────────────────────────────────────

async def generate_campaign(
    profile: CompanyProfile,
    product: ProductCatalogItem,
) -> Campaign:
    """
    Generate 3-email outbound campaign sequence.

    Model: gpt-4o dengan JSON mode.
    isApproved selalu False (user harus approve manual di Polish).

    Raises:
        RuntimeError jika API call atau validasi gagal.
    """
    pain_summary = "; ".join(
        f"{p.category.value}: {p.issue}" for p in profile.painPoints[:3]
    )
    usp_summary = "; ".join(product.usp[:3])

    system_prompt = (
        "Kamu adalah copywriter B2B berpengalaman menulis email outreach Bahasa Indonesia. "
        "Struktur sequence: "
        "Email 1 (Hari 1) = ice-breaker + pain awareness, "
        "Email 2 (Hari 4) = pain-focused + social proof, "
        "Email 3 (Hari 10) = urgency/value close. "
        "Gunakan [Nama] sebagai placeholder penerima. "
        "isApproved selalu false. "
        'Kembalikan JSON persis: {"reasoning": "...", "targetCompany": "...", "emails": [...]}. '
        "Setiap email: {sequenceNumber, dayLabel, scheduledDay, subject, body, tone, isApproved}. "
        "tone valid: profesional | friendly | direct | storytelling."
    )
    user_prompt = (
        f"Perusahaan target: {profile.name} ({profile.industry}, {profile.hq})\n"
        f"Pain points utama: {pain_summary}\n\n"
        f"Produk yang dipitch: {product.name} — {product.tagline}\n"
        f"USP utama: {usp_summary}\n"
        f"Harga: {product.price}\n\n"
        "Buat 3-email sequence outbound B2B yang tajam dan personal."
    )

    client = _get_client()
    try:
        logger.info("[openai] generate_campaign | model=%s company=%r", MODEL_MAIN, profile.name)
        response = await client.chat.completions.create(
            model=MODEL_MAIN,
            max_tokens=3000,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
        )

        raw = json.loads(response.choices[0].message.content or "{}")

        # Paksa isApproved = False — tidak percaya output AI
        for email in raw.get("emails", []):
            email["isApproved"] = False

        campaign = Campaign.model_validate(raw)
        logger.info(
            "[openai] generate_campaign OK | company=%r emails=%d",
            profile.name, len(campaign.emails),
        )
        return campaign

    except Exception as exc:
        logger.error("[openai] generate_campaign FAILED | error=%s", exc)
        raise RuntimeError(f"Generate campaign gagal: {exc}") from exc
