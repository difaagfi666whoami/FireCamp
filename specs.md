# specs.md — Product Specifications

> Source of truth untuk semua fitur **Campfire**.
> Setiap fitur yang tidak ada di dokumen ini tidak boleh dibangun tanpa persetujuan eksplisit.

---

## Status & Phase Map

**Phase 1 (MVP)** shipped sebagai foundation. **Phase 2-8** sudah live di produksi sebagai pengembangan dari MVP. Dokumen ini sekarang merefleksikan kondisi sebenarnya di codebase per **2026-05-25** (33 migrations, ~12 phase additions).

| Phase | Topik | Status | Migrations |
|---|---|---|---|
| 1 | Core Pipeline (Recon → Pulse) + Research Library | ✅ Live | 001-016 |
| 2 | Auth & Multi-Tenancy | ✅ Live | 017, 018 |
| 3 | Billing — Stripe Credits | ✅ Live | 019_billing, 020 |
| 4 | Payment Localization — Xendit (QRIS / VA) | ✅ Live | 023 |
| 5 | Email Production Infrastructure | ✅ Live | 025_user_email_settings, 029, 030 |
| 6 | Onboarding & Early Access | ✅ Live | 022, 024, 025_feedback, 026_early_access_seen |
| 7 | Admin Tooling (internal only) | ✅ Live | (no migration — read-only views) |
| 8 | Optimization & Hardening | ✅ Live | 026_v_pending_emails, 027, 028, 031 |

---

## Informasi Produk

| Atribut | Detail |
|---|---|
| Nama | Campfire |
| Tagline | Research. Match. Send. |
| Versi Target | v1.0.0 (MVP) → production hardening (Phase 2-8) |
| Target User | Digital Marketer B2B, Sales Team, BD Executive (Indonesia) |
| Platform | Web App (desktop-first, minimum 1280px) |
| Bahasa | Bahasa Indonesia (UI text) |
| Live mode | `NEXT_PUBLIC_USE_MOCK=false` (default in production) |

---

# Phase 1 — Core Pipeline (MVP)

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

**Sumber data yang digunakan (7-Lane Architecture):**
- Tavily `/extract` (homepage + deteksi sub-pages) — Lane A, F
- Tavily `/search` (6 query per QueryAngle taxonomy) — Lane A, C
- Serper.dev (LinkedIn dorking — Tier 1 saja) — Lane B
- Serper.dev `/news` (multi-strategy fallback) — Lane C, D, E
- Hunter.io `companies/find` (ground truth metadata) — Lane G
- Jina Reader (1-2 artikel teratas) — Lane C
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

**Cara kerja:** Pro Mode menggunakan **Tavily Research API** (agentic deep research) langsung, bukan 7-lane pipeline. Hasil markdown report disimpan ke field `tavily_report`, lalu di-extract menjadi structured profile via GPT-4o.

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

**Output tambahan vs Free:**
- Deep Insights: 7 item (5 standar + [KOMPETITOR] + [TECH ASSESSMENT])
- Pain Points: 4-5 item, SEMUA harus ada `sourceUrl` yang valid (cross-validated)
- News: 4-6 artikel, dengan badge `signal_type` (Regulasi / Kompetitor / Tech Shift)
- Key Contacts PIC: 2-3 kontak, reasoning lebih detail (4 komponen outreach brief)
- Raw Tavily report tersimpan untuk audit
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

**Pre-condition:** Katalog produk user wajib terisi (minimal 1 produk). Kalau kosong, backend return HTTP 503 dengan pesan "Katalog produk kosong" + CTA ke tab Katalog Produk.

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

**Framework:** Challenger Sale + Consultative Selling (insight-led, bukan product-led).

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
- Campaign Reasoning Block — penjelasan strategi AI
- 3 Email Cards (subject, body, day label)
  - Email 1 (Hari 1, profesional) — ice breaker insight-led
  - Email 2 (Hari 4, friendly) — business case + social proof
  - Email 3 (Hari 10, direct) — breakup / urgency / CTA

---

## Polish — Human in the Loop Editor

**Fitur:**
- Tone Selector: Profesional / Friendly / Direct / Storytelling
  - Tone change memicu AI rewrite via `POST /api/craft/rewrite` (cost: 1 kredit per rewrite)
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
- Default schedule: **Day 1 → Day 4 → Day 10** (metodologi B2B)
- Setelah aktif: dot hijau animasi, list jadwal non-editable

