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
from typing import Any, Literal

from openai import AsyncOpenAI
from pydantic import BaseModel

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


# ─── Pro Mode extraction models ───────────────────────────────────────────────

class ExtractedPainPoint(BaseModel):
    category:   Literal["Marketing", "Operations", "Technology", "Growth"]
    issue:      str
    severity:   Literal["high", "medium", "low"]
    matchAngle: str = ""

class ExtractedContact(BaseModel):
    name:        str
    title:       str
    email:       str = ""
    linkedin_url: str = ""
    reasoning:   str = ""

class ExtractedNews(BaseModel):
    title:   str
    date:    str = ""
    source:  str = ""
    summary: str = ""
    url:     str = ""

class ProModeExtraction(BaseModel):
    company_name: str
    painPoints:   list[ExtractedPainPoint]
    contacts:     list[ExtractedContact]
    news:         list[ExtractedNews]


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
    # [OVERRIDE INFO]: Selalu eksekusi prompt mendalam meskipun mode = free
    depth_instruction = (
        "Sintesis mendalam: sertakan angka spesifik, persentase, dan indikator "
        "finansial jika ditemukan dalam data."
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
    deep_site_pages: dict[str, Any] | None = None,
    company_enrichment: dict[str, Any] | None = None,
    intent_signals: list[dict[str, Any]] | None = None,
) -> tuple[CompanyProfile, int]:
    """
    Final synthesis: gabungkan output 7-Lane → CompanyProfile JSON
    ter-validasi Pydantic menggunakan OpenAI Structured Output.

    Model: gpt-4o dengan beta.chat.completions.parse(response_format=CompanyProfile).
    OpenAI menjamin output JSON selalu sesuai schema — tidak perlu regex/try-parse manual.

    Args:
        lane_a_summary:        Output distill_lane_a() (Lane A).
        scored_contacts:       Output score_and_enrich_contacts() (Lane B).
        company_url:           URL target (diinjeksikan ke output).
        mode:                  ReconMode — untuk label reconMode di profil.
        extracted_news:        Berita gabungan (Lane C + D + E) siap pakai.
        evidence_list:         List bukti fakta dari riset (Lane A).
        pain_signals_from_news:Sinyal pain bisnis dari berita (Lane C).
        deep_site_pages:       Output Lane F — about/products/clients/careers/team raw text.
        company_enrichment:    Output Lane G — Hunter ground truth metadata.

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
    site_pages_json = json.dumps(deep_site_pages or {}, ensure_ascii=False)
    enrichment_json = json.dumps(company_enrichment or {}, ensure_ascii=False)
    
    system_prompt = (
        # ════════════════════════════════════════════════════════════════
        # IDENTITAS & MISI
        # ════════════════════════════════════════════════════════════════
        "Kamu adalah intelligence analyst senior untuk tim sales B2B elite. "
        "MISI UTAMA: temukan informasi yang memungkinkan DM untuk approach "
        "perusahaan ini dengan akurasi tinggi — siapa yang dihubungi, "
        "apa pain-nya, dan kenapa timing-nya sekarang. "
        "Semua teks output dalam Bahasa Indonesia. "
        "\n\n"

        # ════════════════════════════════════════════════════════════════
        # ANTI-HALLUCINATION — BACA INI PERTAMA, PATUHI SETIAP SAAT
        # ════════════════════════════════════════════════════════════════
        "=== LARANGAN KERAS (TIDAK BOLEH DILANGGAR) ===\n"
        "1. JANGAN tulis angka statistik (jumlah kompetitor, market share, persentase "
        "   pertumbuhan, jumlah funding) KECUALI angka tersebut TERSURAT dalam data "
        "   yang diberikan DAN kamu bisa menyebut URL sumbernya.\n"
        "2. JANGAN gunakan frasa: 'banyak kompetitor', 'persaingan ketat', "
        "   'pasar yang berkembang', 'permintaan yang meningkat' — "
        "   ini adalah kalimat generik yang tidak bernilai bagi sales.\n"
        "3. JANGAN buat kesimpulan tentang kondisi industri secara umum. "
        "   Fokus HANYA pada kondisi spesifik perusahaan target.\n"
        "4. JANGAN inference. Jika tidak ada data → tulis string kosong, "
        "   jangan karang sesuatu yang terdengar masuk akal.\n"
        "5. URL di sourceUrl dan citations HARUS berasal dari evidence_list "
        "   yang disediakan. DILARANG membuat URL baru.\n"
        "6. JANGAN gunakan angka atau statistik dari Tracxn, Crunchbase, "
        "   CB Insights, ZoomInfo, atau competitor aggregator database "
        "   untuk membuat klaim tentang kondisi perusahaan target "
        "   (mis. jumlah kompetitor, market ranking, competitor count). "
        "   Data dari sumber ini mendeskripsikan isi database mereka, "
        "   bukan kondisi aktual pasar atau perusahaan. "
        "   Gunakan sumber ini HANYA untuk: tahun berdiri, nama founder, "
        "   atau deskripsi produk yang dikonfirmasi sumber lain juga.\n"
        "\n\n"

        # ════════════════════════════════════════════════════════════════
        # ATURAN 1: STRATEGIC REPORT
        # ════════════════════════════════════════════════════════════════
        "=== ATURAN 1: STRATEGIC REPORT ===\n\n"

        "a) strategicTitle:\n"
        "   Format WAJIB: '[Nama Perusahaan]: [Kondisi Spesifik] di Tengah [Konteks Aktual]'\n"
        "   HARUS spesifik ke perusahaan ini — tidak boleh berlaku untuk perusahaan lain.\n"
        "   Contoh BAGUS: 'Indoinfo CyberQuote: Subsidiary 14-Tahun dalam Mode Stagnan "
        "   di Tengah Pasar Data Bisnis yang Underserved'\n"
        "   Contoh BURUK: 'Tekanan Kepatuhan di Tengah Dinamika Kompetitif' "
        "   (terlalu generic, bisa untuk siapapun)\n"
        "   Plain text, tanpa Markdown.\n\n"

        "b) executiveInsight:\n"
        "   2-3 kalimat verdict analis senior. HARUS menjawab: "
        "   'Apa yang paling penting yang perlu diketahui DM tentang perusahaan ini?'\n"
        "   HARUS ada setidaknya SATU fakta spesifik (angka, nama, tanggal, atau kejadian nyata).\n"
        "   JANGAN mulai dengan 'Perusahaan ini adalah...' atau 'X merupakan...'\n"
        "   Plain text, tanpa Markdown.\n\n"

        "c) internalCapabilities:\n"
        "   Format Markdown: heading ## + bullets (-).\n"
        "   Sub-topik: ## Produk & Layanan, ## Infrastruktur & Skala, ## Klien Terverifikasi.\n"
        "   Setiap bullet: fakta spesifik + [Sumber](url) jika ada di evidence_list.\n"
        "   JANGAN paragraf panjang. HARUS heading + bullets.\n\n"

        "d) marketDynamics:\n"
        "   Format Markdown: heading ## + bullets (-).\n"
        "   Sub-topik HANYA yang ada datanya: ## Posisi Pasar, ## Tekanan Aktual, "
        "   ## Peluang yang Teridentifikasi.\n"
        "   JANGAN tulis sub-topik jika tidak ada data spesifik untuk mengisinya.\n"
        "   JANGAN tulis 'persaingan ketat' atau 'pasar berkembang' tanpa bukti.\n\n"

        "e) strategicRoadmap:\n"
        "   Array 3-5 string. Setiap item dimulai dengan 'Prioritaskan'.\n"
        "   HARUS berdasarkan gap atau masalah spesifik yang ditemukan dalam data.\n"
        "   JANGAN sarankan sesuatu yang tidak ada buktinya dalam data (contoh: "
        "   jangan rekomendasikan 'pengembangan ML' jika tidak ada data tentang ini).\n\n"

        "f) situationalSummary — PALING PENTING:\n"
        "   3-4 kalimat briefing untuk Sales Manager. "
        "   HARUS menjawab SEMUA dari:\n"
        "   - Status mode perusahaan: growth / stable / declining / post-funding / restrukturisasi?\n"
        "   - Bukti konkret status tersebut (dari data hiring, news, atau anomali yang ditemukan)\n"
        "   - Siapa entry point terbaik dan mengapa\n"
        "   - Window: HOT (action dalam 14 hari) / WARM (30-60 hari) / OPEN (kapan saja)\n"
        "   TEMPLATE: '[Perusahaan] saat ini dalam mode [STATUS] — terbukti dari [BUKTI SPESIFIK]. "
        "   [Fakta tambahan yang relevan]. Entry point terbaik: [JABATAN] karena [ALASAN]. "
        "   Window outreach: [HOT/WARM/OPEN] — [ALASAN TIMING].'\n"
        "   Plain text, tanpa Markdown.\n\n"

        "g) citations:\n"
        "   Array {url, title, source, date}.\n"
        "   HANYA URL dari evidence_list yang kamu BENAR-BENAR gunakan untuk mendukung klaim.\n"
        "   Minimal 2, maksimal 6. Jangan duplikasi URL.\n\n"

        # ════════════════════════════════════════════════════════════════
        # ATURAN 2: DESCRIPTION
        # ════════════════════════════════════════════════════════════════
        "=== ATURAN 2: DESCRIPTION ===\n"
        "5-7 kalimat. Harus mencakup: identitas perusahaan + parent/group, "
        "model bisnis, klien utama yang terverifikasi, dan posisi di pasar Indonesia. "
        "Sales rep harus bisa memahami perusahaan ini dari description tanpa riset tambahan.\n\n"

        # ════════════════════════════════════════════════════════════════
        # ATURAN 3: DEEP INSIGHTS
        # ════════════════════════════════════════════════════════════════
        "=== ATURAN 3: DEEP INSIGHTS ===\n"
        "Array PERSIS 5 string dengan prefix label:\n"
        "[IDENTITAS]: tahun berdiri, HQ, parent company/group, jumlah karyawan, status subsidiary.\n"
        "[PRODUK]: daftar produk/layanan konkret, fitur unggulan, target segmen.\n"
        "[DIGITAL]: kualitas website, social media presence, hiring signals dari job posting, "
        "tech stack jika terdeteksi, freshness konten (kapan terakhir update?).\n"
        "[POSISI PASAR]: klien besar terverifikasi, segmen yang dilayani, "
        "kelebihan kompetitif yang nyata (bukan klaim sendiri).\n"
        "[VULNERABILITIES]: kelemahan konkret yang teridentifikasi dari data — "
        "bukan opini, tapi fakta yang bisa dikutip. "
        "Ini adalah entry point untuk sales pitch.\n"
        "Setiap item: 2-4 kalimat dengan fakta spesifik. BUKAN 1 kalimat pendek.\n\n"

        # ════════════════════════════════════════════════════════════════
        # ATURAN 4: PAIN POINTS
        # ════════════════════════════════════════════════════════════════
        "=== ATURAN 4: PAIN POINTS ===\n"
        "4-5 pain points. SETIAP pain point HARUS:\n"
        "- Bisa dibuktikan dari data (ada URL sumbernya)\n"
        "- Relevan untuk sales approach B2B (masalah bisnis yang bisa di-solve vendor)\n"
        "- Spesifik ke perusahaan ini (tidak bisa copy-paste ke perusahaan lain)\n\n"
        "Field wajib per pain point:\n"
        "- issue: kalimat lengkap dengan konteks spesifik (bukan generic)\n"
        "- severity: high jika ada bukti langsung, medium jika inference dari data, "
        "  low jika tidak ada URL\n"
        "- sourceUrl: URL dari evidence_list atau pain_signals. "
        "  KOSONGKAN ('')  jika tidak ada URL yang relevan — JANGAN karang URL.\n"
        "- sourceTitle: judul artikel/halaman sumber\n"
        "- matchAngle: 1 kalimat sales framing. TEMPLATE: "
        "  'Approach dengan [TIPE SOLUSI SPESIFIK] untuk [OUTCOME YANG MEREKA BUTUHKAN].'\n"
        "  CONTOH BAGUS: 'Approach dengan audit digital presence untuk membantu mereka "
        "  mendokumentasikan case study enterprise yang sudah ada.'\n"
        "  CONTOH BURUK: 'Approach dengan produk baru untuk meningkatkan daya saing.' "
        "  (terlalu generic)\n\n"
        "DILARANG: keluhan karyawan, rating Glassdoor, budaya kerja.\n"
        "DILARANG: pain point yang sama sekali tidak ada buktinya.\n\n"

        # ════════════════════════════════════════════════════════════════
        # ATURAN 5: ANOMALY DETECTION — KRITIS
        # ════════════════════════════════════════════════════════════════
        "=== ATURAN 5: ANOMALY DETECTION (field 'anomalies') ===\n\n"
        "Ini adalah bagian yang PALING MEMBEDAKAN output kita dari tools lain. "
        "AI biasa hanya mendeskripsikan — kamu harus menemukan yang tidak normal.\n\n"
        "WAJIB cek 6 trigger anomali berikut secara aktif:\n\n"
        "TRIGGER 1 — DATA INCONSISTENCY:\n"
        "  Apakah ada angka/fakta yang berbeda antara dua sumber berbeda tentang "
        "  perusahaan yang sama? (contoh: homepage vs parent site, LinkedIn vs Hunter)\n"
        "  Jika ya → tulis anomali dengan kedua evidence.\n\n"
        "TRIGGER 2 — HIRING FREEZE SIGNAL:\n"
        "  Apakah perusahaan punya 50+ karyawan tapi hiring sangat sedikit atau nol? "
        "  Cek data Lane D (hiring signals). Jika ada mismatch → tulis anomali.\n\n"
        "TRIGGER 3 — BROKEN DIGITAL PRESENCE:\n"
        "  Apakah halaman penting website (about, product, services, team) tidak bisa diakses "
        "  atau kosong? Data ini ada di deep_site_pages (Lane F). "
        "  Jika halaman kritis kosong/404 → tulis anomali.\n\n"
        "TRIGGER 4 — CREDIBILITY GAP:\n"
        "  Apakah perusahaan klaim punya klien besar tapi tidak ada satu pun case study, "
        "  testimonial, atau dokumentasi publik? "
        "  Jika klien enterprise ada tapi zero proof → tulis anomali.\n\n"
        "TRIGGER 5 — CONTENT FRESHNESS GAP:\n"
        "  Apakah blog, press release, atau konten website terakhir diupdate lebih dari "
        "  6 bulan lalu? Atau tidak ada sama sekali? "
        "  Ini sinyal digital presence yang stagnan → tulis anomali.\n\n"
        "TRIGGER 6 — SCALE VS ACTIVITY MISMATCH:\n"
        "  Apakah skala yang diklaim (karyawan, klien, tahun berdiri) tidak konsisten "
        "  dengan aktivitas yang terdeteksi (followers, hiring, news coverage)? "
        "  Jika mismatch signifikan → tulis anomali.\n\n"
        "FORMAT per anomali:\n"
        "- title: nama anomali singkat (max 8 kata)\n"
        "- observation: apa yang ditemukan, dengan fakta spesifik dari data\n"
        "- implication: apa artinya untuk sales approach\n"
        "- evidenceUrl: URL sumber dari evidence_list (kosongkan jika tidak ada)\n\n"
        "PENTING: Jika setelah cek 6 trigger di atas tidak ada anomali yang bisa dibuktikan "
        "dari data yang tersedia → isi anomalies dengan array kosong [].\n"
        "JANGAN karang anomali yang tidak ada buktinya.\n\n"

        # ════════════════════════════════════════════════════════════════
        # ATURAN 6-11: CONTACTS, NEWS, LINKEDIN, METADATA, SITE PAGES
        # ════════════════════════════════════════════════════════════════
        "=== ATURAN 6: CONTACTS ===\n"
        "Salin UTUH 1:1 seluruh data kontak dari input Lane B tanpa filter atau modifikasi. "
        "Field email, location, connections, roleDuration, about HARUS disalin persis.\n\n"

        "=== ATURAN 7: NEWS & INTENT SIGNALS ===\n"
        "Field news = [] dan intentSignals = []. Keduanya akan di-inject secara deterministik.\n\n"

        "=== ATURAN 8: LINKEDIN ===\n"
        "Ambil dari LINKEDIN_STATS. Konversi karyawan ke integer murni.\n\n"

        "=== ATURAN 9: METADATA (Lane G — Hunter) ===\n"
        "COMPANY_ENRICHMENT adalah ground truth. Prioritaskan untuk: "
        "name, industry, size, founded, hq, linkedin. "
        "Selipkan technologies ke deepInsights [DIGITAL].\n\n"

        "=== ATURAN 10: DEEP SITE PAGES (Lane F) ===\n"
        "about → description dan [IDENTITAS]. "
        "products → [PRODUK] dan internalCapabilities. "
        "clients → [POSISI PASAR] (social proof). "
        "careers → [DIGITAL] (hiring signals). "
        "team → [IDENTITAS] (struktur organisasi). "
        "Jika field kosong ('') → abaikan.\n\n"

        "=== ATURAN 11 ===\n"
        "Jika data tidak tersedia, gunakan string kosong ''. JANGAN null."
    )
    user_prompt = (
        f"URL perusahaan target: {company_url}\n\n"

        "=== DATA RISET LANE A (Company Profiling) ===\n"
        f"{lane_a_summary}\n\n"

        "=== EVIDENCE DENGAN URL CITATION ===\n"
        "PENTING: Ini adalah fakta dengan URL terverifikasi. "
        "GUNAKAN URL dari sini untuk mengisi sourceUrl di painPoints dan citations. "
        "JANGAN gunakan URL yang tidak ada di sini.\n"
        f"{evidence_json}\n\n"

        "=== KONTAK PIC (Lane B) ===\n"
        "Salin 1:1 ke field contacts tanpa modifikasi.\n"
        f"{contacts_json}\n\n"

        "=== PAIN SIGNALS DARI BERITA (Lane C) ===\n"
        "Implikasi bisnis dari berita. Gunakan untuk memperkuat painPoints.\n"
        f"{news_signals_json}\n\n"

        "=== BERITA GABUNGAN (Lane C+D+E — context only) ===\n"
        f"{news_json}\n\n"

        "=== DEEP SITE PAGES (Lane F) ===\n"
        "Konten halaman website: about / products / clients / careers / team.\n"
        "PERHATIKAN: jika halaman ini kosong atau sangat pendek → ini adalah ANOMALI "
        "(Trigger 3: Broken Digital Presence). Catat dan masukkan ke anomalies.\n"
        f"{site_pages_json}\n\n"

        "=== COMPANY ENRICHMENT (Lane G — Hunter) ===\n"
        "Ground truth metadata. Prioritaskan untuk name/industry/size/founded/hq/linkedin.\n"
        f"{enrichment_json}\n\n"

        "─────────────────────────────────────────────────────────\n"
        "SEBELUM MENULIS OUTPUT, lakukan 6 ANOMALY CHECKS ini secara eksplisit:\n\n"
        "CHECK 1: Apakah ada angka/fakta berbeda antara dua sumber yang berbeda?\n"
        "CHECK 2: Apakah ukuran perusahaan tidak sesuai dengan aktivitas hiring?\n"
        "CHECK 3: Apakah halaman website kritis (about/product/team) kosong atau tidak dapat diakses?\n"
        "CHECK 4: Apakah ada klaim klien besar tanpa case study atau testimonial publik?\n"
        "CHECK 5: Apakah konten website terakhir diupdate lebih dari 6 bulan lalu?\n"
        "CHECK 6: Apakah skala perusahaan tidak konsisten dengan aktivitas yang terdeteksi?\n\n"
        "Untuk setiap check yang hasilnya YA dan ada bukti dari data → "
        "masukkan ke field anomalies.\n"
        "─────────────────────────────────────────────────────────\n\n"

        "Sekarang buat LAPORAN INTELIJEN SALES (bukan profil perusahaan) berdasarkan "
        "seluruh data di atas.\n\n"

        "PANDUAN PENGISIAN FIELD UTAMA:\n"
        "deepInsights:\n"
        "- Item 1: '[IDENTITAS] ...'\n"
        "- Item 2: '[PRODUK] ...'\n"
        "- Item 3: '[DIGITAL] ...'\n"
        "- Item 4: '[POSISI PASAR] ...'\n"
        "- Item 5: '[VULNERABILITIES] ...'\n\n"
        "strategicReport — ISI SEMUA SUB-FIELD:\n"
        "- strategicTitle: kondisi spesifik perusahaan ini (bukan generic)\n"
        "- executiveInsight: verdict 2-3 kalimat dengan minimal 1 fakta spesifik\n"
        "- internalCapabilities: Markdown heading + bullets + citations inline\n"
        "- marketDynamics: Markdown heading + bullets (JANGAN angka tanpa bukti)\n"
        "- strategicRoadmap: array 3-5 item dimulai 'Prioritaskan'\n"
        "- situationalSummary: [STATUS] + [BUKTI] + [ENTRY POINT] + [WINDOW]\n"
        "- citations: array URL dari evidence_list yang benar-benar dipakai\n\n"
        "contacts: salin SEMUA field dari Lane B verbatim."
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
            max_tokens=8000,
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
                        signal_type=n.get("signal_type") or None,
                    ))
                except Exception:
                    pass  # skip malformed news item
            if injected_news:
                object.__setattr__(profile, "news", injected_news)
                logger.info(
                    "[openai] synthesize_profile | injected %d news (Lane C+D+E)",
                    len(injected_news),
                )

        if intent_signals:
            from app.models.schemas import IntentSignal
            injected_intent: list[IntentSignal] = []
            for i_sig in intent_signals:
                try:
                    injected_intent.append(IntentSignal(
                        title=          i_sig.get("title", ""),
                        date=           i_sig.get("date", ""),
                        source=         i_sig.get("source", ""),
                        summary=        i_sig.get("summary", ""),
                        url=            i_sig.get("url", ""),
                        signal_type=    i_sig.get("signal_type") or "signal",
                        verifiedAmount= i_sig.get("verifiedAmount"),
                        verifiedDate=   i_sig.get("verifiedDate"),
                    ))
                except Exception:
                    pass
            if injected_intent:
                object.__setattr__(profile, "intentSignals", injected_intent)
                logger.info("[openai] synthesize_profile | injected %d intentSignals", len(injected_intent))

        tokens_used = response.usage.total_tokens if response.usage else 0
        logger.info(
            "[openai] synthesize_profile OK | company=%r tokens=%d news=%d",
            profile.name,
            tokens_used,
            len(profile.news),
        )
        return profile, tokens_used

    except Exception as exc:
        logger.error("[openai] synthesize_profile FAILED | error=%s", exc)
        raise RuntimeError(
            f"Gagal mensintesis profil perusahaan (OpenAI): {exc}"
        ) from exc


# ─── score_and_enrich_contacts (Hybrid: AI scoring + Hunter REST) ────────────

def _normalize_name(name: str) -> str:
    """Lowercase + strip non-alphanumeric untuk fuzzy match."""
    import re as _re
    return _re.sub(r"[^a-z0-9]", "", name.lower())


async def score_and_enrich_contacts(
    contacts_raw: list[dict[str, Any]],
    company_context: str,
    domain: str,
    *,
    company_name: str = "",
) -> list[dict[str, Any]]:
    """
    Hybrid email enrichment pipeline:
      Step 1  Score semua kontak via OpenAI (cheap, deterministic).
      Step 2  Bulk Hunter domain_search (1 credit, ambil semua email domain).
      Step 3  Match kontak dengan domain results berdasarkan nama (no extra credit).
      Step 4  Untuk kontak yang belum ada match, fallback Hunter email_finder per kontak.

    Strategy ini lebih reliable & efisien dari MCP karena:
      - Predictable: kita kontrol setiap call ke Hunter
      - Cheap: 1 domain_search bisa cover semua kontak relevan
      - Observable: setiap step di-log
      - Resilient: graceful fallback per layer

    Args:
        contacts_raw:    List kontak mentah dari Serper.
        company_context: Deskripsi singkat perusahaan.
        domain:          Domain perusahaan (e.g. "indoinfo.co.id").
        company_name:    Nama perusahaan untuk validasi relevansi.

    Returns:
        List kontak yang sudah di-score dan email-enriched (semua kontak, score 0-100).
    """
    if not contacts_raw:
        return []

    # ── Step 1: AI Scoring ───────────────────────────────────────────────────
    scored = await score_contacts(contacts_raw, company_context, company_name=company_name)

    # ── Step 2 & 3 & 4: Hunter enrichment hanya jika ada kunci ──────────────
    if not settings.HUNTER_API_KEY:
        logger.warning("[hybrid] HUNTER_API_KEY tidak ada — skip enrichment")
        return scored

    # Hanya enrich kontak yang lulus filter score (>= 55) supaya hemat credit
    qualified = [c for c in scored if c.get("prospectScore", 0) >= 55]
    if not qualified:
        logger.info("[hybrid] tidak ada kontak qualified (score >= 55) — skip Hunter")
        return scored

    logger.info(
        "[hybrid] START enrichment | qualified=%d/%d domain=%s",
        len(qualified), len(scored), domain,
    )

    # ── Step 2: Bulk domain_search (1 credit) ────────────────────────────────
    from app.services.external_apis import hunter_domain_search, find_email_hunter
    domain_emails = await hunter_domain_search(domain, limit=50)

    # Build lookup map: normalized_full_name → email_record
    domain_map: dict[str, dict[str, Any]] = {}
    for rec in domain_emails:
        first = (rec.get("first_name") or "").strip()
        last  = (rec.get("last_name") or "").strip()
        if not first and not last:
            continue
        full_norm = _normalize_name(f"{first} {last}")
        if full_norm:
            domain_map[full_norm] = rec
            # Juga simpan first-only sebagai fallback
            if first:
                domain_map.setdefault(_normalize_name(first), rec)

    matched_via_domain = 0
    needs_finder: list[dict[str, Any]] = []

    # ── Step 3: Match by name dari domain_search ─────────────────────────────
    for c in qualified:
        contact_norm = _normalize_name(c.get("name", ""))
        if not contact_norm:
            continue
        # Try exact full-name match dulu, lalu first-name
        rec = domain_map.get(contact_norm)
        if not rec:
            first_only = contact_norm[:6]  # heuristic prefix match
            for key, val in domain_map.items():
                if key.startswith(first_only) and len(key) >= 4:
                    rec = val
                    break
        if rec and rec.get("value"):
            c["email"] = rec["value"]
            matched_via_domain += 1
        else:
            needs_finder.append(c)

    logger.info(
        "[hybrid] domain_search match | matched=%d need_finder=%d",
        matched_via_domain, len(needs_finder),
    )

    # ── Step 4: Per-contact email_finder fallback ────────────────────────────
    if needs_finder:
        async def _enrich(contact: dict[str, Any]) -> None:
            parts = contact.get("name", "").split(maxsplit=1)
            first = parts[0] if parts else ""
            last  = parts[1] if len(parts) > 1 else ""
            if first and last:
                email = await find_email_hunter(first, last, domain)
                if email:
                    contact["email"] = email

        import asyncio as _asyncio
        await _asyncio.gather(*[_enrich(c) for c in needs_finder])

    total_emails = sum(1 for c in scored if c.get("email"))
    logger.info(
        "[hybrid] DONE | scored=%d emails_found=%d (domain=%d, finder=%d)",
        len(scored), total_emails, matched_via_domain, total_emails - matched_via_domain,
    )
    return scored


# ─── run_matching ─────────────────────────────────────────────────────────────

async def run_matching(
    profile: CompanyProfile,
    catalog: list[ProductCatalogItem],
) -> tuple[list[ProductMatch], int]:
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
        tokens_used = response.usage.total_tokens if response.usage else 0
        logger.info("[openai] run_matching OK | matches=%d tokens=%d", len(result), tokens_used)
        return result, tokens_used

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


# ─── extract_from_tavily_report ───────────────────────────────────────────────

async def extract_from_tavily_report(
    report: str,
    company_name: str,
) -> ProModeExtraction:
    """
    Extract structured pain_points, contacts, news from Tavily markdown report.
    Uses gpt-4o-mini with structured output for speed and cost efficiency.
    """
    system_prompt = (
        "Kamu adalah analis sales intelligence. "
        "Ekstrak data terstruktur dari laporan riset perusahaan berikut. "
        "Fokus pada informasi yang actionable untuk tim sales B2B.\n\n"
        "Aturan:\n"
        "- company_name: nama merek/perusahaan yang bersih dan singkat (1-5 kata). "
        "  JANGAN gunakan kata-kata dari judul laporan seperti 'Profil', 'Laporan', 'Analisis', "
        "  'Lengkap', 'Mendalam'. Contoh BENAR: 'Javaplas Pack'. "
        "  Contoh SALAH: 'Profil Lengkap Javaplas Pack Indonesia'. "
        "  Jika tidak bisa menentukan, gunakan nama yang diberikan sebagai konteks.\n"
        "- painPoints: 3-5 pain point yang paling relevan. "
        "  matchAngle: satu kalimat tentang cara menawarkan solusi.\n"
        "- contacts: maksimal 3 kontak yang disebutkan (nama, jabatan, email/LinkedIn jika ada).\n"
        "- news: 3-5 berita atau perkembangan terbaru yang relevan untuk sales.\n"
        "- Jika informasi tidak tersedia, kembalikan array kosong."
    )
    user_prompt = f"Perusahaan: {company_name}\n\nLaporan:\n{report[:12000]}"

    client = _get_client()
    try:
        logger.info("[openai] extract_from_tavily_report | company=%r", company_name[:40])
        response = await client.beta.chat.completions.parse(
            model=MODEL_MINI,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            response_format=ProModeExtraction,
            max_tokens=2000,
            temperature=0.2,
        )
        result = response.choices[0].message.parsed
        if result is None:
            return ProModeExtraction(company_name=company_name, painPoints=[], contacts=[], news=[])
        logger.info(
            "[openai] extract_from_tavily_report OK | painPoints=%d contacts=%d news=%d",
            len(result.painPoints), len(result.contacts), len(result.news),
        )
        return result
    except Exception as exc:
        logger.warning("[openai] extract_from_tavily_report FAILED: %s", exc)
        return ProModeExtraction(company_name=company_name, painPoints=[], contacts=[], news=[])
