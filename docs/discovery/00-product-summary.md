# 00 — Ringkasan Produk Campfire
> Dokumen ini untuk founder. Baca sebelum meeting pertama. Internalisasi dulu sebelum presentasi.

---

## Apa Itu Campfire?

Campfire adalah B2B outreach automation tool. Tagline-nya: **Research. Match. Send.**

Produk ini membantu sales/marketing B2B melakukan tiga hal yang biasanya memakan waktu paling banyak:
1. Riset mendalam tentang perusahaan target (siapa mereka, apa masalahnya, siapa kontak yang tepat)
2. Mencocokkan masalah mereka dengan produk/layanan yang kamu jual
3. Menghasilkan dan mengirim email outreach yang terasa personal, bukan blast template

---

## Pipeline: 6 Tahap dari Nol ke Email Terkirim

### 1. Recon — Profiling Perusahaan Target
**Cara kerja:** User masukkan URL website perusahaan target. Campfire menjalankan riset paralel dari 7 sumber data secara bersamaan:
- Tavily extract + search (baca website, temukan konten)
- Serper.dev LinkedIn dorking (temukan kontak PIC via Google)
- Hunter.io (verifikasi domain dan metadata perusahaan)
- Tavily news + Serper news (berita terkini tentang perusahaan)
- Sinyal hiring (lowongan = sinyal investasi)
- Sinyal uang / kepemimpinan (M&A, funding, pergantian eksekutif)
- GPT-4o sintesis akhir

**Output yang dihasilkan:**
| Field | Keterangan |
|---|---|
| Nama + industri + lokasi + ukuran + tahun berdiri | Identitas perusahaan |
| Company Overview | Paragraf 5-8 kalimat mendalam (bukan ringkasan generik) |
| Deep Insights | 5-7 item: [IDENTITAS] [PRODUK] [DIGITAL] [POSISI PASAR] [VULNERABILITIES] [KOMPETITOR] [TECH ASSESSMENT] |
| Strategic Report | Judul strategis + executive insight + kapabilitas internal + dinamika pasar + roadmap strategis |
| Pain Points | 3-5 pain point dengan severity (high/medium/low), kategori (Marketing/Operations/Technology/Growth), dan citation URL ke sumbernya |
| Recent News | 3-6 artikel + badge sinyal: Regulasi / Kompetitor / Tech Shift |
| Intent Signals | Sinyal hiring dan uang (funding, M&A, pergantian eksekutif) |
| Key Contacts PIC | 1-3 kontak dengan prospectScore, reasoning [MANDATE][PAIN OWNERSHIP][HOOK][RECENCY], LinkedIn URL |
| LinkedIn Stats | Followers, employees count, growth trend |

**Free vs Pro:**
| | Free (1 kredit, ~8-15 detik) | Pro (5 kredit, ~35-60 detik) |
|---|---|---|
| Riset | 1 pass, 7-lane paralel | Recursive gap-filling (max 2 iterasi) |
| Sub-pages | Tidak | Ya (/about, /blog, /team, /clients) |
| Contact tier | C-suite saja | C-suite + Director + Manager (3 tier) |
| Pain point citation | Dicoba | Semua divalidasi silang |
| Insights | 5 item | 7 item (+ [KOMPETITOR] + [TECH ASSESSMENT]) |
| News | 3-4 artikel | 4-6 artikel dengan signal type |
| Use case | Eksplorasi awal | Demo ke client, campaign penting |

---

### 2. Match — Pencocokan Produk
**Cara kerja:** Setelah Recon, user punya katalog produk sendiri di Campfire (bisa input manual atau upload PDF brosur). Campfire mengambil pain points dari profil perusahaan target dan menjalankan AI semantic matching terhadap semua produk di katalog.

**Output:**
- Match score 0-100 per produk (hijau ≥85, kuning 70-84)
- Pain points yang di-address oleh setiap produk (badge per kategori)
- AI reasoning spesifik ke perusahaan target dan pain point konkret
- Badge "Direkomendasikan" untuk produk dengan score tertinggi

**Syarat:** Katalog produk harus sudah terisi sebelum bisa matching.

---

### 3. Craft — Generate Email Campaign
**Cara kerja:** User pilih satu produk dari hasil Match. Campfire menggunakan GPT-4o dengan framework **Challenger Sale** untuk membuat 3-email sequence.

**Output — 3 Email:**
- **Email 1 (Hari ke-1, profesional):** Ice-breaker insight-led. Menggunakan executive insight dan market dynamics dari Recon. Singgung pain spesifik, sebutkan solusi 1 kalimat.
- **Email 2 (Hari ke-4, friendly):** Business case + social proof. Menggunakan AI match reasoning.
- **Email 3 (Hari ke-10, direct):** Breakup/urgency. 2 paragraf pendek. CTA ya/tidak yang jelas.

**Plus:** Campaign reasoning block — penjelasan AI kenapa strategi ini dipilih untuk perusahaan ini.

Semua email dalam **Bahasa Indonesia yang natural**. Bukan template generik.

---

### 4. Polish — Editor Human-in-the-Loop
**Cara kerja:** User bisa:
- Ganti tone: Profesional / Friendly / Direct / Storytelling (AI akan rewrite)
- Edit subject line dan body secara langsung
- Approve tiap email satu per satu

