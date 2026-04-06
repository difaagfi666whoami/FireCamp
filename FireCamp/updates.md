# Updates

## Strategic Intelligence Overhaul — Recon (2026-04-06)

### Fase 1: Data Contract
- `types/recon.types.ts` — tambah interface `StrategicReport` (strategicTitle, executiveInsight, internalCapabilities, marketDynamics, strategicRoadmap) + field opsional `strategicReport?` di `CompanyProfile`.
- `backend/app/models/schemas.py` — tambah Pydantic model `StrategicReport` (camelCase, mirror 1:1 dengan TS interface) + field `strategicReport: Optional[StrategicReport] = None` di `CompanyProfile`.

### Fase 2: Backend AI Synthesis
- `backend/app/services/openai_service.py` — persona system_prompt diubah menjadi "Senior Business Intelligence Analyst & Strategic Consultant". Instruksi baru ditambahkan untuk menghasilkan seluruh sub-field `strategicReport` via OpenAI Structured Output (response_format=CompanyProfile, yang kini embed StrategicReport sebagai nested model). Semua aturan lama (pain points, contacts, news inject, LinkedIn) dipertahankan.

### Fase 3: Frontend UI Overhaul
- `app/recon/components/CompanyHeader.tsx` — dirombak total menjadi strategic header: company identity bar minimalis, strategicTitle sebagai `text-2xl font-bold`, executiveInsight sebagai blockquote dengan `border-l-4 border-brand`. Fallback ke description lama jika strategicReport null.
- `app/recon/components/StrategicMainContent.tsx` — komponen baru. Render tiga blok narasi: Kapabilitas Internal, Dinamika Pasar, dan Roadmap Strategis (numbered list).
- `app/recon/components/StrategicSidebar.tsx` — komponen baru. Render Key Metrics (LinkedIn followers/employees/growth) dan Core Identity (Industry, HQ, size, founded) secara minimalis dan padat.
- `app/recon/page.tsx` — hasil section diubah ke layout split-view `grid-cols-12`: kolom utama `md:col-span-8` (StrategicMainContent + PainPointList), kolom sidebar `md:col-span-4` (StrategicSidebar + KeyContacts + NewsSection).
- `npx tsc --noEmit` — lulus tanpa error.

## Scaffolding Selesai
- Konfigurasi `tailwind.config.ts` lengkap dengan color palette `brand` dan `severity`, typography, dan fonts berdasarkan `architecture.md`.
- `.env.local` dengan variable `NEXT_PUBLIC_USE_MOCK=true` dan `NEXT_PUBLIC_APP_NAME` telah dibuat.
- Mock data dari `data/mockdata.json` sudah di-wrap di `lib/mock/mockdata.ts`.
- TypeScript interface (`CompanyProfile`, `ProductCatalogItem`, dll) untuk semua tipe data telah dibuat dan tersebar rapi (`recon.types.ts`, `match.types.ts`, `craft.types.ts`, `analytics.types.ts`).
- Root Layout (`/app/layout.tsx`) telah di-setup dengan Sidebar navigasi (`/components/layout/Sidebar.tsx`) yang tampil global.
- Navigasi root (`/`) otomatis redirect ke `/research-library`.
- Struktur folder halaman fitur kosong siap diisi (`/research-library`, `/recon`, `/match`, `/craft`, `/polish`, `/launch`, `/pulse`).

## Research Library
- Membangun komponen UI modular `CampaignProgress` dan `ProfileCard` di `components/research-library`.
- Menerapkan helper formatting untuk string dan progress label di `lib/utils.ts`.
- Menyusun halaman utama `/research-library/page.tsx` untuk menampilkan grid profil yang mengambil data langsung dari `mockdata.ts`.
- Menyediakan desain khusus untuk Empty State (ketika profil kosong).

## Recon (Company Profiling)
- Mengimplementasi layout utama di `/recon/page.tsx` menggunakan status step-by-step loading animation yang informatif tanpa spinner generik (menggunakan lucide icons).
- Memecah UI ke dalam subkomponen Anti-Monolith di `app/recon/components`:
  - `ReconForm`: Input target URL dengan responsibilitas disabled state.
  - `CompanyHeader`: Data perusahaan & KPI metrik dari LinkedIn.
  - `KeyContacts`: Menampilkan daftar kontak PIC relevan lengkap dengan Badge prospect score dan ikon kontak.
  - `PainPointList`: Analisis pain points yang diberi style dinamis berdasarkan *severity* (High, Medium, Low).
  - `NewsSection`: Menampilkan sinyal bisnis serta menyematkan `CitationLink` (shared components) menuju artikel.
- Menyediakan sub-halaman `/recon/[id]/page.tsx` sebagai tampilan profil statis hasil dari library tanpa fitur generate ulang.
- Integrasi push notification menggunakan `sonner` dan dipasang ke dalam Global `RootLayout`.

