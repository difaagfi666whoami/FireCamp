# Updates

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
