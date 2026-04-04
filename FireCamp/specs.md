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
Halaman pertama yang dilihat user setelah login. Berisi semua profil perusahaan yang pernah di-riset dan disimpan. Menjadi "home base" sebelum memulai atau melanjutkan campaign apapun.

### Trigger Masuk ke Halaman Ini
- Setelah login
- Setelah user klik "Simpan ke Database" di halaman Recon
- Klik logo "Campfire" di sidebar

### Tampilan

**Header:**
- Judul: "Research Library"
- Subjudul: "Semua riset perusahaan tersimpan di satu tempat"
- Tombol **[+ Recon Baru]** — navigasi ke `/recon`

**Grid Kartu Profil** (2 kolom):
Setiap kartu menampilkan:
- Nama perusahaan (font weight 500)
- Industri · Lokasi
- Tanggal disimpan
- Jumlah pain points ditemukan (badge merah: "4 pain points")
- Progress indicator campaign:
  ```
  Recon ✓ → Match ✓ → Craft ○ → Polish ○ → Launch ○ → Pulse ○
  ```
  (✓ = selesai, ○ = belum dimulai, ● = sedang berjalan)
- Tombol **[Lanjutkan Campaign]** — navigasi ke tahap terakhir yang aktif
- Tombol **[Lihat Profil]** — buka kembali halaman Recon profil tersebut

**Empty State** (belum ada profil):
```
Belum ada riset tersimpan.
Mulai dengan melakukan Recon terhadap target perusahaan pertama kamu.
[+ Recon Baru]
```

---

## Recon — Company Profiling

### Tujuan
User memasukkan URL target company dan sistem menghasilkan profil riset lengkap dengan citation, kontak PIC, dan pain points.

### Input
| Field | Type | Validasi |
|---|---|---|
| Company URL | text input | Format URL valid, tidak boleh kosong |

### Proses Loading (2.5–3 detik, step by step)
```
Step 1: "Mengambil data LinkedIn via Proxycurl..."        (0.0–0.5s)
Step 2: "Scanning website perusahaan via Firecrawl..."    (0.5–1.0s)
Step 3: "Mencari kontak PIC yang relevan..."              (1.0–1.5s)
Step 4: "Mengambil berita terkini via Tavily API..."      (1.5–2.0s)
Step 5: "Menganalisis pain points dengan AI..."           (2.0–2.5s)
Step 6: "Memfinalisasi profil & citation..."              (2.5–3.0s)
```

### Layout Halaman Output

```
┌─────────────────────────────────────────────────────────┐
│  COMPANY HEADER CARD (full width)                        │
│  Nama · URL · Industri | LinkedIn stats | Badges         │
└─────────────────────────────────────────────────────────┘
┌──────────────────────────┐  ┌──────────────────────────┐
│  KOLOM KIRI              │  │  KOLOM KANAN             │
│                          │  │                          │
│  [Company Overview]      │  │  [Key Contacts PIC]      │
│  paragraf deskripsi      │  │  2–3 kontak tersimpan    │
│                          │  │                          │
│  [Pain Points]           │  │  [Recent News]           │
│  list 4–5 pain point     │  │  2–3 artikel + links     │
│  cards dengan severity   │  │                          │
└──────────────────────────┘  └──────────────────────────┘
```

### Output — Company Header Card
- Nama perusahaan (16px, weight 500)
- URL · Industri (12px, muted)
- Badges: ukuran karyawan, tahun berdiri, lokasi HQ
- LinkedIn: followers, employees count, pertumbuhan YoY

### Output — Company Overview
Paragraf deskripsi 2–4 kalimat tentang perusahaan.

### Output — Pain Points
List kartu, maksimal 5 item, setiap kartu:
- Kategori: Marketing / Operations / Technology / Growth
- Deskripsi issue dengan angka spesifik (contoh: "1.2% vs rata-rata industri 3.5%")
- Severity badge: `high` (merah) / `medium` (kuning) / `low` (abu)

### Output — Key Contacts PIC *(FITUR BARU)*

**Posisi:** Kolom kanan, paling atas, sebelum Recent News.

**Tujuan:** Memberikan sales informasi langsung tentang siapa yang harus dihubungi — bukan hanya apa masalahnya, tapi siapa orangnya.

Setiap kontak menampilkan:
| Field | Keterangan |
|---|---|
| Nama lengkap | Bold, 13px |
| Jabatan | Muted, 12px |
| Email | Klikabel `mailto:`, warna biru |
| Nomor telepon | Teks biasa, copy-able |
| Prospect Score | Angka 0–100 dalam badge hijau/kuning |
| Reasoning | 1 kalimat mengapa kontak ini relevan |

**Prospect Score color:**
- 80–100: badge hijau (decision maker utama)
- 60–79: badge kuning (influencer, bukan decision maker)
- Di bawah 60: tidak ditampilkan

**Jumlah kontak:** minimal 2, maksimal 3 per profil.

**Layout kartu kontak** (compact, horizontal):
```
┌─────────────────────────────────────────┐
│  [Inisial]  Nama Lengkap      Score: 92 │
│             VP of Marketing             │
│  ✉ nama@company.com                     │
│  📞 +62 812-xxxx-xxxx                   │
│  "Decision maker untuk marketing budget"│
└─────────────────────────────────────────┘
```

