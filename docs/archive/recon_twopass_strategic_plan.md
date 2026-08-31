# Strategic Plan: Two-Pass Architecture — Recon Pipeline

> Tujuan: Menghasilkan report Recon yang setiap klaimnya bisa diverifikasi,
> sehingga Digital Marketer tidak perlu double-check secara manual.

---

## 1. Masalah yang Diselesaikan

Pipeline Recon saat ini mensintesis dari **snippet** (2-3 kalimat), bukan dari
artikel/konten yang benar-benar dibaca. Akibatnya:

- Strategic report terasa seperti "AI karangan", bukan riset berbasis fakta
- Tidak ada citation yang bisa diklik untuk memverifikasi klaim
- DM tidak percaya output → tetap buka tab lain → pipeline tidak menggantikan kerja manual

---

## 2. Konsep Two-Pass

```
PASS 1 — DISCOVERY (sudah ada, dipertahankan)
  Tujuan : Temukan URL yang relevan secepat mungkin
  Tools  : Serper (Google Search) + Tavily Search
  Output : Daftar URL + snippet + skor relevansi

PASS 2 — DEEP READ (baru, ditambahkan)
  Tujuan : Baca konten penuh dari URL terpilih
  Tools  : Jina Reader + Tavily Extract
  Output : Fakta spesifik + kutipan langsung + citation URL + tanggal
```

**Prinsip utama:** AI hanya boleh menulis klaim yang bisa ia tunjukkan sumbernya.

---

## 3. Perubahan Per Lane

---

### Lane A — Company Profiling

**Kondisi sekarang:**
```
Step 0 : Tavily Extract homepage      → full content ✓
Step 3 : Tavily Search R1 (General)   → snippet ✗
Step 3 : Tavily Search R2 (News)      → snippet ✗
Step 5 : Tavily Search R3 (Targeted)  → snippet ✗
         ↓
Step 4 : GPT-4o-mini distill R1+R2   → distill dari snippet
Step 6 : Gabungkan → string summary  → klaim tanpa grounding
```

**Kondisi setelah Two-Pass:**
```
Step 0 : Tavily Extract homepage             → full content ✓
Step 3 : Tavily Search R1+R2+R3             → dapat 5-10 URL per search
         ↓
[NEW] Step 3.5 : Filter top 3 URL paling relevan per search
[NEW] Step 3.6 : Tavily Extract top 3 URL  → full article content (paralel)
         ↓
Step 4 : GPT-4o-mini distill dari full content
         → Setiap insight WAJIB disertai [SOURCE: url | tanggal]
Step 6 : Gabungkan dengan citations intact
```

**Dampak:** Strategic report (internalCapabilities, marketDynamics, strategicRoadmap)
dibangun dari artikel yang benar-benar dibaca, bukan dari 2-3 kalimat snippet.

---

### Lane B — Contact Discovery

**Kondisi sekarang:**
```
Serper LinkedIn dorking → Google snippet profil LinkedIn
  → "about" = 2-3 kalimat snippet Google
  → connections, roleDuration = tidak ada / AI inference
```

**Two-pass tidak cukup untuk Lane B.**
LinkedIn memblokir scraping — Jina/Tavily tidak bisa menembus login wall.

**Solusi jangka pendek (budget $0):**
```
Tambah disclaimer di UI KeyContacts:
"Data kontak bersumber dari indeks publik LinkedIn via Google.
 Verifikasi profil sebelum outreach: [link LinkedIn]"
```

**Solusi jangka panjang:**
```
ProxyCurl API — $0.01/profil
Fetch profil LinkedIn langsung: connections, experience, roleDuration, about lengkap
```

Lane B **tidak disentuh** dalam sprint two-pass ini.
Prioritaskan setelah ada budget untuk ProxyCurl.

---

### Lane C — News Engine

**Kondisi sekarang:**
```
Serper /news → title + snippet (2 kalimat Google) → langsung masuk ke UI
```

