# gemini.md — Campfire AI Rules

> File ini adalah instruksi utama untuk Gemini saat vibe coding project **Campfire**.
> Baca file ini sebelum menulis satu baris kode pun. Semua keputusan teknis, desain,
> dan struktur harus konsisten dengan rules di bawah.

---

## 1. Project Identity

**Nama Aplikasi:** Campfire
**Tagline:** Research. Match. Send. — B2B outreach dari riset ke kirim dalam satu tempat.
**Stage:** Internal tool demo → production untuk 1 client B2B
**Stack Target:** Next.js 14 + TypeScript + Tailwind CSS + Supabase + FastAPI + n8n (self-hosted)
**Bahasa UI:** Bahasa Indonesia (semua label, placeholder, tooltip, notifikasi)
**Bahasa Kode:** Inggris (variabel, fungsi, komentar kode)

---

## 2. Naming — Milestone Resmi

| ID Internal | Nama Tampil | Deskripsi Singkat |
|---|---|---|
| recon | Recon | Riset & profiling target company |
| match | Match | Pencocokan produk ke kebutuhan company |
| craft | Craft | Generate personalized email campaign |
| polish | Polish | Human review & edit sebelum kirim |
| launch | Launch | Automation & penjadwalan pengiriman |
| pulse | Pulse | Tracking & analytics performa campaign |

**Aturan penamaan — wajib diikuti:**
- Di sidebar navigation: gunakan nama tampil saja ("Recon", "Match", dll)
- Di URL routing: gunakan ID internal (`/recon`, `/match`, `/craft`, `/polish`, `/launch`, `/pulse`)
- Di kode (komponen, hooks, types): gunakan ID internal (`useRecon`, `MatchCard`, `CraftView`)
- Di pesan user-facing: gunakan nama tampil ("Selesaikan Recon terlebih dahulu...")
- **TIDAK BOLEH** menggunakan "M1", "M2" dst. di UI atau user-facing text manapun

---

## 3. Aturan Wajib untuk Gemini

### 3.1 Selalu Ikuti Urutan Ini Saat Generate Fitur Baru
1. Baca `specs.md` untuk memahami requirement fitur
2. Baca `architecture.md` untuk memastikan konsistensi komponen dan struktur
3. Gunakan mock data dari `mockdata.json` jika integrasi API belum tersedia
4. Tulis kode yang langsung berjalan tanpa modifikasi tambahan
5. Jangan buat file baru di luar struktur folder yang sudah ditentukan

### 3.2 Prioritas Pengembangan
```
Recon → Match → Craft → Polish → Launch → Pulse
```
Jangan mulai milestone berikutnya sebelum yang sebelumnya **fully functional dengan mock data**.

### 3.3 Mock Data First
```typescript
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

async function getCompanyProfile(url: string) {
  if (USE_MOCK) return mockData.company
  return await fetchRealAPI(url)
}
```

### 3.4 Yang Tidak Boleh Di-generate
- Landing page atau marketing page
- User registration / sign up flow (auth hanya login via email invite)
- Komponen yang tidak ada di `specs.md`
- Library baru yang tidak ada di `architecture.md`
- Hardcoded API key — selalu dari `.env.local`
- Teks "M1", "M2" dst. di UI

### 3.5 Error Handling Wajib
```typescript
try {
  const data = await fetchProfile(url)
  return { data, error: null }
} catch (err) {
  console.error('[Recon] Profile fetch failed:', err)
  return { data: null, error: 'Gagal memuat profil perusahaan. Coba lagi.' }
}
```

---

## 4. Aturan Desain & UI

### 4.1 Design System
- Framework: Tailwind CSS dengan config custom
- Komponen: shadcn/ui — WAJIB digunakan, jangan buat dari scratch
- Font: Geist Sans (bundle dengan Next.js 14)
- Ikon: Lucide React saja
- Chart: Recharts

### 4.2 Color Palette
```css
--color-brand: #0F6E56;
--color-brand-light: #E1F5EE;
--color-success: #1D9E75;
--color-warning: #BA7517;
--color-danger: #D85A30;
--color-info: #185FA5;
```

### 4.3 Loading State (Wajib step-by-step, bukan spinner)
```tsx
// BENAR
const steps = ["Mengambil data LinkedIn...", "Mencari kontak PIC...", "Analisis pain points..."]

// SALAH
<Spinner />
```

### 4.4 Tombol
- Maksimal 1 primary button per halaman
- Label Bahasa Indonesia, action-oriented: "Generate Profil", bukan "Submit"
- Destructive actions wajib konfirmasi dialog

---

## 5. Aturan Khusus Per Fitur

### 5.1 Research Library (Home setelah Save)
Setelah user simpan profil dari Recon → WAJIB navigate ke `/research-library`.
Bukan hanya toast. Research Library adalah halaman utama semua riset tersimpan.

### 5.2 Product Catalog di Match
Halaman `/match` punya **dua tab**:
- "Matching" — jalankan AI matching
- "Katalog Produk" — CRUD produk + PDF upload
Jangan buat halaman terpisah untuk catalog.

### 5.3 PIC Contacts di Recon
- Posisi: kolom kanan atas, di atas Recent News
- Jumlah: 2–3 kontak per profil
- Wajib ada: nama, jabatan, email, nomor telepon, prospect score, reasoning

### 5.4 Citation Links di News
- Setiap news item wajib punya link klikabel ke sumber
- Buka di tab baru: `target="_blank" rel="noopener noreferrer"`
- Tampilkan sebagai teks biru + ikon ExternalLink dari Lucide

---

## 6. Happy Path yang Harus Selalu Bisa Dijalankan

```
1. Login → /research-library (halaman utama)
2. "Recon Baru" → /recon → input URL → Generate
3. Lihat profil: contacts PIC, pain points, news dengan link citation
4. "Simpan ke Database" → redirect ke /research-library
5. Klik profil → "Mulai Campaign" → /match
6. Tab "Matching": run matching → lihat produk + reasoning
7. Tab "Katalog Produk": tambah/edit/hapus produk, upload PDF
8. → /craft → generate email sequence
9. → /polish → edit & approve per email
10. → /launch → pilih mode, aktifkan scheduling
11. → /pulse → lihat analytics dashboard
```

---

## 7. Checklist Sebelum Declare Selesai

- [ ] Semua teks UI dalam Bahasa Indonesia
- [ ] Tidak ada "M1", "M2" dst. di UI
- [ ] Loading state step-by-step ada
- [ ] Error state informatif ada
- [ ] Empty state ada dan tidak blank
- [ ] Semua tombol punya handler yang berfungsi
- [ ] Mock data berjalan sempurna
- [ ] `tsc --noEmit` pass

## 8. Soft Cap
Aturan Anti-Monolith: Pertahankan ukuran file di bawah ~200-250 baris. Jika sebuah komponen (misal: page.tsx) mulai membesar, ekstrak UI statis atau bagian yang bisa diulang ke dalam folder /components, dan ekstrak logika/state ke dalam folder /hooks. Namun, jangan memecah komponen secara tidak logis hanya demi memenuhi batas baris ini.