### Output — Recent News & Hot Issues *(PERUBAHAN)*

Setiap news item:
- Judul berita (bold, 12px)
- Tanggal · Sumber
- Summary 1–2 kalimat
- **Link citation klikabel** — format: `[Baca artikel ↗](url)` yang buka tab baru
  - Style: warna biru `var(--color-info)`, ada ikon ExternalLink (Lucide, 12px)
  - Tooltip: "Buka artikel di tab baru"
  - **Tidak ada badge "Sumber terverifikasi"** — digantikan sepenuhnya oleh link

### Aksi Tersedia
- **[Export PDF]** — toast "PDF sedang disiapkan..."
- **[Simpan ke Database]** — simpan profil, lalu **REDIRECT ke `/research-library`**
  - Sebelum redirect: toast sukses "Profil disimpan ke Research Library"
  - Di Research Library: kartu profil baru muncul paling atas dengan animasi subtle
- **[Lanjut ke Match →]** — navigasi ke `/match` dengan data Recon ter-passing

---

## Match — Product Matching

### Tujuan
Dua fungsi utama dalam satu halaman: (1) jalankan AI matching antara pain points company dengan product catalog, (2) kelola product catalog secara mandiri.

### Layout — Dua Tab

```
[  Matching  ]  [  Katalog Produk  ]
```

---

### Tab 1: Matching

#### Prerequisite
Recon harus selesai. Jika belum: tampilkan state "Selesaikan Recon terlebih dahulu."

#### Proses Loading (2–2.5 detik)
```
Step 1: "Memuat pain points dari database..."
Step 2: "Memuat product catalog & embeddings..."
Step 3: "Menjalankan semantic similarity matching..."
Step 4: "Menghitung relevance score per produk..."
Step 5: "Generating AI reasoning..."
```

#### Output per Produk
1. Nama + tagline
2. Match Score (0–100) dalam lingkaran: hijau ≥85, kuning 70–84
3. Pain points yang diaddress (badge per kategori)
4. AI Reasoning block — spesifik terhadap target company, ada referensi data dari profil
5. Harga (format Rupiah)
6. Badge "Direkomendasikan" untuk score tertinggi

#### Aksi
- **[Lanjut ke Craft →]**

---

### Tab 2: Katalog Produk *(FITUR BARU)*

#### Tujuan
User bisa mengelola daftar produk yang tersedia untuk di-matching: tambah, edit, hapus, dan upload PDF brosur untuk ekstraksi otomatis.

#### Layout Halaman Katalog
```
┌─────────────────────────────────────────────────────────┐
│  [+ Tambah Produk Manual]    [Upload PDF / Dokumen]     │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  DAFTAR PRODUK (list vertikal)                          │
│  Setiap baris: nama · tagline · harga · [Edit] [Hapus]  │
└─────────────────────────────────────────────────────────┘
```

#### Fitur: Tambah Produk Manual

Klik tombol **[+ Tambah Produk Manual]** → buka modal/drawer dengan form:

| Field | Type | Keterangan |
|---|---|---|
| Nama produk | text | Wajib diisi |
| Tagline | text | Maksimal 60 karakter |
| Deskripsi lengkap | textarea | Minimal 50 karakter |
| Harga | text | Format bebas, contoh: "Rp 8.500.000 / bulan" |
| Pain categories addressed | multi-checkbox | Marketing / Operations / Technology / Growth |
| USP (Unique Selling Points) | textarea | Poin-poin keunggulan, satu baris per poin |

Tombol di form:
- **[Simpan Produk]** — primary button
- **[Batal]** — close modal tanpa simpan

Validasi: nama wajib, deskripsi minimal 50 karakter, minimal 1 pain category dipilih.

#### Fitur: Edit Produk

Klik **[Edit]** pada baris produk → buka modal yang sama dengan form pre-filled.
Perubahan tersimpan setelah klik **[Simpan Perubahan]**.

#### Fitur: Hapus Produk

Klik **[Hapus]** → dialog konfirmasi:
```
Hapus "CampaignAI Pro"?
Produk yang dihapus tidak bisa dikembalikan.
[Batal]  [Ya, Hapus]
```

#### Fitur: Upload PDF / Dokumen *(FITUR BARU)*

**Tombol:** **[Upload PDF / Dokumen]** di header katalog.

**Trigger:** Klik tombol → buka area upload.

**Area Upload (Drag & Drop Zone):**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│     [ ikon upload ]                                     │
│     Seret file ke sini, atau klik untuk pilih           │
│     Mendukung: PDF, DOCX, PPT (maks. 10MB)              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Setelah file di-drop / dipilih:**
1. Tampilkan nama file + ukuran file
2. Tombol **[Ekstrak Informasi Produk]** muncul

**Proses Ekstraksi (Mock: 2 detik loading steps):**
```
Step 1: "Membaca dokumen..."
Step 2: "Mengidentifikasi informasi produk..."
Step 3: "Mengekstrak nama, harga, dan fitur..."
Step 4: "Menyiapkan form review..."
```