**Mode 2: Manual Scheduling**
- 3 baris jadwal dengan date picker + time picker
- Validasi urutan tanggal (Email N+1 harus setelah Email N)
- Tombol [Simpan Jadwal & Aktifkan]

**Dispatcher:**
- **Primary:** GitHub Actions cron — `*/15 * * * *` (setiap 15 menit) di `.github/workflows/cron-dispatch.yml`
- **Safety net:** Vercel Cron — `0 0 * * *` (1× per hari) di `vercel.json`
- Endpoint: `GET /api/cron/dispatch` (Bearer `CRON_SECRET`)
- Sumber data: View `v_pending_emails` (Supabase)
- Pengiriman: Resend SDK dengan `tags: [{name: "campaign_email_id"}]`
- Timezone: Asia/Jakarta

---

## Pulse — Tracking & Analytics

**Tampilan:**
- 4 Stat Cards: Email dikirim · Open rate (+ benchmark 22%) · Click rate (+ benchmark 3.5%) · Reply rate (+ benchmark 8%)
- Bar Chart: Performance per email
- Line Chart: Engagement timeline
- Status List per email (scheduled → sent → opened → clicked → replied / bounced / complained / failed)
- AI Token Usage Card (breakdown Recon/Match/Craft/Polish + estimasi Rupiah)

**Data source:**
- `campaign_analytics` table (1 row per campaign, populated by trigger)
- `email_analytics` table (1 row per email, populated by Resend webhook)
- Resend webhooks → `POST /api/webhooks/inbound` (Svix-signed)
- Supported events: `email.opened`, `email.clicked`, `email.bounced`, `email.complained`, `email.failed`, `email.received` (untuk reply tracking)

**Reply attribution (3-layer):**
1. Plus-address (`reply+<uuid>@domain`)
2. In-Reply-To header matching
3. Sender heuristic (fallback)

---

## Fitur Global

### Sidebar Navigation
- Logo "Campfire" (klik → `/research-library`)
- Section "Target Aktif"
- Navigasi utama: Research Library · Recon · Match · Craft · Polish · Launch · Pulse
- Navigasi bottom: Credit balance widget (live) · Beli Credits · Guide · Settings · Logout
- Footer: versi + mode

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

### Color Tokens
| Token | Hex |
|---|---|
| `brand` | `#0F6E56` |
| `brand-light` | `#E1F5EE` |
| `success` | `#1D9E75` |
| `warning` | `#BA7517` |
| `danger` | `#D85A30` |

### UI Rules
- Semua user-facing text di Bahasa Indonesia
- Kode (variable, function, comment) di English
- Komponen UI pakai `shadcn/ui` — tidak boleh bangun primitive sendiri
- Icons: Lucide React saja. Charts: Recharts saja.
- Maks 1 primary button per halaman. Destructive action butuh confirmation dialog.
- Nama milestone di UI: "Recon", "Match", "Craft", "Polish", "Launch", "Pulse" — tidak boleh "M1", "M2", dst.

---

# Phase 2 — Auth & Multi-Tenancy

## Tujuan
Setiap user punya workspace terisolasi. Data perusahaan, kontak, produk, campaign milik user tidak boleh terlihat oleh user lain.

## Halaman
- `/login` — Supabase Auth (email + password, magic link)
- `/auth/confirm` — email confirmation handler
- `/auth/redeem-invite` — invite code redemption (lihat Phase 6)

## Database
- Migration **017** — `user_profiles` table (workspace name, sender identity, signature, onboarding flag)
- Migration **018** — Multi-tenancy: tambah `user_id UUID` FK ke `auth.users(id)` pada semua tabel data:
  - `companies`, `contacts`, `pain_points`, `news`, `intent_signals`
  - `products`, `campaigns`, `campaign_emails`, `matching_results`
  - `campaign_analytics`, `email_analytics`
  - Plus RLS policy `user_owns_row` = `auth.uid() = user_id`

## Aturan Coding
- Frontend INSERT wajib include `user_id` via `getCurrentUserId()` dari `lib/supabase/client.ts` (throws jika tidak login)
- Backend write via service role key juga wajib include `user_id` (service role bypass RLS — leak silent kalau lupa)
- Auto-analytics triggers propagate `user_id` parent → child (jangan bypass)
- Dev bypass: `NEXT_PUBLIC_AUTH_DEV_BYPASS=true` di `.env.local` (default OFF)