## Match (Product Matching)
- Mengimplementasikan `tabs` UI layout di `/match/page.tsx` yang membagi halaman menjadi "Matching AI" dan "Katalog Produk".
- Menerapkan arsitektur Anti-Monolith dengan subkomponen:
  - `MatchingTab`: Menangani *state* simulasi agen AI mencocokkan pain points dengan produk, lengkap dengan `LoadingSteps`.
  - `ProductMatchCard`: Kartu hasil matching yang mendetailkan **Target Pain Point** beserta AI Reasoning dengan Badge persentase skor kecocokan yang dinamis.
  - `ProductCatalogTab`: Tampilan full CRUD (tanpa database sungguhan) untuk melihat mock-up data katalog layanan, mengedit via modal, atau hapus item.
  - `ProductFormModal`: Dialog modal yang memiliki input form & textarea untuk memasukkan/mengedit layanan secara terstruktur.
  - `PdfUploadZone`: Simulator area *drag-and-drop* file PDF ("Brosur") yang memunculkan delay ekstraksi, lalu menyisipkan 3 produk simulasi ke dalam tabel secara otomatis.

## Launch (Automation Setup)
- Membangun halaman `/launch/page.tsx` dengan layout header, mode selector, dan konten dinamis per mode.
- Menerapkan arsitektur Anti-Monolith dengan 3 subkomponen di `app/launch/components`:
  - `ModeSelector`: Dua kartu tombol untuk beralih antara mode "One-click AI Automation" dan "Manual Scheduling". State aktif ditandai dengan border dan background `brand`.
  - `AiScheduleView`: Kartu "Rekomendasi AI" berisi reasoning jadwal, diikuti daftar 3 jadwal non-editable. Setiap item memiliki animated pulsing dot hijau saat campaign diaktifkan, beserta badge "Terjadwal". Tombol **[Aktifkan Automation]** berganti menjadi banner konfirmasi hijau setelah diklik.
  - `ManualScheduleForm`: Form 3 baris jadwal (satu per email) dengan `date` dan `time` picker native HTML. Validasi inline memastikan setiap email dijadwalkan **setelah** email sebelumnya — jika tidak, error message merah muncul di bawah baris yang konflik. Tombol **[Simpan Jadwal & Aktifkan]** disabled jika ada error atau field kosong.
- Data jadwal default diambil dari objek `schedule` di `data/mockdata.json` melalui `lib/mock/mockdata.ts`.
- Setelah campaign diaktifkan: floating action bar muncul di bottom dengan CTA navigasi ke `/pulse`.

## Pulse (Campaign Analytics)
- Membangun halaman `/pulse/page.tsx` sebagai dashboard analytics penutup pipeline, dengan layout header + stat cards + dua chart + status list + token usage.
- Install library `recharts@3.8.1` untuk komponen chart.
- Update `lib/mock/mockdata.ts` untuk mengekspos `summary`, `perEmail`, dan `timeline` dari objek `analytics` di `mockdata.json`.
- Menerapkan arsitektur Anti-Monolith dengan 4 subkomponen di `app/pulse/components`:
  - `StatCards`: Grid 4 kartu metrik — Email Dikirim, Open Rate, Click Rate, Reply Rate. Setiap kartu rate dilengkapi `BenchmarkBadge` yang secara dinamis menampilkan selisih persentase (hijau jika di atas benchmark, merah jika di bawah) dibandingkan `industryBenchmarks` dari mock data.
  - `PerformanceBarChart`: Bar chart (recharts `BarChart`) menampilkan Opens, Clicks, dan Replies per email. Tooltip custom dengan styling konsisten, bar dengan radius rounded, dan warna per metrik (biru/ungu/hijau).
  - `EngagementLineChart`: Line chart (recharts `LineChart`) menampilkan tren engagement Opens dan Clicks per hari. Line Clicks menggunakan `strokeDasharray` untuk membedakan secara visual. Tooltip custom seragam dengan BarChart.
  - `TokenUsageCard`: Kartu rincian token AI per tahap (Recon/Match/Craft) dengan progress bar visual berbasis persentase. Di bagian bawah: total token (`formatToken`) dan estimasi biaya dalam Rupiah (`formatRupiah`) di dalam highlight box amber.
- Status list per email (Replied / Opened / Sent) dengan badge berwarna ditampilkan langsung di `page.tsx` sesuai batasan komponen di `architecture.md`.

---
## Status Pembangunan UI — SELESAI
Seluruh 6 halaman pipeline Campfire (Research Library, Recon, Match, Craft, Polish, Launch, Pulse) kini telah selesai dibangun. Aplikasi berjalan penuh di atas mock data. Fase berikutnya adalah integrasi backend (FastAPI + Supabase + Claude API).

---

## Fase 2 — Integrasi Supabase

### Database Schema
- Migration SQL lengkap tersimpan di `supabase/migrations/001_initial_schema.sql`.
- 10 tabel: `companies`, `contacts`, `pain_points`, `news`, `products`, `campaigns`, `campaign_emails`, `matching_results`, `campaign_analytics`, `email_analytics`.
- Semua tabel menggunakan UUID, trigger `updated_at` otomatis, enum types, dan RLS diaktifkan.

