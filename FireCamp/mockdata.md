# mockdata.md — Mock Data Guide

> Panduan penggunaan dan perluasan mock data untuk **Campfire**.

---

## Filosofi

Satu file, satu sumber kebenaran: `mockdata.json`.
Jangan buat data fiktif di dalam komponen. Jika butuh data baru, tambahkan ke `mockdata.json` dulu.

---

## Struktur Top-Level

| Key | Digunakan di | Keterangan |
|---|---|---|
| `researchLibrary` | `/research-library` | Daftar profil yang sudah disimpan |
| `company` | `/recon` | Profil lengkap target company |
| `productCatalog` | `/match` — Tab Katalog | 5 produk yang bisa di-edit/hapus |
| `matchingResults` | `/match` — Tab Matching | Hasil AI matching dengan reasoning |
| `pdfExtractionMock` | `/match` — Upload PDF | Hasil simulasi ekstraksi dokumen |
| `campaign` | `/craft` | Email sequence yang di-generate |
| `schedule` | `/launch` | Jadwal pengiriman per email |
| `analytics` | `/pulse` | Data tracking performa |

---

## Detail Struktur Per Milestone

### Research Library — `researchLibrary[]`

```
researchLibrary[]
├── id              string    — ref ke company.id
├── name            string    — nama perusahaan
├── industry        string
├── hq              string    — kota saja
├── savedAt         string    — ISO timestamp (untuk sort terbaru di atas)
├── painPointsCount number    — jumlah pain points (tampil sebagai badge)
└── progress
    ├── recon       boolean
    ├── match       boolean
    ├── craft       boolean
    ├── polish      boolean
    ├── launch      boolean
    └── pulse       boolean
```

**Cara menambah profil ke Research Library:**
Setiap kali user klik "Simpan ke Database" di Recon, tambahkan entry ke `researchLibrary[]`.
Untuk mock: cukup update state di React, tidak perlu persist ke localStorage.

---

### Recon — `company`

```
company
├── id, url, name, industry, size, founded, hq, description
├── linkedin { followers, employees, growth }
│
├── contacts[]          ← BARU
│   ├── id              string
│   ├── name            string    — nama lengkap
│   ├── title           string    — jabatan
│   ├── email           string    — format email valid, klikabel mailto:
│   ├── phone           string    — format "+62 8XX-XXXX-XXXX"
│   ├── linkedinUrl     string?   — opsional
│   ├── prospectScore   number    — 0-100
│   └── reasoning       string    — 1 kalimat, mengapa kontak ini relevan
│
├── painPoints[]
│   ├── category        "Marketing"|"Operations"|"Technology"|"Growth"
│   ├── issue           string    — wajib ada angka/persentase konkret
│   └── severity        "high"|"medium"|"low"
│
├── news[]
│   ├── title           string
│   ├── date            string    — "DD Mon YYYY"
│   ├── source          string
│   ├── summary         string    — 1-2 kalimat
│   └── url             string    ← BARU — wajib ada, untuk citation link
│
├── campaignProgress    ← BARU — untuk progress indicator
│   └── { recon, match, craft, polish, launch, pulse } : boolean
│
└── createdAt, cachedAt
```

**Tentang `prospectScore`:**
- 80–100: Decision maker utama → tampilkan badge hijau
- 60–79: Influencer/champion → tampilkan badge kuning
- < 60: Tidak ditampilkan ke user

**Tentang `news.url`:**
Gunakan URL realistis tapi fiktif (format valid, tapi tidak harus bisa dibuka).
Untuk demo, ini cukup — yang penting UI menampilkan link yang terlihat nyata.

---

### Match — `productCatalog[]`

```
productCatalog[]
├── id              string    — "prod-001" dst.
├── name            string
├── tagline         string    — maksimal 60 karakter
├── description     string    — minimal 50 karakter
├── price           string    — "Rp X.XXX.XXX / bulan"
├── painCategories  string[]  — subset dari ["Marketing","Operations","Technology","Growth"]
├── usp             string[]  — array poin USP
├── source          "manual"|"pdf"  — bagaimana produk diinput
├── createdAt       string
└── updatedAt       string
```

**Catalog berisi 5 produk default:**
1. CampaignAI Pro (email automation)
2. InsightDash (analytics)
3. RetainIQ (churn prediction)
4. LeadScan (lead enrichment)
5. FlowDesk (sales workflow)

Produk 1-3 adalah primary catalog, 4-5 adalah tambahan untuk demo CRUD.
User bisa hapus produk 4-5 untuk demo delete, lalu tambah lagi untuk demo add.

---

### Match — `matchingResults[]`