## Middleware
- `middleware.ts` redirect unauthenticated request ke `/login`
- Pengecualian: `/login`, `/auth/*`, `/api/webhooks/*`, `/api/cron/*`

---

# Phase 3 — Billing (Stripe Credits)

## Tujuan
Pay-as-you-go model: user bayar per AI operation, bukan subscription tetap. Pricing transparan, biaya per operasi visible.

## Tables (Migration 019_billing)
- `user_credits` — `user_id PK`, `balance INT ≥ 0` — RLS read-only untuk owner
- `credit_transactions` — append-only ledger (`purchase`, `debit`, `refund`, `grant`) dengan `stripe_session_id` untuk idempotency
- SQL functions:
  - `debit_credits(uid, amount, description)` — SECURITY DEFINER, atomic
  - `credit_credits(uid, amount, type, description, stripe_session_id)` — SECURITY DEFINER, idempotent on `stripe_session_id`

## Biaya per Operasi (dari `backend/app/core/billing.py`)
| Operasi | Kredit |
|---|---|
| Recon Free | 1 |
| Recon Pro | 5 |
| Match | 1 |
| Craft (3 email) | 2 |
| Polish rewrite (per tone change) | 1 |
| Launch + Pulse | 0 (tracking) |

Router melakukan **debit BEFORE running AI work**. Jika balance < cost → HTTP 402 dengan CTA "Top up di /pricing".

## Paket Kredit (tweak di `backend/app/core/billing.py`)
| Paket | Kredit | Harga |
|---|---|---|
| Starter | 50 | Rp 100.000 |
| Growth (recommended) | 200 | Rp 350.000 |
| Scale | 500 | Rp 750.000 |

## API
- `GET /api/billing/packages` — public, list packs (untuk `/pricing` UI)
- `GET /api/billing/balance` — auth, current user balance
- `POST /api/billing/checkout` — auth, create Stripe Checkout Session, returns redirect URL
- `POST /api/webhooks/stripe` — Stripe-only (signature-verified), handles `checkout.session.completed`

## Halaman
- `/pricing` — pack grid + cost-per-op breakdown + current balance
- `/billing/success` — post-checkout landing, polls balance ~9 detik sambil webhook fires
- Sidebar widget — live credit balance di bottom navigation, doubles sebagai "Beli Credits" link

## Seed (Migration 020 — signup_credit_grant)
User baru otomatis dapat **100 kredit gratis** saat signup. Tujuan: lower-friction trial untuk discovery / early access.

---

# Phase 4 — Payment Localization (Xendit)

## Tujuan
Stripe-only adalah friction tinggi untuk B2B Indonesia (banyak tim finance tidak punya kartu kredit korporat). Tambah Xendit sebagai alternative payment method.

## Tables (Migration 023_xendit_payments)
- `xendit_payments` — payment intent tracking (status: pending/paid/expired/failed)
- Field: `user_id`, `package_id`, `amount_idr`, `xendit_invoice_id`, `payment_method`, `paid_at`

## Supported Methods
- **QRIS** — universal QR code (semua e-wallet Indonesia)
- **Virtual Account BCA**
- **Virtual Account Mandiri**

## API
- `POST /api/xendit/invoice` — create invoice, return Xendit checkout URL
- `POST /api/webhooks/xendit` — signature-verified callback dari Xendit, credit user account on success (idempotent via `xendit_invoice_id`)

## UI
- Di `/pricing`, user pilih paket → toggle metode pembayaran (Stripe / Xendit)
- Jika pilih Xendit → redirect ke Xendit-hosted checkout
- Setelah pembayaran sukses → redirect ke `/billing/success` (sama dengan flow Stripe)

---

# Phase 5 — Email Production Infrastructure

## Tujuan
Production-grade email delivery: deliverability tinggi, compliance penuh (CAN-SPAM / GDPR), reputasi domain terjaga, no silent failures.

## Custom Email Domains (Migration 025_user_email_settings)
- Table `user_email_settings` — per-user sender configuration:
  - `sender_email`, `sender_name`, `signature_html`
  - `custom_domain`, `dns_verification_status`, `resend_domain_id`
