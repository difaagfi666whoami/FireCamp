# Agent Prompt: Fix Synthesis Layer — openai_service.py
# Target: 110% Output Quality

> Baca seluruh dokumen ini sebelum menyentuh satu baris kode pun.
> Hanya ada SATU file yang diubah: `backend/app/services/openai_service.py`

---

## Diagnosis Masalah

Output Recon pipeline saat ini masih bermasalah meskipun Sprint 1-3 sudah selesai.
Root cause ada di fungsi `synthesize_profile()` dalam `openai_service.py`.

### Bug 1: Angka Statistik Hallucination
Output mengandung klaim seperti "36 kompetitor aktif, 13 mendapat pendanaan" —
angka ini diambil dari satu sumber (Tracxn competitor database) dan disajikan
seolah ground truth tentang perusahaan target. Ini berbahaya karena:
- DM bisa kutip angka ini ke klien dan ternyata tidak akurat
- Melanggar prinsip "hanya fakta yang bisa dibuktikan"

### Bug 2: Anomaly Section Kosong
Field `anomalies` tidak pernah diisi meskipun data menunjukkan inkonsistensi nyata.
Penyebab: instruksi anomaly detection terlalu pasif ("Isi HANYA jika ada pola...")
tanpa memberikan AI trigger spesifik apa yang harus dicari.

### Bug 3: Situational Summary Generik
Output: "Optimal window untuk sales approach adalah memperkuat penawaran..."
Ini bisa ditempel ke 500 perusahaan. Penyebab: template di prompt kurang paksa
AI untuk mengekstrak kondisi spesifik perusahaan tersebut.

### Bug 4: Framing Masih Salah
System prompt sudah benar di awal, tapi user_prompt berakhir dengan
"Sintesis seluruh data di atas menjadi profil perusahaan lengkap" —
framing "profil perusahaan" ini override instruksi "sales intelligence" di awal.

---

## Yang Harus Diubah

Hanya **satu fungsi** dalam satu file:
- File: `backend/app/services/openai_service.py`
- Fungsi: `synthesize_profile()`
- Perubahan: system_prompt, user_prompt, max_tokens

**JANGAN ubah fungsi lain dalam file ini.**
**JANGAN ubah file lain.**

---

## Perubahan Spesifik

### Perubahan 1: max_tokens

Ganti `max_tokens=6000` menjadi `max_tokens=8000`.

---

### Perubahan 2: Ganti Seluruh `system_prompt`

Temukan variabel `system_prompt` dalam fungsi `synthesize_profile`.
Ganti seluruh isinya dengan teks berikut (perhatikan setiap kata):

```python
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
    # ATURAN 6-10: CONTACTS, NEWS, LINKEDIN, METADATA, SITE PAGES
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
    "careers → [DIGITAL] (hiring signals) dan techStack. "
    "team → [IDENTITAS] (struktur organisasi). "
    "Jika field kosong ('') → abaikan.\n\n"

    "=== ATURAN 11 ===\n"
    "Jika data tidak tersedia, gunakan string kosong ''. JANGAN null."
)
```

---

### Perubahan 3: Ganti Seluruh `user_prompt`

Temukan variabel `user_prompt` dalam fungsi `synthesize_profile`.
Ganti seluruh isinya dengan teks berikut:

```python
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
```

---

## Cara Verifikasi Setelah Perubahan

Setelah edit selesai, lakukan dua hal:

### 1. Syntax check Python
```bash
cd /Users/difaagfi/Documents/Project/FireCamp
python -c "from backend.app.services.openai_service import synthesize_profile; print('OK')"
```

Atau:
```bash
cd backend && python -c "from app.services.openai_service import synthesize_profile; print('OK')"
```

### 2. Tidak perlu jalankan server atau generate ulang
Perubahan ini hanya mengubah prompt teks — tidak ada logic, tidak ada import baru.
Pastikan indentasi Python benar (tidak ada `IndentationError`).

---

## Yang TIDAK Boleh Diubah

- Jangan ubah signature fungsi `synthesize_profile`
- Jangan ubah logika inject news dan intent_signals (baris setelah `response = await client.beta...`)
- Jangan ubah `MODEL_MAIN`, `MODEL_MINI`, atau client factory
- Jangan ubah fungsi lain: `score_contacts`, `run_matching`, `generate_campaign`, dll
- Jangan ubah file lain selain `openai_service.py`

---

## Ekspektasi Output Setelah Fix

Setelah perubahan ini diapply dan recon dijalankan ulang untuk `indoinfo.co.id`,
output yang diharapkan:

```
strategicTitle:
"Indoinfo CyberQuote: Subsidiary 14-Tahun dalam Mode Stable
 dengan Credibility Gap di Era Digital"

situationalSummary:
"Indoinfo beroperasi dalam mode stable/maintenance — terbukti dari
 hanya 1 lowongan aktif di semua job board untuk 100-200 karyawan
 dan website halaman /about serta /product yang tidak dapat diakses.
 Mereka memiliki klien enterprise (Pertamina, Mandiri, Sampoerna) tapi
 tidak ada dokumentasi publik sama sekali.
 Entry point terbaik: Business Development Manager atau Country Manager
 karena keputusan strategis subsidiary ada di level ini.
 Window outreach: OPEN — tidak ada trigger hot, tapi pain kredibilitas
 digital sudah akut dan bisa di-approach kapan saja."

anomalies: [
  {
    title: "Database Claim Tidak Konsisten",
    observation: "Homepage menyebut '1 juta perusahaan' tapi
                  parent site cyberquote.com menyebut '2 juta perusahaan'
                  — dua sumber resmi, angka berbeda 2x lipat.",
    implication: "Inkonsistensi komunikasi antara entitas Indonesia dan
                  parent Singapura. Prospek yang due diligence akan menemukan
                  ini dan mempertanyakan kredibilitas data mereka sendiri.",
    evidenceUrl: "https://indoinfo.co.id"
  },
  {
    title: "Halaman Kritis Website 404",
    observation: "Halaman /about dan /product — dua halaman paling penting
                  untuk prospek B2B — tidak dapat diakses (404).",
    implication: "Website tidak mencerminkan skala dan kapabilitas real.
                  Digital front-end terabaikan secara sistematis.",
    evidenceUrl: ""
  }
]
```

---

*Selesai. Hanya edit `synthesize_profile()` di `openai_service.py`.*
*Dua variabel yang diganti: `system_prompt`, `user_prompt`.*
*Satu nilai yang diubah: `max_tokens` dari 6000 ke 8000.*
