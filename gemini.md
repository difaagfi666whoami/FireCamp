# gemini.md — Campfire AI Rules

> File ini adalah instruksi utama untuk Gemini saat vibe coding project **Campfire**.
> Baca file ini sebelum menulis satu baris kode pun. Semua keputusan teknis, desain,
> dan struktur harus konsisten dengan rules di bawah.

> **Update terakhir:** 2026-04-29 — Phase 1 (multi-tenancy + auth) selesai. Phase 2 (billing) belum.

---

## 1. Project Identity

| Atribut | Detail |
|---|---|
| Nama | Campfire |
| Tagline | Research. Match. Send. — B2B outreach dari riset ke kirim dalam satu tempat. |
| Stage | Multi-tenant SaaS dengan pipeline live; Phase 2 commercialization (billing) on roadmap |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python 3.9) |
| Database | Supabase (PostgreSQL + RLS production aktif) |
| Auth | Supabase Auth (email + password) |
| Email Dispatch | Resend SDK + Vercel Cron |
| Bahasa UI | Bahasa Indonesia |
| Bahasa Kode | Inggris |

---

## 2. Milestone Naming — Wajib Konsisten

| ID Internal | Nama Tampil | Route | Deskripsi Singkat |
|---|---|---|---|
| recon | Recon | `/recon` | Riset & profiling target company |
| match | Match | `/match` | Pencocokan produk ke kebutuhan company |
| craft | Craft | `/craft` | Generate personalized email campaign |
| polish | Polish | `/polish` | Human review & edit sebelum kirim |
| launch | Launch | `/launch` | Automation & penjadwalan pengiriman |
| pulse | Pulse | `/pulse` | Tracking & analytics performa campaign |

**Aturan Penamaan:**
- **TIDAK BOLEH** menggunakan "M1", "M2" dst. di UI manapun. Selalu gunakan nama tampil.
- Sidebar: Gunakan nama tampil ("Recon", "Match", dst).
- URL Routing: Gunakan ID internal (`/recon`, `/match`, dst).
- Kode: Gunakan ID internal (`useRecon`, `MatchCard`, `CraftView`).

---

## 3. Aturan Wajib

### 3.1 Urutan Prioritas Build
```
Recon → Match → Craft → Polish → Launch → Pulse
```
Status: keenam milestone sudah live. Fokus baru di product maturity, bukan rebuild pipeline.

### 3.2 Mock / Live Toggle
```typescript
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

async function generateReconProfile(url: string, mode: 'free' | 'pro' = 'free') {
  if (USE_MOCK) return mockData.company
  return await fetch(`${API_URL}/api/recon`, {
    method: 'POST',
    body: JSON.stringify({ url, mode, user_id })   // user_id wajib di Phase 1+
  })
}
```
Default sekarang `NEXT_PUBLIC_USE_MOCK=false` (live mode aktif).

### 3.3 Recon Mode Rules
- **Free mode** adalah default. Selalu tampilkan mode selector di ReconForm.
- **Pro mode** harus ada visual indicator yang jelas (badge "Pro", warna berbeda, loading steps lebih banyak).
- Di production, Free dan Pro memanggil endpoint FastAPI berbeda:
  - Free → `POST /api/recon` (frontend persists hasilnya via `saveCompanyProfile`)
  - Pro → `POST /api/recon/pro` (backend menulis langsung ke Supabase, return `{company_id, name}`)
- Keduanya wajib pass `user_id: getCurrentUserId()` di body untuk multi-tenancy.

### 3.4 Loading State
Step-by-step wajib. Bukan spinner.
```
Free mode (4 steps):
1. "Membaca website perusahaan..."
2. "Mencari berita & hot issues..."
3. "Menganalisis pain points..."
4. "Memfinalisasi profil..."

Pro mode (8 steps):
1. "Membaca website perusahaan secara mendalam..."
2. "Menjalankan multi-step web research..."
3. "Mencari berita & hot issues dari berbagai sumber..."
4. "Mencari kontak PIC via database profesional..."
5. "Scoring & validasi kontak..."
6. "Menganalisis pain points dengan konteks penuh..."
7. "Cross-checking data dari multiple sources..."
8. "Menyusun profil final dengan citation..."
```

### 3.5 Error Handling Wajib
```typescript
try {
  const data = await generateReconProfile(url, mode)
  return { data, error: null }
} catch (err) {
  console.error('[Recon] Profile fetch failed:', err)
  return { data: null, error: 'Gagal memuat profil. Coba lagi.' }
}
```

