# Campfire Architect - Claude Code Execution Prompt

> **Instruksi Penggunaan:**
> Buka terminal tempat Anda menjalankan **Claude Code** (`claude`), lalu salin dan tempelkan blok instruksi di bawah ini secara bertahap.

---

### PROMPT 1: REWRITE LANE B (APIFY DEF_FUSION ACTOR)
```text
Tugas: Rombak `apify_service.py` untuk menjadi pipeline 2-step yang kaya data.
Saat ini `apify_service.py` hanya melakukan Google Snippet. Buat agar bekerja dalam 2 langkah:
1. Panggil actor `apify~google-search-scraper` dengan query: `site:linkedin.com/in "domain target" (VP OR "Head of" OR Director OR Manager OR CMO)` untuk mengekstrak URL profil LinkedIn. Cukup ambil 3 URL terbaik.
2. Panggil actor `dev_fusion~linkedin-profile-scraper-with-email` untuk masing-masing atau sekaligus ke-3 URL LinkedIn tersebut menggunakan endpoint `/run-sync-get-dataset-items`.
3. Petakan hasil ekstraksi super-kaya tersebut ke dalam `RawContact`. Tambahkan field baru di `RawContact`: `location`, `connections`, `about`, `role_duration`.
4. Jika `dev_fusion` gagal tereksekusi atau time-out, kembalikan data standar dari Google Snippet sebagai fallback.

Pastikan menggunakan `httpx` dan tangani error dengan baik tanpa menghancurkan eksekusi Lane A.
```

### PROMPT 2: EXPAND TYPES & UI UNTUK MENAMPUNG RICH DATA
```text
Tugas: Perbarui Skema UI dan TypeScript agar mampu merender hasil sintesis dan scraping yang lebih detail/kaya.
1. Buka `types/recon.types.ts`.
2. Di antarmuka `PicContact`, tambahkan properti opsional berikut: `location?: string`, `connections?: string`, `about?: string`, `roleDuration?: string`.
3. Di antarmuka `CompanyProfile`, ubah `description: string` menjadi kumpulan wawasan dengan menambahkan field baru: `deepInsights: string[]` dan hapus `description` string tunggal jika dirasa tidak cukup, atau pertahankan `description` tapi tambahkan `deepInsights: string[]`.
4. Buka komponen `KeyContacts.tsx` (di app/recon/components). Ubah desain kotak kontaknya: jika data `email`, `location`, `connections` dan `roleDuration` tersedia dari `contact`, render elemen UI tersebut dengan menarik, mungkin pakai ikon Lucide tambahan seperti MapPin, Users, Mail, dll.
5. Pastikan semua file di dalam folder app/recon (termasuk `api/recon.ts` / `mockdata.json` / `mockdata.ts`) disesuaikan formatnya jika ada field yang bentrok.
```

### PROMPT 3: REWRITE LANE A (ADVANCED 9-STEP PROFILER)
```text
Tugas: Ganti sistem `Tavily /research` menjadi "Custom Parallel Architecture" di `openai_service.py` (Atau buat file baru `lane_a_service.py`).
Berdasarkan dokumen arsitektur, Lane A tidak lagi menggunakan 1 pemanggilan `tavily_extract`, melainkan loop iteratif dengan spesifikasi:
1. Step 0: Tavily Extract URL utama.
2. Step 1: Panggil OpenAI API (model mini) untuk Gap Analysis dari struktur schema.
3. Step 2: OpenAI API men-generate 3 array query (General, News, Deep Targeted).
4. Step 3 (Paralel): Jalankan Tavily Search untuk General Query (Round 1) dan News Query (Round 2).
5. Step 4 (Paralel): OpenAI men-distill hasil R1 dan R2. Meneruskan wawasan entitasnya ke Step 5.
6. Step 5: Eksekusi Deep Targeted Search (R3) menggunakan entitas dari Step 4. Limitasikan dengan search domain idx.co.id, bisnis.com.
7. Gabungkan seluruh ringkasan panjang tersebut sebagai hasil kembalian Lane A.

Gunakan Pydantic Structured Outputs untuk prompt generator LLM-nya. Buat fungsinya sangat asinkron dengan `asyncio.gather`.
```

### PROMPT 4: UN-COMPRESSED FINAL SYNTHESIS
```text
Tugas: Ubah "Final OpenAI Synthesis" di `openai_service.py` menjadi sangat ekspansif dan detail.
1. Cari instruksi `synthesize_profile`.
2. Ubah `system_prompt`-nya: "JANGAN me-ringkas (compress) data. Sajikan data hasil riset dalam paragraf panjang yang sangat detail. Terjemahkan wawasan mendalam menjadi array `deepInsights` yang berisi wawasan bisnis komprehensif. Pastikan informasi hasil scrapping di Lane B (terutama email, roleDuration, location) tidak dihapus atau dirangkum, tetapi disalin utuh 1:1 ke field contacts."
3. Pastikan schema *Structured Output* pydantic di `schemas.py` diubah untuk menampung field baru seperti `deepInsights: list[str]` dan update field `PicContact` sesuai dengan `types/recon.types.ts`.
```