**Setelah ekstraksi selesai:**
Buka modal "Review Hasil Ekstraksi" dengan form pre-filled dari hasil AI ekstraksi.
User bisa koreksi sebelum simpan. Tombol **[Simpan ke Katalog]** di bawah form.

**File yang bisa di-upload (mock accepts):** `.pdf`, `.docx`, `.pptx`
**Ukuran maksimum:** 10MB
**Validasi:** Jika file bukan format yang diterima → tampilkan error inline di drop zone.

#### Tampilan List Produk

Setiap baris produk di katalog:
```
┌────────────────────────────────────────────────────────────┐
│  CampaignAI Pro                          [Edit]  [Hapus]   │
│  AI-powered email campaign automation                      │
│  Rp 8.500.000 / bulan  ·  Addresses: Marketing, Technology │
└────────────────────────────────────────────────────────────┘
```

**Empty state katalog:**
```
Belum ada produk di katalog.
Tambah produk secara manual atau upload dokumen produk untuk memulai.
[+ Tambah Produk Manual]  [Upload Dokumen]
```

---

## Craft — Campaign Generation

### Tujuan
AI generate rencana campaign email yang dipersonalisasi berdasarkan Recon dan Match.

### Prerequisite
Recon dan Match harus selesai.

### Proses Loading (2.5–3 detik)
```
Step 1: "Menganalisis profil perusahaan & pain points..."
Step 2: "Memuat produk yang matched dan reasoning..."
Step 3: "Menyusun Email 1 — Ice-breaker..."
Step 4: "Menyusun Email 2 — Pain-focused follow-up..."
Step 5: "Menyusun Email 3 — Urgency & close..."
Step 6: "Finalisasi campaign plan & reasoning..."
```

### Output

**Campaign Reasoning Block:**
- Mengapa jumlah email dan jarak waktu dipilih
- Referensi ke data spesifik dari profil
- Strategi per email

**3 Email Cards:**
| Field | Keterangan |
|---|---|
| Urutan | "Email 1", "Email 2", "Email 3" |
| Hari kirim | "Hari ke-1", "Hari ke-4", "Hari ke-10" |
| Subject | Spesifik, referensikan company atau news |
| Body | Plain text, 150–250 kata, placeholder `[Nama]` |

**Strategi:**
- Email 1: Ice-breaker — referensi event terbaru, bukan pitch langsung
- Email 2: Pain-focused — satu pain point operasional dengan angka
- Email 3: Urgency & close — risiko bisnis, low-pressure closing

### Aksi
- **[Lanjut ke Polish →]**

---

## Polish — Human in the Loop Editor

### Tujuan
Review, edit, dan approve semua email sebelum campaign dijalankan.

### Fitur

**Tone Selector:** Profesional / Friendly / Direct / Storytelling

**Email Tabs:** Tab per email dengan dot hijau jika sudah di-approve.

**Subject Line Editor:** Input text, full editable.

**Body Editor:** Textarea multiline, min 300px, resizable.

**Approve Button:**
- Sebelum: `[Approve Email X]` (success)
- Sesudah: badge "Email X diapprove" + border hijau

**Lanjut Tombol:** Muncul HANYA setelah semua email di-approve.

### Yang Tidak Ada di Polish
- Tidak ada AI re-generate dari editor
- Tidak ada collaborative editing
- Tidak ada version history

---

## Launch — Automation Process

### Prerequisite
Semua email di Polish harus di-approve.

### Mode 1: One-click AI Automation
- Card AI Recommendation (reasoning jadwal)
- Tombol **[Aktifkan Automation]**
- Setelah aktif: indicator dot hijau animasi, list jadwal non-editable

### Mode 2: Manual Scheduling
- 3 baris jadwal dengan date picker + time picker
- Validasi: email berikutnya tidak boleh sebelum email sebelumnya
- Tombol **[Simpan Jadwal & Aktifkan]**

---

## Pulse — Tracking & Analytics

### Tampilan

**4 Stat Cards:** Email dikirim · Open rate (+ benchmark) · Click rate (+ benchmark) · Reply rate (+ benchmark)

**Bar Chart:** Performance per email (Opens/Clicks/Replies per Email 1-2-3)

**Line Chart:** Engagement timeline per hari

**Status List:** Per email dengan badge Replied > Opened > Sent

**AI Token Usage Card:** Breakdown per tahap + estimasi biaya Rupiah

---

## Fitur Global

### Sidebar Navigation
- Logo "Campfire" di atas (klik → ke /research-library)
- Section "Target Aktif": nama company sedang aktif
- Section navigasi: Research Library · Recon · Match · Craft · Polish · Launch · Pulse
- Footer: versi + "Demo · Mock Data"

### Progress Indicator
Di atas content area:
```
Recon ✓ → Match ✓ → Craft ● → Polish ○ → Launch ○ → Pulse ○
```

### Toast Notifications
- Sukses: hijau tipis, 4 detik
- Error: merah tipis, dismissable
- Info: biru tipis, 4 detik

### Empty States
Setiap section yang mungkin kosong wajib punya pesan informatif + call-to-action.
