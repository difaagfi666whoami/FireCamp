# Campfire API Contract Document

Dokumen ini mendefinisikan *interface* (kontrak) komunikasi data antara Frontend (Next.js) dan Backend (FastAPI). Bentuk data ini dikurasi langsung dari tipe TypeScript *(types/)* yang digunakan di aplikasi Frontend saat ini.

Frontend memanggil endpoint menggunakan metode `fetch` secara *synchronous* saat loading screen. Backend **harus mengembalikan Response dengan format berstruktur JSON persis seperti di bawah**. Backend tidak menangani insert ke Supabase (itu tugas Frontend di *hybrid mode* saat ini), Backend HANYA bertugas sebagai AI Processing Engine.

**Base URL**: `http://localhost:8000` (saat local)

---

## 1. Endpoint Recon — Generate Company Profile
**URL**: `POST /api/recon`
**Tujuan**: Mengambil URL perusahaan dari user, melakukan *scraping/scraping AI*, mencari *pain points*, *news*, dan PIC.

### 📥 Request Body
```json
{
  "url": "https://example.com"
}
```

### 📤 Response Body (200 OK)
Mengembalikan representasi penuh dari data profil perusahaan. Seluruh field wajib dikembalikan (meskipun `string` kosong atau array `[]` jika tidak ditemukan).

```json
{
  "id": "mock-atau-uuid", 
  "url": "https://example.com",
  "name": "Nama Perusahaan",
  "industry": "Nama Industri",
  "size": "100-500",
  "founded": "2015",
  "hq": "Jakarta Selatan",
  "description": "Deskripsi singkat mengenai perusahaan...",
  "linkedin": {
    "followers": "10K",
    "employees": 120,
    "growth": "+5%"
  },
  "contacts": [
    {
      "id": "uuid-atau-unik-id",
      "name": "Budi Santoso",
      "title": "VP of Marketing",
      "email": "budi@example.com",
      "phone": "+62...",
      "linkedinUrl": "https://linkedin.com/in/...",
      "prospectScore": 85,
      "reasoning": "Decision maker untuk marketing..."
    }
  ],
  "painPoints": [
    {
      "category": "Marketing",
      "issue": "Penjelasan pain point spesifik",
      "severity": "high" // 'high' | 'medium' | 'low'
    }
  ],
  "news": [
    {
      "title": "Judul Berita",
      "date": "10 Jan 2026",
      "source": "Tech in Asia",
      "summary": "Ringkasan...",
      "url": "https://..."
    }
  ]
}
```
*(Catatan: Frontend mengabaikan `campaignProgress`, `createdAt`, dan `cachedAt` dari backend karena FE akan membuat versi DB-nya sendiri).*

---

## 2. Endpoint Match — Run AI Matching
**URL**: `POST /api/match`
**Tujuan**: Backend menerima profil perusahaan lengkap dari FE, lalu backend akan me-*load* seluruh produk dari DB/Katalog internalnya, dan me-*return* 3 rekomendasi *match* produk terbaik.

### 📥 Request Body
```json
{
  "companyProfile": { ... Full Profile Object dari respon Recon ... }
}
```

### 📤 Response Body (200 OK)
Return berbentuk `Array` dari `ProductMatch` (menggabungkan data katalog dengan skor AI).

```json
[
  {
    "id": "uuid-product-id",
    "name": "CampaignAI Pro",
    "tagline": "Automasi Email Marketing",
    "description": "Deskripsi produk...",
    "price": "Rp 5.000.000/bln",
    "painCategories": ["Marketing", "Operations"],
    "usp": ["USP 1", "USP 2"],
    "source": "manual",
    "createdAt": "...",
    "updatedAt": "...",
    
    "matchScore": 95,
    "addressedPainIndices": [0, 2],
    "reasoning": "Produk ini sangat relevan karena mengatasi pain point pertama dan ketiga perusahaan terkait lambatnya setup campaign...",
    "isRecommended": true
  }
]
```
*(Catatan: Array idealnya berisi top 3-5 produk yang paling cocok, urut dari `matchScore` tertinggi).*

---

## 3. Endpoint Craft — Generate Email Sequences
**URL**: `POST /api/craft`
**Tujuan**: Backend meracik satu buah *campaign reasoning* dan 3 *sequence email* mematikan (*outbound*) berdasarkan company target dan produk yang dipilih.

### 📥 Request Body
Frontend mengirimkan profil perusahaan beserta detil produk konkrit yang dipilih oleh *user* pada tahap Match.
```json
{
  "companyProfile": { ... Full Profile Object ... },
  "selectedProduct": { ... Full Product Object ... }
}
```

### 📤 Response Body (200 OK)
Mengembalikan struktur `Campaign` yang mendikte 3 `CampaignEmail` draft awal (selalu gunakan `isApproved: false`).

```json
{
  "reasoning": "Sequence 3-email ini dibuat untuk menargetkan pain point operasional karena produk Anda sangat menolong sisi tersebut. Tone secara umum adalah direct professional...",
  "targetCompany": "Nama Perusahaan Target",
  "emails": [
    {
      "sequenceNumber": 1,
      "dayLabel": "Hari ke-1",
      "scheduledDay": 1,
      "subject": "Judul Email Pertama untuk [Nama]",
      "body": "Halo [Nama],\n\nIni Draft awal dari AI...",
      "tone": "profesional", 
      "isApproved": false
    },
    {
      "sequenceNumber": 2,
      "dayLabel": "Hari ke-4",
      "scheduledDay": 4,
      "subject": "Follow Up - Judul Email Kedua",
      "body": "Halo [Nama],\n\nDraft kedua dari AI...",
      "tone": "profesional", 
      "isApproved": false
    },
    {
      "sequenceNumber": 3,
      "dayLabel": "Hari ke-10",
      "scheduledDay": 10,
      "subject": "Breakup - Judul Email Ketiga",
      "body": "Halo [Nama],\n\nDraft ketiga dari AI...",
      "tone": "profesional", 
      "isApproved": false
    }
  ]
}
```
*(Catatan: `tone` wajib valid sebagai literal type di FE: `'profesional' | 'friendly' | 'direct' | 'storytelling'`)*

---

## 🛡️ Aturan Error Handling Backend
Jika AI Engine / Scraping gagal pada *step* apa pun, Backend **WAJIB** return HTTP code selain `2xx` (misal `400 Bad Request` atau `500 Internal Server Error`) dengan bentuk payload *error detail* sebagai berikut:

```json
{
  "detail": "Pesan error spesifik dalam Bahasa Indonesia (ex: Proxycurl limit habis, atau Timeout)."
}
```
*Frontend akan otomatis menangkap pesan `detail` ini dan me-rendernya di dalam Box Error Alert yang sudah disiapkan.*