```
matchingResults[]
├── productId           string    — ref ke productCatalog[].id
├── matchScore          number    — 0-100
├── addressedPainIndices number[] — index ke company.painPoints[]
├── reasoning           string    — paragraf 3-5 kalimat, spesifik ke target company
└── isRecommended       boolean   — true hanya untuk 1 produk
```

**Catatan:** Hanya 3 produk yang ada di matchingResults (prod-001, 002, 003).
LeadScan dan FlowDesk tidak muncul di matching hasil karena score < 70 untuk profile ini.
Ini realistis — tidak semua produk akan match untuk setiap company.

---

### Match — `pdfExtractionMock`

```
pdfExtractionMock
├── extractedName           string
├── extractedTagline        string
├── extractedDescription    string
├── extractedPrice          string
├── extractedUsp            string[]
└── confidence              number    — 0-100, seberapa yakin AI
```

**Cara pakai di UI:**
Saat user upload PDF dan klik "Ekstrak" → setelah loading → tampilkan form pre-filled
dari `pdfExtractionMock`. User bisa edit sebelum klik "Simpan ke Katalog".
Tambahkan note kecil: "Confidence: 87% — harap review sebelum menyimpan."

---

### Craft — `campaign`

```
campaign
├── reasoning       string    — penjelasan strategi
├── targetCompany   string
├── createdAt       string
└── emails[]
    ├── id, sequenceNumber, dayLabel, scheduledDay
    ├── subject         string
    ├── body            string    — "\n" untuk line break, "[Nama]" sebagai placeholder
    ├── tone            "profesional"|"friendly"|"direct"|"storytelling"
    └── isApproved      boolean   — default: false
```

**Perubahan dari versi sebelumnya:**
- `dayLabel` sekarang "Hari ke-1", "Hari ke-4", "Hari ke-10" (Bahasa Indonesia)
- Body email menggunakan "Campfire" (bukan "Antigravity")

---

### Analytics — `analytics.tokenUsage`

```
tokenUsage
├── recon           number    — token untuk profiling (45K)
├── match           number    — token untuk matching (12K)
├── craft           number    — token untuk campaign gen (28K)
├── total           number    — sum semua (85K)
└── estimatedCostIDR number  — dalam Rupiah (12750)
```

**Perubahan dari versi sebelumnya:**
- Key diubah dari "profiling/matching/campaignGen" ke "recon/match/craft"
- Konsisten dengan milestone naming baru

---

## Cara Ganti Target Company

1. Update `company.*` — nama, industri, ukuran, dll.
2. Update `company.contacts[]` — 2-3 kontak dengan email/phone format yang konsisten
3. Update `company.painPoints[]` — pastikan ada angka konkret di setiap issue
4. Update `company.news[]` — sesuaikan dengan company baru, pastikan `url` ada
5. Update `matchingResults[].reasoning` — harus referensi data company baru
6. Update `campaign.emails[].body` — pastikan nama company di body ikut diganti
7. Update `researchLibrary[0]` — name, industry, hq harus konsisten dengan company

---

## Cara Demo Fitur Product Catalog

**Skenario demo yang disarankan:**

1. **Lihat catalog** — tampilkan 5 produk default
2. **Edit produk** — klik Edit pada "CampaignAI Pro", ubah harga, klik simpan
3. **Hapus produk** — hapus "FlowDesk" (produk ke-5), konfirmasi, lihat hilang dari list
4. **Tambah manual** — isi form baru, simpan, lihat produk baru muncul di list
5. **Upload PDF** — drag & drop file apapun ke drop zone, klik ekstrak,
   lihat form pre-filled dari `pdfExtractionMock`, edit dan simpan

Untuk poin 5, file yang di-drop tidak perlu diproses — cukup tampilkan nama file
dan langsung mock delay 2 detik sebelum show form pre-filled.

---

## Helper Functions (lib/utils.ts)

```typescript
// Format Rupiah
export const formatRupiah = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0
  }).format(amount)

// Format token
export const formatToken = (count: number): string =>
  count >= 1000 ? `~${Math.round(count / 1000)}K tokens` : `${count} tokens`

// Format tanggal Indonesia
export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

// Prospect score color
export const getProspectScoreColor = (score: number): string => {
  if (score >= 80) return 'success'   // hijau
  if (score >= 60) return 'warning'   // kuning
  return 'neutral'
}

// Progress label
export const getMilestoneLabel = (key: string): string => {
  const labels: Record<string, string> = {
    recon: 'Recon', match: 'Match', craft: 'Craft',
    polish: 'Polish', launch: 'Launch', pulse: 'Pulse'
  }
  return labels[key] ?? key
}
```