**Kondisi setelah Two-Pass:**
```
PASS 1: Serper /news → dapat 5-8 artikel URL + snippet
         ↓
        Filter: buang artikel yang tidak mention nama perusahaan di judul
         ↓
        Ambil top 3 URL paling relevan (by snippet quality)
         ↓
PASS 2: Jina Reader fetch top 3 URL (paralel, timeout 10s per URL)
         ↓
        GPT-4o-mini extract per artikel:
          - Fakta utama (angka, tanggal, nama spesifik)
          - Kutipan langsung jika ada
          - Kategori: funding / ekspansi / produk baru / kemitraan
          - [SOURCE: url | nama media | tanggal publish]
         ↓
        Output: NewsItem dengan summary yang real, bukan snippet Google
```

---

### Lane D — Hiring Signals

**Kondisi sekarang:**
```
Serper job boards → title lowongan + snippet → langsung masuk UI
```

**Kondisi setelah Two-Pass:**
```
PASS 1: Serper job boards → dapat URL lowongan + snippet
         ↓
        Filter: ambil top 3 lowongan paling relevan
         ↓
PASS 2: Jina Reader fetch halaman lowongan
         ↓
        GPT-4o-mini extract per lowongan:
          - Nama posisi yang dicari
          - Requirements spesifik (tools, skills, pengalaman)
          - Tim mana yang expand (Marketing? Tech? Sales?)
          - Sinyal bisnis: "Mereka hiring 3 Digital Marketing Specialist
            → sedang scale kampanye digital"
          - [SOURCE: url | platform | tanggal posting]
```

**Dampak:** Dari "ada lowongan Digital Marketing" → menjadi
"sedang expand tim digital 3 orang, fokus pada performance marketing dan
CRM — sinyal kuat mereka investasi besar di channel digital tahun ini."

---

### Lane E — Money & Leadership Signals

**Kondisi sekarang:**
```
Serper /news dengan keyword funding/M&A/leadership → snippet → UI
```

**Kondisi setelah Two-Pass:**
```
PASS 1: Serper /news → URL artikel + snippet
         ↓
        Filter: prioritaskan artikel dengan keyword angka spesifik
                (Rp, USD, $, miliar, juta, Series, funding)
         ↓
PASS 2: Jina Reader fetch top 2-3 artikel
         ↓
        GPT-4o-mini extract:
          - Jumlah funding yang tepat (Rp X miliar / $X juta)
          - Investor yang terlibat
          - Rencana penggunaan dana (hiring? ekspansi? produk baru?)
          - Perubahan leadership: siapa masuk, siapa keluar
          - Tanggal yang tepat
          - [SOURCE: url | media | tanggal]
```

**Dampak:** Dari "[FUNDING] Perusahaan X dapat pendanaan baru" → menjadi
"Series B $12 juta ditutup 3 Februari 2025, dipimpin Alpha JWC.
Dana dialokasikan untuk ekspansi ke 5 kota baru dan hiring 50 orang
— window outreach optimal: 30-60 hari sejak pengumuman."

---

## 4. Komponen Baru yang Dibutuhkan

### 4.1 `fetch_and_extract(urls, max_urls, timeout)` — Utility Baru
```python
# Fungsi shared yang dipakai Lane A, C, D, E
# Input  : list URL dari Pass 1
# Output : list { url, content, fetched_at }
# Logic  :
#   - Ambil max_urls teratas (default: 3)
#   - Fetch paralel via Jina Reader (asyncio.gather + semaphore)
#   - Timeout 10s per URL — skip jika gagal, jangan block pipeline
#   - Return hanya URL yang berhasil di-fetch
```

### 4.2 Perubahan Prompt di `synthesize_profile()`
```
Tambah instruksi wajib:
"Setiap klaim faktual dalam strategic report WAJIB disertai
 citation dalam format: [Sumber: nama_media | url | tanggal].
 Jika tidak ada sumber yang dapat dikutip, jangan buat klaim tersebut."
```

### 4.3 UI Citation Component
```
Setiap klaim di StrategicMainContent yang punya citation:
→ tampilkan superscript angka [1] yang bisa diklik
→ di bawah card: daftar referensi dengan link ke artikel asli
```

---

## 5. Perubahan Schema

