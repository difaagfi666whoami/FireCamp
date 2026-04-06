# specs.md — Product Specifications

> Source of truth untuk semua fitur **Campfire**.
> Setiap fitur yang tidak ada di dokumen ini tidak boleh dibangun tanpa persetujuan eksplisit.

---

## Informasi Produk

| Atribut | Detail |
|---|---|
| Nama | Campfire |
| Tagline | Research. Match. Send. |
| Versi Target | v1.0.0 (internal demo) |
| Target User | Digital Marketer B2B, Sales Team |
| Platform | Web App (desktop-first, minimum 1280px) |
| Bahasa | Bahasa Indonesia |

---

## Halaman Utama — Research Library

### Tujuan
Halaman pertama setelah login. Berisi semua profil perusahaan yang pernah di-riset dan disimpan.

### Tampilan

**Header:**
- Judul: "Research Library"
- Subjudul: "Semua riset perusahaan tersimpan di satu tempat"
- Tombol **[+ Recon Baru]** → navigasi ke `/recon`

**Grid Kartu Profil (2 kolom):**
Setiap kartu menampilkan:
- Nama perusahaan
- Industri · Lokasi
- Tanggal disimpan
- Badge: jumlah pain points ("4 pain points")
- Badge mode riset: "Free" atau "Pro ✦"
- Progress: `Recon ✓ → Match ✓ → Craft ○ → Polish ○ → Launch ○ → Pulse ○`
- Tombol **[Lanjutkan Campaign]** dan **[Lihat Profil]**

**Empty State:**
```
Belum ada riset tersimpan.
Mulai dengan melakukan Recon terhadap target perusahaan pertama kamu.
[+ Recon Baru]
```

---

## Recon — Company Profiling

### Tujuan
User memasukkan URL target company dan memilih mode riset. Sistem generate profil lengkap berbasis riset nyata.

### Input
| Field | Type | Validasi |
|---|---|---|
| Company URL | text input | Format URL valid, tidak boleh kosong |
| Recon Mode | toggle (Free / Pro) | Default: Free |

### Mode Selector UI
```
┌──────────────────────────────────────────────┐
│  Pilih mode riset:                           │
│                                              │
│  [  Free  ]  [  Pro ✦  ]                    │
│                                              │
│  Free: Hasil solid, cepat, hemat kredit      │
│  Pro:  Deep research agentic, lebih dalam,   │
│        konsumsi kredit lebih banyak          │
└──────────────────────────────────────────────┘
```

---

### Free Mode

**Kapan dipakai:** Eksplorasi awal, riset cepat, atau ketika target perusahaan tidak membutuhkan analisis sangat mendalam.

**Proses Loading (5 steps, ~8–15 detik):**
```
Step 1: "Membaca website perusahaan..."
Step 2: "Menjalankan riset multi-sudut..."
Step 3: "Mencari berita & sinyal bisnis..."
Step 4: "Menganalisis kontak dan pain points..."
Step 5: "Menyusun profil final..."
```

**Sumber data yang digunakan:**
- Tavily `/extract` (homepage + deteksi sub-pages)
- Tavily `/search` (6 query per QueryAngle taxonomy)
- Serper.dev (LinkedIn dorking — Tier 1 saja)
- Serper.dev `/news` (multi-strategy fallback)
- Jina Reader (1-2 artikel teratas)
- GPT-4o-mini (gap analysis, query generation, distillation, contact scoring)
- GPT-4o (final synthesis via Structured Output)

**Output yang ditampilkan:**
- Company Header Card (nama, industri, lokasi, badges)
- Company Overview: paragraf 5-8 kalimat mendalam (bukan ringkasan generik)
- Deep Insights: 5 item terstruktur dengan prefix label [IDENTITAS][PRODUK][DIGITAL][POSISI PASAR][VULNERABILITIES]
- Pain Points: 3-4 item dengan severity, setiap item memiliki `sourceUrl` (citation klikabel) dan `sourceTitle`
- Recent News: 3-4 artikel dengan summary, tanggal, sumber, dan link citation klikabel
- Key Contacts PIC: 1-3 kontak dengan prospectScore dan reasoning outreach brief
- Badge "Free" di header profil

**Tidak ada di Free:**
- Recursive gap-filling research (hanya 1 pass)
- Sub-page scraping (/blog, /case-study, /team)
- Cross-validation pain point citation
- Confidence scoring per field

---

### Pro Mode ✦

**Kapan dipakai:** Demo ke client, riset sebelum campaign penting, target perusahaan yang membutuhkan kedalaman enterprise-grade.