- Halaman `/settings` — form untuk konfigurasi sender + DNS verification flow via Resend API
- Email dikirim **dari domain user**, bukan dari domain bersama Campfire

## Email Suppression List (Migration 030_email_suppression)
- Table `email_suppression` — alamat yang sudah unsubscribe / bounce / complain
- Setiap email dispatcher check suppression list dulu sebelum kirim
- Unsubscribe link otomatis di setiap email (token UUID per email)
- One-click unsubscribe handler: `GET /api/unsubscribe?token=<uuid>` → tambah ke suppression list

## Email Retry Tracking (Migration 029_email_retry_tracking)
- Field `retry_count`, `last_retry_at`, `dead_lettered_at` di `campaign_emails`
- Dispatcher retry max 3× dengan exponential backoff
- Setelah max retries → mark sebagai `dead_lettered`, skip pengiriman berikutnya
- Admin dashboard (Phase 7) menampilkan dead-letter queue

## Cron Dispatcher
- **Primary:** GitHub Actions `*/15 * * * *` → `.github/workflows/cron-dispatch.yml`
- **Safety net:** Vercel Cron `0 0 * * *` → `vercel.json` (Hobby plan limit)
- Auth: Bearer `CRON_SECRET` env var

## Resend Webhook Handler
- Endpoint: `POST /api/webhooks/inbound` (Svix signature-verified)
- Events: `email.opened`, `email.clicked`, `email.bounced`, `email.complained`, `email.failed`, `email.received`
- 3-layer reply attribution (plus-address → In-Reply-To → sender heuristic)

---

# Phase 6 — Onboarding & Early Access

## Onboarding Flow (Migration 022_onboarding_flag)
- Halaman `/onboarding` — 3-step wizard (wajib dilewati sebelum bisa pakai pipeline):
  1. Nama tim / workspace
  2. Sender identity (nama lengkap, jabatan)
  3. Email signature + (opsional) first target URL
- Tersimpan ke `user_profiles.onboarding_completed`
- Middleware redirect user tanpa onboarding ke `/onboarding`

## Invite Code System (Migration 024_invite_codes)
- Table `invite_codes` — `code TEXT PK`, `created_by`, `used_by`, `credits_grant`, `expires_at`
- Halaman `/auth/redeem-invite` — user input code → grant credits + mark `early_access_seen`
- Gunakan untuk gating early access program

## Early Access Welcome (Migration 026_early_access_seen)
- Field `early_access_seen` di `user_profiles`
- First-login modal — sambutan + ringkasan apa yang bisa dilakukan dengan early access
- Setelah ditutup → `early_access_seen = true`

## Feedback Widget (Migration 025_feedback)
- Table `feedback` — `user_id`, `page`, `sentiment` (positive/neutral/negative), `message`, `created_at`
- Widget global di pojok kanan bawah setiap halaman shell
- Submit fire-and-forget — masuk ke admin dashboard
- **Catatan:** widget ini juga dipakai sebagai backbone untuk pengumpulan customer discovery dari beta users

## Guide Page
- `/guide` — FAQ + how-to documentation (English / Bahasa toggle)
- Mengurangi support burden untuk pertanyaan yang berulang

---

# Phase 7 — Admin Tooling (Internal Only)

**Audience:** Founder + internal team. Tidak terlihat oleh end user.

## Halaman
- `/admin/usage` — statistik agregat:
  - Total users, signup per hari, retention
  - Credit distribution, burn rate per operasi
  - Feedback sentiment trend
  - Dead-letter queue summary
- `/admin/users` — per-user view:
  - Balance, activity log, company count, campaign count
  - Manual credit grant (untuk customer support)
  - Suspend / unsuspend account

## Access Control
- Hardcoded admin email list di backend
- Middleware tambahan: jika user.email not in admin list → redirect ke `/research-library`

---

# Phase 8 — Optimization & Hardening

## Recon Cache (Migration 031_recon_cache)
- Service: `backend/app/services/recon_cache_service.py`
- Cache key: domain + recon mode
- TTL: 24 jam
- Tujuan: Free → Pro upgrade tanpa burning credits ulang untuk data yang sudah ada
- Cache hit return cached profile + skip AI pipeline + tetap deduct credits (atau gratis, tergantung policy)

