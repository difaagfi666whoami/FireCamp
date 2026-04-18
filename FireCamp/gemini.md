# gemini.md — Campfire AI Rules

> File ini adalah instruksi utama untuk Gemini saat vibe coding project **Campfire**.
> Baca file ini sebelum menulis satu baris kode pun. Semua keputusan teknis, desain,
> dan struktur harus konsisten dengan rules di bawah.

---

## 1. Project Identity

| Atribut | Detail |
|---|---|
| Nama | Campfire |
| Tagline | Research. Match. Send. — B2B outreach dari riset ke kirim dalam satu tempat. |
| Stage | Internal demo → production untuk 1 client B2B |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | Supabase (PostgreSQL + pgvector) |
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
Jangan mulai milestone berikutnya sebelum yang sebelumnya fully functional dengan mock data.

### 3.2 Mock Data First Pattern
```typescript
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

async function generateReconProfile(url: string, mode: 'free' | 'pro' = 'free') {
  if (USE_MOCK) return mockData.company          // selalu mock dulu
  return await fetch(`${API_URL}/api/recon`, {
    method: 'POST',
    body: JSON.stringify({ url, mode })          // kirim mode ke FastAPI
  })
}
```

### 3.3 Recon Mode Rules
- **Free mode** adalah default. Selalu tampilkan mode selector di ReconForm.
- **Pro mode** harus ada visual indicator yang jelas (badge "Pro", warna berbeda, loading steps lebih banyak).
- Di mock mode, keduanya return data yang sama tapi UI-nya berbeda (loading steps dan badge).
- Di production, Free dan Pro memanggil endpoint FastAPI yang sama (`POST /api/recon`) tapi dengan field `mode: "free" | "pro"` di request body.

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
- Landing page atau marketing page
- User registration / sign up flow (auth hanya login via email invite)
- Komponen yang tidak ada di `specs.md`
- Library baru yang tidak ada di `architecture.md`
- Hardcoded API key — selalu dari `.env.local`
- Teks "M1", "M2" dst. di UI

---

## 4. Aturan Desain

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

### 4.4 Tombol
- Maksimal 1 primary button per halaman
- Label Bahasa Indonesia, action-oriented: "Generate Profil", bukan "Submit"
- Destructive actions wajib konfirmasi dialog

---

## 5. Fitur Kritis yang Tidak Boleh Dilupakan

### 5.1 Recon Mode Selector
Di `ReconForm.tsx`, sebelum tombol Generate:
```
[ Free  ] [ Pro ✦ ]   ← toggle, default Free
```
- **Free**: gratis, hasil decent, 4 step loading
- **Pro**: konsumsi lebih banyak kredit, hasil excellent, 8 step loading, badge "Pro Analysis" di output

### 5.2 Research Library
Post-save dari Recon → redirect ke `/research-library`, bukan hanya toast. Research Library adalah halaman utama semua riset tersimpan.

### 5.3 PIC Contacts
Wajib tampil di kolom kanan atas Recon output. Minimal 2, maksimal 3 kontak.
Setiap kontak: nama, jabatan, email (mailto), telepon, prospect score (badge), reasoning.

### 5.4 Citation Links di News
Setiap news item wajib punya link klikabel, buka tab baru. Bukan badge "terverifikasi".

### 5.5 Product Catalog di Match
Dua tab: "Matching" dan "Katalog Produk". CRUD + PDF drag & drop di tab kedua.

---

## 6. Happy Path yang Harus Selalu Bisa Dijalankan

```
1. Login → /research-library (halaman utama)
2. "Recon Baru" → session.clearActiveTarget() → /recon → input URL → Generate
3. Auto-redirect ke /recon/[id] (Review Profil): contacts PIC, pain points, news dengan link citation
4. Klik "Lanjutkan ke Match" → /match
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
- [ ] Recon mode selector berfungsi (Free/Pro)
- [ ] Loading state step-by-step ada
- [ ] Error state informatif ada
- [ ] Empty state ada dan tidak blank
- [ ] Semua tombol punya handler yang berfungsi
- [ ] Mock data berjalan sempurna
- [ ] `tsc --noEmit` pass

---

## 8. Soft Cap
Aturan Anti-Monolith: Pertahankan ukuran file di bawah ~200-250 baris. Jika sebuah komponen (misal: page.tsx) mulai membesar, ekstrak UI ke dalam folder `/components`. State/logika tetap di page file — jangan buat hook baru kecuali logikanya benar-benar reusable lintas halaman. Satu-satunya hook aktif saat ini adalah `use-catalog.ts` (dipakai oleh ProductCatalogTab). Jangan memecah komponen secara tidak logis hanya demi memenuhi batas baris ini.


