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

## Recon Mode di Mock Data

Di mock mode, kedua mode (Free dan Pro) return data yang sama dari `mockdata.json` (atau variasi `reconModePro`).
Perbedaannya ada di **UI** — loading steps, source kontak, dan badge yang berbeda.

```typescript
// lib/api/recon.ts
export async function generateReconProfile(
  url: string,
  mode: 'free' | 'pro' = 'free'
): Promise<CompanyProfile> {
  if (USE_MOCK) {
    // Simulasi delay berbeda untuk tiap mode
    const delay = mode === 'pro' ? 6000 : 3000
    await new Promise(r => setTimeout(r, delay))
    return { ...mockData.company, url, reconMode: mode } as CompanyProfile
  }
  return await fetch(`${API_URL}/api/recon`, {
    method: 'POST',
    body: JSON.stringify({ url, mode })
  }).then(r => r.json())
}
```

---

## Cara Demo Dua Mode

**Skenario demo yang disarankan:**

1. **Demo Free mode** → input URL → pilih Free → generate (loading 4 steps ~3 detik)
   - Tunjukkan profil dengan badge "Free"
   - Kontak mungkin tidak punya email/telp (source: "web")
   - Pain points 3–4 item

2. **Demo Pro mode** → input URL yang sama → pilih Pro ✦ → generate (loading 8 steps ~6 detik)
   - Tunjukkan profil dengan badge "Pro ✦" (warna purple)
   - Kontak verified dari Apollo dengan prospect score dan reasoning
   - Pain points 4–5 item, lebih detail
   - News lebih banyak

Untuk demo ini, keduanya return `mockData.company` yang sama.
Perbedaan visual ada di loading animation dan badge saja.

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
├── reconMode           string    — "free" | "pro" (BARU)
├── linkedin { followers, employees, growth }
│
├── contacts[]
│   ├── id              string
│   ├── name            string    — nama lengkap
│   ├── title           string    — jabatan
│   ├── email           string    — format email valid, klikabel mailto:
│   ├── phone           string    — format "+62 8XX-XXXX-XXXX"
│   ├── linkedinUrl     string?   — opsional
│   ├── prospectScore   number    — 0-100 (Pro: 60-100, Free: 0)
│   ├── reasoning       string    — 1 kalimat (Pro), Kosong (Free)
│   └── source          string    — "web" | "apollo" | "apify" (BARU)
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
│   └── url             string    — wajib ada, untuk citation link
│
├── campaignProgress
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
4. LeadScan (lead enrichment) (source: pdf)
5. FlowDesk (sales workflow)

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
Saat user upload PDF dan klik "Ekstrak" → tampilkan form pre-filled.

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

---

## Cara Ganti Target Company

1. Update `company.*` — nama, industri, ukuran, dll.
2. Update `company.contacts[]` — 2-3 kontak dengan source yang sesuai
3. Update `company.painPoints[]` — pastikan ada angka konkret
4. Update `company.news[]` — sesuaikan dengan company baru, pastikan `url` ada
5. Update `matchingResults[].reasoning` — referensi data company baru
6. Update `campaign.emails[].body` — pastikan nama company di body ikut berubah
7. Update `researchLibrary[0]` — konsisten dengan company

---

## Cara Demo Fitur Product Catalog

**Skenario demo yang disarankan:**

1. **Lihat catalog** — tampilkan 5 produk default
2. **Edit produk** — klik Edit pada "CampaignAI Pro", ubah harga, klik simpan
3. **Hapus produk** — hapus "FlowDesk" (produk ke-5), konfirmasi, lihat hilang dari list
4. **Tambah manual** — isi form baru, simpan, lihat produk baru muncul di list
5. **Upload PDF** — drag & drop file apapun ke drop zone, klik ekstrak,
   lihat form pre-filled dari `pdfExtractionMock`, edit dan simpan

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

// Prospect score variant
export const getProspectScoreVariant = (score: number): 'success' | 'warning' | 'neutral' => {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'neutral'
}

// Recon mode badge
export const getReconModeBadge = (mode: 'free' | 'pro') => ({
  label: mode === 'pro' ? 'Pro ✦' : 'Free',
  variant: mode === 'pro' ? 'pro' : 'neutral'
})

// Progress label
export const getMilestoneLabel = (key: string): string => {
  const labels: Record<string, string> = {
    recon: 'Recon', match: 'Match', craft: 'Craft',
    polish: 'Polish', launch: 'Launch', pulse: 'Pulse'
  }
  return labels[key] ?? key
}
```