**Proses Loading (8 steps, ~35–60 detik):**
```
Step 1: "Membaca website perusahaan secara mendalam..."
Step 2: "Menjalankan riset multi-sudut (6 angle)..."
Step 3: "Mengevaluasi celah informasi & menentukan riset lanjutan..."
Step 4: "Menjalankan riset tambahan untuk area yang belum terjawab..."
Step 5: "Mencari dan memverifikasi kontak PIC (3 tier)..."
Step 6: "Menganalisis sinyal berita & implikasinya..."
Step 7: "Cross-checking & validasi setiap citation pain point..."
Step 8: "Menyusun profil final dengan analisis mendalam..."
```

**Sumber data yang digunakan:**
- Semua yang ada di Free, ditambah:
- Tavily `/extract` pada sub-pages (/about, /team, /blog, /case-study, /resources)
- Serper.dev (LinkedIn dorking — 3 tier: C-suite + Director + Manager)
- Serper.dev (3 contextual signal queries: regulatory, competitive, tech)
- GPT-4o Confidence Evaluation (recursive gap-filling, max 2 iterasi)
- GPT-4o Cross-Validation (eliminasi hallusinasi citation)

**Output tambahan vs Free:**
- Deep Insights: 7 item (5 standar + [KOMPETITOR] + [TECH ASSESSMENT])
- Pain Points: 4-5 item, SEMUA harus ada `sourceUrl` yang valid (cross-validated)
- News: 4-6 artikel, dengan badge `signal_type` (Regulasi / Kompetitor / Tech Shift)
- Key Contacts PIC: 2-3 kontak, reasoning lebih detail (4 komponen outreach brief)
- Badge "Pro ✦" di header profil

---

### Output Layout (sama untuk Free dan Pro)

```
┌─────────────────────────────────────────────────────────┐
│  COMPANY HEADER CARD (full width)                        │
│  Nama · URL · Industri | Badges | [Free] atau [Pro ✦]   │
└─────────────────────────────────────────────────────────┘
┌──────────────────────────┐  ┌──────────────────────────┐
│  KOLOM KIRI              │  │  KOLOM KANAN             │
│                          │  │                          │
│  [Company Overview]      │  │  [Key Contacts PIC]      │
│  paragraf 5-8 kalimat    │  │  1–3 kontak PIC          │
│                          │  │                          │
│  [Deep Insights]         │  │  [Recent News]           │
│  5-7 item terstruktur    │  │  3-6 artikel + links     │
│                          │  │                          │
│  [Pain Points]           │  │                          │
│  3-5 pain point cards    │  │                          │
│  dengan severity +       │  │                          │
│  citation link           │  │                          │
└──────────────────────────┘  └──────────────────────────┘
```

### Output — Key Contacts PIC

Setiap kontak menampilkan:
| Field | Free | Pro |
|---|---|---|
| Nama lengkap | ✓ | ✓ |
| Jabatan | ✓ | ✓ |
| LinkedIn URL | ✓ (jika ada) | ✓ |
| Email | Dari web search (mungkin kosong) | Dari web search (mungkin kosong) |
| Prospect Score | ✓ (jika >= 55) | ✓ (jika >= 55) |
| Reasoning — Mandate | ✓ (singkat) | ✓ (lengkap) |
| Reasoning — Pain Ownership | ✓ | ✓ |
| Reasoning — Hook | ✓ | ✓ |
| Reasoning — Recency Signal | Tidak ada | ✓ |
| Source badge | "via LinkedIn" | "via LinkedIn" |

**Prospect Score:**
- 80–100: badge hijau (decision maker utama — C-suite, VP, Director)
- 55–79: badge kuning (influencer / champion)
- < 55: kontak tidak ditampilkan di UI

**Reasoning Format (wajib 4 komponen):**
```
[MANDATE] {apa yang sedang dikerjakan orang ini Q saat ini}
[PAIN OWNERSHIP] {kategori pain yang dia miliki secara struktural}
[HOOK] {opening conversation yang tepat — spesifik, tidak generik}
[RECENCY] {sinyal bahwa orang ini masih bekerja di sana saat ini}
```

### Output — Pain Points

Setiap pain point menampilkan:
| Field | Keterangan |
|---|---|
| Kategori | Marketing / Operations / Technology / Growth — badge warna |
| Issue | Kalimat lengkap dengan konteks spesifik (bukan bullet pendek) |
| Severity | high / medium / low — menentukan warna card |
| Source Citation | Link klikabel ke artikel/halaman sumber (`sourceUrl`) |
| Source Title | Judul halaman sumber (`sourceTitle`) |

**Aturan citation:**
- Jika `sourceUrl` tidak kosong: tampilkan sebagai `CitationLink` di bawah issue text
- Jika `sourceUrl` kosong: tampilkan tanda "(tidak ada sumber)" dalam warna muted, dan severity paksa ke "low"
- Tidak boleh tampilkan URL yang terlihat seperti hallusinasi (cek apakah domain valid)

### Output — Recent News