```typescript
// types/recon.types.ts

interface Citation {
  url: string
  title: string
  source: string   // nama media
  date: string
}

interface StrategicReport {
  strategicTitle: string
  executiveInsight: string
  internalCapabilities: string    // markdown, tiap klaim ada [1][2]
  marketDynamics: string          // markdown, tiap klaim ada [1][2]
  strategicRoadmap: string[]
  citations: Citation[]           // ← NEW: daftar sumber yang dikutip
}

interface NewsItem {
  // ...existing fields
  summary: string    // sekarang: full extracted summary (bukan snippet)
  extractedFacts: string[]  // ← NEW: bullet fakta spesifik
}

interface IntentSignal {
  // ...existing fields
  verifiedAmount?: string   // ← NEW: untuk funding signals
  verifiedDate?: string     // ← NEW: tanggal terverifikasi dari artikel
}
```

---

## 6. Output yang Diharapkan Setelah Implementasi

### Sebelum (sekarang):
```
Kapabilitas Internal:
"Tokopedia merupakan platform e-commerce terkemuka di Indonesia
yang memiliki ekosistem digital yang kuat dan jaringan merchant
yang luas di seluruh nusantara."

→ Siapa yang nulis ini? AI dari snippet. Tidak bisa diverifikasi.
```

### Setelah (two-pass):
```
Kapabilitas Internal:
"Tokopedia mencatat GMV Rp 400 triliun pada 2024, naik 23% YoY [1].
Ekosistem logistik TokoCabang kini melayani 98% kecamatan di Indonesia [2].
Program TokoModal telah menyalurkan Rp 2,1 triliun ke 180.000 UMKM [3]."

Referensi:
[1] Bisnis.com | tokopedia-gmv-2024... | 15 Jan 2025
[2] Kontan.co.id | tokocabang-ekspansi... | 3 Mar 2025
[3] Katadata.co.id | tokomodal-umkm... | 28 Feb 2025

→ DM bisa klik, baca sendiri, konfirmasi ke client.
```

---

## 7. Urutan Implementasi

```
Sprint 1 — Foundation (paling impactful, paling cepat)
  1. Buat fetch_and_extract() utility di external_apis.py
  2. Integrasi ke Lane C (news) — paling visible di UI
  3. Update NewsItem schema + UI (summary real, bukan snippet)

Sprint 2 — Signals
  4. Integrasi ke Lane D (hiring) — extract job requirements
  5. Integrasi ke Lane E (money) — extract verified amounts/dates
  6. Update IntentSignal schema + UI

Sprint 3 — Strategic Report
  7. Integrasi ke Lane A Step 3.5-3.6 (deep read search results)
  8. Update synthesize_profile() prompt → wajib citation
  9. Update StrategicReport schema + UI citation component

Sprint 4 — ProxyCurl (butuh budget)
  10. Integrasi ProxyCurl ke Lane B
  11. Update KeyContacts dengan data profil lengkap
```

---

## 8. Trade-off yang Diterima

| Aspek | Sebelum | Setelah |
|---|---|---|
| Waktu proses | ~15-20 detik | ~35-45 detik |
| Akurasi klaim | Rendah (AI inference) | Tinggi (grounded) |
| Citation | Tidak ada | Setiap klaim punya sumber |
| Kepercayaan DM | Perlu verify manual | Bisa klik langsung |
| API cost tambahan | - | Jina (free dengan API key) |

**Kesimpulan trade-off:** +20 detik waktu proses yang menghasilkan
report yang tidak perlu diverifikasi manual = net positive untuk DM.

---

## 9. Batas yang Tidak Bisa Diselesaikan Two-Pass

| Gap | Alasan | Solusi |
|---|---|---|
| Kontak LinkedIn (Lane B) | Login wall, tidak bisa di-scrape | ProxyCurl (berbayar) |
| Company readiness score | Butuh synthesis layer baru | Sprint tersendiri |
| Competitive displacement | Butuh BuiltWith API | Sprint tersendiri |
| Real-time index | Serper masih Google index | Tidak ada solusi $0 |

---

*Dokumen ini adalah referensi strategic sebelum eksekusi kode.*
*Update dokumen ini jika ada perubahan pendekatan selama implementasi.*