Ketika user klik ganti tone, AI melakukan rewrite mempertahankan konteks Challenger Sale. User **wajib approve semua email** sebelum bisa lanjut ke Launch.

---

### 5. Launch — Aktivasi Pengiriman
**Cara kerja:** User pilih mode:
- **AI Automation:** Jadwal otomatis Day 1 → Day 4 → Day 10 (metodologi B2B)
- **Manual:** User set sendiri tanggal dan jam untuk setiap email

Setelah diaktifkan, Vercel Cron berjalan setiap 15 menit, memeriksa email yang sudah waktunya dikirim, dan mengirimnya via Resend API ke alamat email kontak PIC.

**Catatan penting:** Email dikirim dari domain sender yang sudah diverifikasi di Resend. Untuk production, domain harus dikonfigurasi.

---

### 6. Pulse — Analytics & Tracking
**Cara kerja:** Dashboard read-only yang menampilkan performa campaign setelah email dikirim.

**Data yang dilacak (via Resend webhooks):**
- Email dikirim (jumlah total)
- Open rate (% yang buka email) + perbandingan vs benchmark industri (22%)
- Click rate (% yang klik link) + benchmark (3.5%)
- Reply rate (% yang reply) + benchmark (8%)
- Per-email status: scheduled → sent → opened → clicked → replied / bounced / complained
- Engagement timeline chart (per hari)
- AI token usage per tahap + estimasi biaya dalam IDR

---

## Workflow Lengkap User: Dari Nol ke Email Terkirim

```
1. Register/Login (Supabase Auth)
2. Onboarding (nama tim, nama sender, jabatan, signature, target pertama)
3. Research Library → klik "Recon Baru"
4. Input URL perusahaan target → pilih mode Free/Pro → tunggu
5. Review profil (pain points, contacts, news)
6. Simpan ke database → redirect ke halaman profil
7. Klik "Lanjut ke Match" → tunggu matching
8. Pilih produk terbaik → klik "Lanjutkan ke Craft"
9. Klik "Generate Campaign" → tunggu → review 3 email
10. Polish: ubah tone jika perlu, edit teks, approve semua email
11. Launch: pilih jadwal → aktifkan
12. Pulse: monitor open rate, click rate, reply rate
```

**Estimasi waktu total (pertama kali):** 10-20 menit dari nol ke campaign aktif.
**Estimasi waktu setelah familiar:** 5-8 menit per target.

---

## Keterbatasan Saat Ini (Jujur ke Diri Sendiri Dulu)

| Limitation | Detail |
|---|---|
| **Email kontak sering kosong** | Campfire cari email via Google dorking — bukan dari LinkedIn API. Kalau email tidak dipublikasi, field email akan kosong. User perlu verifikasi manual. |
| **Tidak ada integrasi CRM** | Tidak ada sinkronisasi ke Salesforce, HubSpot, atau Pipedrive. Standalone tool. |
| **Tidak ada WhatsApp/SMS** | Outreach email-only. Tidak ada kanal lain. |
| **Katalog produk harus diisi dulu** | Sebelum Match bisa berjalan, user harus punya produk di katalog. |
| **Satu kontak per campaign** | Setiap campaign ditujukan ke satu PIC. Tidak ada bulk sequence ke banyak kontak sekaligus dari satu run. |
| **Tidak ada A/B testing** | Satu versi email per campaign, tidak bisa split test subject line atau body. |
| **Tidak ada AI reply drafting** | Pulse hanya monitor. Tidak ada AI yang otomatis draft balasan dari reply prospek. |
| **Setup Resend wajib untuk kirim** | Untuk kirim email nyata, domain sender harus diverifikasi di Resend dan API key dikonfigurasi. |
| **Tracking bergantung Resend webhooks** | Open rate dan click rate hanya tersedia kalau Resend webhook aktif dan domain tracking disetujui penerima. |

---

## Yang Campfire Unggulkan

1. **Riset yang terasa manusiawi** — bukan scraping kaku, tapi sintesis yang menghasilkan insight strategis tentang perusahaan (executive insight, market dynamics, vulnerabilities)
2. **Pain points dengan citation** — setiap pain point ada link sumbernya, bisa diklik untuk verifikasi
3. **Email dengan konteks spesifik** — bukan template blast; AI tahu nama kontak, posisi mereka, pain spesifik perusahaan, produk kamu
4. **Challenger Sale framework** — email tidak sekadar "kami punya produk X" tapi menantang status quo dan memberikan insight baru
5. **Terintegrasi end-to-end** — dari riset sampai kirim dalam satu platform, bukan patchwork tools

---

## Untuk Diingat Sebelum Meeting

- Campfire adalah tool untuk **tim sales/marketing yang sudah aktif outreach** tapi kewalahan dengan volume riset dan personalisasi
- Bukan tool untuk tim yang belum punya produk jelas atau belum ada target market
- Target user ideal: **sales rep atau BD yang handle 10-50 target per bulan** dan spend >3 jam/hari untuk riset + nulis email
- Harga model: **bayar per operasi via kredit** (bukan subscription tetap) — cocok untuk tim yang volume-nya fluktuatif