Setiap news item:
| Field | Keterangan |
|---|---|
| Judul | Bold, 1 baris |
| signal_type badge | Hanya tampil jika bukan "direct" — badge abu-abu kecil: "Regulasi" / "Kompetitor" / "Tech Shift" |
| Sumber · Tanggal | Muted text |
| Summary | 2-4 kalimat — diambil dari Jina Reader (artikel teratas) atau Serper snippet |
| Link citation | Wajib klikabel, buka tab baru |

### Aksi Tersedia
- **[Export PDF]** — toast "PDF sedang disiapkan..."
- **[Simpan ke Database]** → redirect ke `/research-library` dengan toast sukses
- **[Lanjut ke Match →]** → navigasi ke `/match`

---

## Match — Product Matching

### Layout — Dua Tab
```
[  Matching  ]  [  Katalog Produk  ]
```

### Tab 1: Matching

**Proses Loading (5 steps):**
```
Step 1: "Memuat pain points dari database..."
Step 2: "Memuat product catalog & embeddings..."
Step 3: "Menjalankan semantic similarity matching..."
Step 4: "Menghitung relevance score per produk..."
Step 5: "Generating AI reasoning..."
```

**Output per Produk:**
1. Nama + tagline
2. Match Score (0–100): hijau ≥85, kuning 70–84
3. Pain points yang diaddress (badge per kategori)
4. AI Reasoning block (spesifik ke company target dan pain point konkret)
5. Harga (format Rupiah)
6. Badge "Direkomendasikan" untuk score tertinggi

### Tab 2: Katalog Produk

**Header:**
```
[+ Tambah Produk Manual]    [Upload PDF / Dokumen]
```

**Fitur: Tambah/Edit Produk (modal form):**
| Field | Type | Keterangan |
|---|---|---|
| Nama produk | text | Wajib |
| Tagline | text | Maks 60 karakter |
| Deskripsi | textarea | Min 50 karakter |
| Harga | text | Format bebas |
| Pain categories | multi-checkbox | Marketing/Operations/Technology/Growth |
| USP | textarea | Satu baris per poin |

**Fitur: Upload PDF (drag & drop):**
```
Proses Ekstraksi (4 steps mock):
Step 1: "Membaca dokumen..."
Step 2: "Mengidentifikasi informasi produk..."
Step 3: "Mengekstrak nama, harga, dan fitur..."
Step 4: "Menyiapkan form review..."
```
Setelah ekstraksi → buka modal review dengan form pre-filled.

---

## Craft — Campaign Generation

**Proses Loading (6 steps):**
```
Step 1: "Menganalisis profil perusahaan & pain points..."
Step 2: "Memuat produk yang matched dan reasoning..."
Step 3: "Menyusun Email 1 — Ice-breaker..."
Step 4: "Menyusun Email 2 — Pain-focused follow-up..."
Step 5: "Menyusun Email 3 — Urgency & close..."
Step 6: "Finalisasi campaign plan & reasoning..."
```

**Output:**
- Campaign Reasoning Block
- 3 Email Cards (subject, body, day label)

---

## Polish — Human in the Loop Editor

**Fitur:**
- Tone Selector: Profesional / Friendly / Direct / Storytelling
- Email Tabs (dengan dot hijau jika sudah approve)
- Subject Line Editor (editable)
- Body Editor (textarea, resizable)
- Approve Button per email
- Tombol lanjut muncul hanya setelah semua email di-approve

---

## Launch — Automation Process

**Mode 1: One-click AI Automation**
- Card AI Recommendation
- Tombol [Aktifkan Automation]
- Setelah aktif: dot hijau animasi, list jadwal non-editable

**Mode 2: Manual Scheduling**
- 3 baris jadwal dengan date picker + time picker
- Validasi urutan tanggal
- Tombol [Simpan Jadwal & Aktifkan]

---

## Pulse — Tracking & Analytics

**Tampilan:**
- 4 Stat Cards: Email dikirim · Open rate (+ benchmark) · Click rate (+ benchmark) · Reply rate (+ benchmark)
- Bar Chart: Performance per email
- Line Chart: Engagement timeline
- Status List per email
- AI Token Usage Card (breakdown + estimasi Rupiah)

---

## Fitur Global

### Sidebar Navigation
- Logo "Campfire" (klik → `/research-library`)
- Section "Target Aktif"
- Navigasi: Research Library · Recon · Match · Craft · Polish · Launch · Pulse
- Footer: versi + "Demo · Mock Data"

### Progress Indicator
```
Recon ✓ → Match ✓ → Craft ● → Polish ○ → Launch ○ → Pulse ○
```

### Toast Notifications
- Sukses: hijau, 4 detik
- Error: merah, dismissable
- Info: biru, 4 detik

### Empty States
Setiap section wajib punya empty state informatif + call-to-action.