## Analytics Trigger Fixes (Migration 027_fix_analytics_triggers)
- Fix bug: trigger auto-create `campaign_analytics` row tidak ter-trigger untuk row baru tertentu
- Trigger sekarang menjamin 1 row analytics per campaign + email

## RLS Parent-Ownership Check (Migration 028_rls_parent_ownership_check)
- Hardening tambahan: cek parent ownership (campaign → company) untuk mencegah cross-tenant leakage via child table
- Contoh: user A tidak bisa insert email ke campaign milik user B walaupun RLS pada `campaigns` table dilewati

## v_pending_emails user_id (Migration 026_v_pending_emails_add_user_id)
- View dispatcher di-update untuk include `user_id` → cron dispatcher bisa scope per-user untuk monitoring

---

# Migration Index (33 migrations)

| # | Migration | Purpose | Phase |
|---|---|---|---|
| 001 | initial_schema | Core 10 tables (companies, contacts, pain_points, news, products, campaigns, campaign_emails, matching_results, campaign_analytics, email_analytics) | 1 |
| 002 | rls_dev_policy | Open RLS for anon (dev only) | 1 |
| 003 | rls_recon | Dev RLS for recon tables | 1 |
| 004 | rls_campaign | Dev RLS for campaign tables | 1 |
| 005 | relax_product_fk | Allow null product_id in matching_results | 1 |
| 006 | expanded_recon_schema | Tambah field strategic_report, deep_insights, intent_signals | 1 |
| 007 | n8n_polling_view | (legacy) n8n integration view | 1 (deprecated) |
| 008 | resend_rpc | RPC: increment_email_opens, increment_email_clicks, increment_campaign_emails_sent | 1 |
| 009 | remove_n8n_view | Drop legacy n8n view, create vendor-neutral `v_pending_emails` | 1 |
| 010 | reply_tracking | Field untuk reply attribution | 1 |
| 011 | auto_initialize_analytics | Trigger: auto-create analytics rows | 1 |
| 012 | bounce_complaint_rpc | RPC: handle email.bounced, email.complained | 1 |
| 013 | fix_engagement_status_hierarchy | Status resolution priority logic | 1 |
| 014 | recon_twopass_schema | Pro mode dua-pass schema | 1 |
| 015 | remove_tech_stack | Drop unused tech_stack field | 1 |
| 016 | add_tavily_report | Field untuk Tavily Research raw markdown | 1 |
| 017 | add_user_profiles | user_profiles table (workspace, sender identity) | 2 |
| 018 | multi_tenancy | Tambah user_id + RLS policy ke semua tabel | 2 |
| 019_add_processing_status | Field processing_status untuk async ops | 1 |
| 019_billing | user_credits, credit_transactions, debit/credit functions | 3 |
| 020 | signup_credit_grant | Auto-grant 100 kredit untuk user baru | 3 |
| 022 | onboarding_flag | onboarding_completed flag di user_profiles | 6 |
| 023 | xendit_payments | xendit_payments table | 4 |
| 024 | invite_codes | invite_codes table | 6 |
| 025_feedback | Feedback widget table | 6 |
| 025_user_email_settings | Per-user sender config + custom domain | 5 |
| 026_early_access_seen | first-login modal flag | 6 |
| 026_v_pending_emails_add_user_id | Dispatcher view scoped by user_id | 8 |
| 027 | fix_analytics_triggers | Trigger correctness fix | 8 |
| 028 | rls_parent_ownership_check | Cross-tenant leakage hardening | 8 |
| 029 | email_retry_tracking | retry_count, dead_lettered_at | 5 |
| 030 | email_suppression | suppression list + unsubscribe tokens | 5 |
| 031 | recon_cache | recon_cache table + TTL | 8 |

---

## Catatan Pemeliharaan

- **Jangan menambah fitur baru tanpa update dokumen ini.** Spec stale = ambiguitas implementasi.
- **Tiap migration baru** harus masuk ke Migration Index di atas dengan phase + purpose.
- **Tiap halaman baru** di `app/` harus muncul di section phase yang sesuai dengan tujuan minimal 1 paragraf.
- **Apollo / Apify services** sudah dihapus pada audit 2026-05-25 (architecture.md sudah menandai DIHAPUS sebelumnya, file fisik akhirnya dihilangkan).