### 3.6 Yang Tidak Boleh Di-generate
- Komponen yang tidak ada di `specs.md` tanpa diskusi dulu
- Library baru yang tidak ada di `architecture.md` tanpa diskusi dulu
- Hardcoded API key — selalu dari `.env.local`
- Teks "M1", "M2" dst. di UI

> Catatan: aturan lama "tidak boleh landing page / sign up flow" sudah **dihapus** karena Campfire kini multi-tenant SaaS. Landing page komersial dan registration flow termasuk Phase 2 commercialization.

---

## 4. Multi-Tenancy (Phase 1 — DONE)

Semua tabel data utama (`companies`, `contacts`, `pain_points`, `news`, `intent_signals`, `products`, `campaigns`, `campaign_emails`, `matching_results`, `campaign_analytics`, `email_analytics`, `user_profiles`) punya kolom `user_id UUID` dengan FK ke `auth.users(id)` dan RLS policy `user_owns_row` (`auth.uid() = user_id`). Migration: [supabase/migrations/018_multi_tenancy.sql](supabase/migrations/018_multi_tenancy.sql).

**Aturan saat menulis kode:**
- **Frontend INSERT wajib include `user_id`.** Pakai `getCurrentUserId()` dari [lib/supabase/client.ts](lib/supabase/client.ts) — throw kalau belum login.
- **SELECT/UPDATE tidak perlu diubah** — RLS auto-filter via anon key.
- **Backend Supabase write wajib include `user_id`** (backend pakai service role key yang bypass RLS — kalau lupa user_id, data bakal "leak" tanpa scope user).
- **Frontend pass `user_id` di body setiap POST ke backend.** Pydantic schemas (`ReconRequest`, `MatchRequest`, `CraftRequest`, `RewriteRequest`, `ProReconRequest`) sudah punya field `user_id: Optional[str]`.
- **Auto-analytics triggers** (`fn_auto_create_campaign_analytics`, `fn_auto_create_email_analytics`) propagate `user_id` parent → child otomatis. Jangan bypass.
- **Dev bypass:** set `NEXT_PUBLIC_AUTH_DEV_BYPASS=true` di `.env.local` kalau perlu jalan tanpa login. Default OFF.

---

## 5. Aturan Desain

- **Komponen**: shadcn/ui — WAJIB, jangan buat dari scratch
- **Font**: Geist Sans (bundle Next.js 14)
- **Ikon**: Lucide React saja
- **Chart**: Recharts
- **Color Palette**:
  - `brand`: `#0F6E56` (teal)
  - `brand-light`: `#E1F5EE`
  - `success`: `#1D9E75`
  - `warning`: `#BA7517`
  - `danger`: `#D85A30`
  - `info`: `#185FA5`
  - `pro-accent`: `#534AB7` (purple) — untuk badge dan indicator Pro
- **Severity Labels**: high=`#D85A30`, medium=`#BA7517`, low=`#1D9E75`

### 5.4 Tombol
- Maksimal 1 primary button per halaman
- Label Bahasa Indonesia, action-oriented: "Generate Profil", bukan "Submit"
- Destructive actions wajib konfirmasi dialog

---

## 6. Fitur Kritis yang Tidak Boleh Dilupakan

### 6.1 Recon Mode Selector
Di `ReconForm.tsx`, sebelum tombol Generate:
```
[ Free  ] [ Pro ✦ ]   ← toggle, default Free
```
- **Free**: gratis, hasil decent, 4 step loading
- **Pro**: konsumsi lebih banyak kredit, hasil excellent, 8 step loading, badge "Pro Analysis" di output

### 6.2 Research Library
Post-save dari Recon → redirect ke `/recon/[id]` (Review Profil), bukan `/research-library`. Research Library tetap entry point dari sidebar untuk semua riset tersimpan.

### 6.3 PIC Contacts
Wajib tampil di kolom kanan atas Recon output. Minimal 2, maksimal 3 kontak.
Setiap kontak: nama, jabatan, email (mailto), telepon, prospect score (badge), reasoning.

### 6.4 Citation Links di News
Setiap news item wajib punya link klikabel, buka tab baru. Bukan badge "terverifikasi".