### Koneksi Supabase dari Next.js
- Install: `npm install @supabase/supabase-js`
- `lib/supabase/client.ts` — singleton `createClient` berbasis env vars.
- Toggle mock/real via `NEXT_PUBLIC_USE_MOCK` di `.env.local`.

### Katalog Produk — CRUD live ke Supabase
- `lib/api/catalog.ts` — `getProducts`, `createProduct`, `updateProduct`, `deleteProduct`, `deleteProducts`. Otomatis toggle antara mock data dan Supabase berdasarkan `NEXT_PUBLIC_USE_MOCK`.
- `hooks/use-catalog.ts` — React hook dengan state `products`, `isLoading`, `error`, dan fungsi `add`, `edit`, `remove`, `removeBulk`. Toast notifikasi on success/error.
- `app/match/components/ProductCatalogTab.tsx` — Direfaktor penuh menggunakan `useCatalog`. Tambah loading skeleton dan error state dengan tombol retry.
- `app/match/components/ProductFormModal.tsx` — `onSave` sekarang menerima `ProductInput` (tanpa id) — ID sepenuhnya ditentukan database.

### Langkah Testing CRUD di Browser
1. Jalankan `supabase/migrations/001_initial_schema.sql` di SQL Editor Supabase.
2. Jalankan `supabase/migrations/002_rls_dev_policy.sql` (buka akses anon untuk dev).
3. Ubah `.env.local`: `NEXT_PUBLIC_USE_MOCK=false`
4. Restart dev server: `npm run dev`
5. Buka `/match` → tab "Katalog Produk" → test Tambah, Edit, Hapus produk.

### Recon Save + Research Library — Live ke Supabase
- `lib/api/recon.ts` — 3 fungsi: `saveCompanyProfile`, `getResearchLibrary`, `deleteCompanyProfile`. Auto-toggle mock/real.
- `saveCompanyProfile`: Sequential INSERT ke `companies` → `contacts` → `pain_points` → `news`. DB generate UUID baru, `progress_recon=true` otomatis ter-set.
- `getResearchLibrary`: SELECT dari `companies` dengan embedded `pain_points(id)` untuk count, ORDER BY `created_at DESC`.
- `deleteCompanyProfile`: DELETE companies (CASCADE hapus contacts/pain_points/news otomatis).
- `app/recon/page.tsx`: `handleSave` sekarang async, punya `isSaving` state, tombol menampilkan spinner saat proses, redirect ke `/research-library` setelah sukses.
- `app/research-library/page.tsx`: Di-rewrite penuh — fetch dari `getResearchLibrary()`, loading skeleton, error state dengan retry, delete optimistic update dengan rollback.
- `supabase/migrations/003_rls_recon.sql`: RLS dev policies untuk `companies`, `contacts`, `pain_points`, `news`.

**Langkah untuk mengaktifkan:**
1. Jalankan `003_rls_recon.sql` di Supabase SQL Editor.
2. Pastikan `NEXT_PUBLIC_USE_MOCK=false` di `.env.local`.
3. Buka `/recon` → generate profil → klik "Simpan ke Database" → redirect ke `/research-library` → profil muncul dari database.

---

## Resilience Refactor — Pipeline & UI Hardening

### Lane B — Fallback Kontak (`backend/app/services/lane_b_service.py`)
- Tambah **Fallback Mechanism** setelah Tier 1–3 kosong: query luas `site:linkedin.com/in "{company_name}"` tanpa filter `_validate_contact_relevance`, ambil maksimal 2 kontak teratas.
- Fallback contacts di-hardcode `prospectScore = 50` dan `reasoning = "Ditemukan dari pencarian luas (low confidence). Harap verifikasi manual."` — langsung dikembalikan tanpa AI scoring.
- Tambah safety net post-scoring: jika semua kontak hasil AI memperoleh skor < 55 (terfilter), kembalikan raw_contacts dengan skor default 50 alih-alih array kosong.

### Lane C — Fallback Berita Industri (`backend/app/services/lane_c_service.py`)
- Tambah **Strategy 6** sebagai last-resort setelah Strategy 1–5 gagal.
- Jika `industry_hint` tersedia dan terdeteksi industri → query `"{industry} Indonesia tren teknologi 2025"`.
- Jika tidak ada industri terdeteksi → query generik `"bisnis Indonesia tren inovasi transformasi digital 2025"`.
- Semua artikel dari Strategy 6 otomatis ditandai `is_industry_news = True` dan diberi prefix `[Industri]` di judul.

### Frontend — CompanyHeader (`app/recon/components/CompanyHeader.tsx`)
- Tambah fungsi `isZeroValue()` untuk mendeteksi nilai kosong/nol (`"0"`, `"0%"`, `0`, `null`, `""`).
- **LinkedIn Stats block disembunyikan sepenuhnya** jika semua nilai (followers, employees, growth) adalah nol/kosong.
- Setiap stat ditampilkan secara individual — hanya stat yang punya nilai non-zero yang di-render.
- **Description** sekarang di-wrap dalam div `max-h-48 overflow-y-auto` agar dapat di-scroll jika konten panjang. Ditambah `whitespace-pre-line` untuk rendering baris baru dari AI output.