### 6.5 Product Catalog di Match
Dua tab: "Matching" dan "Katalog Produk". CRUD + PDF drag & drop di tab kedua. **Jangan split jadi route terpisah.**

---

## 7. Happy Path yang Harus Selalu Bisa Dijalankan

```
1. Login (email + password) → onboarding 3-step (kalau belum) → /research-library
2. "Recon Baru" → session.clearActiveTarget() → /recon → input URL → Generate
3. Auto-redirect ke /recon/[id] (Review Profil): contacts PIC, pain points, news dengan link citation
4. Klik "Lanjutkan ke Match" → /match
5. Tab "Matching": run matching → lihat produk + reasoning
6. Tab "Katalog Produk": tambah/edit/hapus produk, upload PDF
7. → /craft → generate email sequence
8. → /polish → edit & approve per email
9. → /launch → pilih mode, aktifkan scheduling
10. → /pulse → lihat analytics dashboard
```

"Recon Baru" dan "Ganti Target" wajib panggil `session.clearActiveTarget()` sebelum navigate ke `/recon`.

---

## 8. Checklist Sebelum Declare Selesai

- [ ] Semua teks UI dalam Bahasa Indonesia
- [ ] Tidak ada "M1", "M2" dst. di UI
- [ ] Recon mode selector berfungsi (Free/Pro)
- [ ] Loading state step-by-step ada
- [ ] Error state informatif ada
- [ ] Empty state ada dan tidak blank
- [ ] Semua tombol punya handler yang berfungsi
- [ ] Frontend INSERT include `user_id` (multi-tenancy)
- [ ] Backend POST receive `user_id` di body kalau bakal write ke Supabase
- [ ] `npx tsc --noEmit` pass

---

## 9. Phase 2 Billing — DONE (Stripe Pay-As-You-Go Credits)

**Tabel:** `user_credits` (saldo per user) + `credit_transactions` (ledger). Migration: [supabase/migrations/019_billing.sql](supabase/migrations/019_billing.sql) + [020_signup_credit_grant.sql](supabase/migrations/020_signup_credit_grant.sql).

**Cost per operasi** (sumber tunggal di [backend/app/core/billing.py](backend/app/core/billing.py) `OpCost`):
- Recon Free = 1, Recon Pro = 5, Match = 1, Craft = 2, Polish (rewrite tone) = 1.

**Credit packs** (di `CREDIT_PACKS` constant):
- Starter 50 credits / Rp 100.000 · Growth 200 credits / Rp 350.000 (recommended) · Scale 500 credits / Rp 750.000.

**API:**
- `GET /api/billing/packages` (public) · `GET /api/billing/balance` (auth) · `POST /api/billing/checkout` · `POST /api/webhooks/stripe` (signature-verified, idempotent).

**Frontend:**
- [/pricing](app/(shell)/pricing/page.tsx) — paket + saldo + simulasi biaya.
- [/billing/success](app/(shell)/billing/success/page.tsx) — polling balance ~9 detik setelah checkout.
- Sidebar widget "Credits" auto-refresh via event `campfire_credits_changed` setelah setiap AI op + on-focus.

**Aturan saat coding:**
- Frontend AI calls (Recon/Match/Craft/Rewrite) wajib panggil `notifyCreditsChanged()` dari [lib/api/credits.ts](lib/api/credits.ts) setelah response 2xx — sudah terpasang di `recon.ts`, `match.ts`, `craft.ts`.
- New user otomatis dapat 5 credits free via DB trigger `trg_grant_signup_credits`.
- Kalau ingin ubah harga/cost: cukup edit `OpCost` atau `CREDIT_PACKS` di `backend/app/core/billing.py`. Frontend baca via `/api/billing/packages` jadi otomatis sinkron.

**Env vars wajib (`.env.local`):**
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Setup local webhook testing:** `stripe listen --forward-to localhost:8000/api/webhooks/stripe`. Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

---

## 10. Soft Cap (Anti-Monolith)

Pertahankan ukuran file di bawah ~200–250 baris. Jika sebuah komponen (mis: `page.tsx`) mulai membesar, ekstrak UI ke folder `/components`. State/logika tetap di page file — jangan buat hook baru kecuali logikanya benar-benar reusable lintas halaman. Satu-satunya hook aktif saat ini adalah `use-catalog.ts` (dipakai oleh `ProductCatalogTab`). Jangan memecah komponen secara tidak logis hanya demi memenuhi batas baris ini.
