# Prompt: Fix 3 Post-Token-Tracking Issues (Recon, Token Dashboard, Form A11y)

> Context: Campfire B2B Outreach App. 
> Backend: FastAPI (Python) di `/backend`. Frontend: Next.js 14 di root.
> Database: Supabase (PostgreSQL). MCP Supabase tersedia.

## ISSUE 1 — Token Usage Selalu 0 di Dashboard Pulse

### Root Cause Analysis

Alur write token:
1. Recon: `POST /api/recon` → backend mengembalikan `tokens_used` di response →
   frontend menyimpan ke sessionStorage via `session.setReconTokens()`
2. Craft: `POST /api/craft` mengirim `token_recon` (dari sessionStorage) dan 
   menghitung `craft_tokens` sendiri → menulis ke Supabase `campaign_analytics`

**Masalah 1a: ERR_CONNECTION_RESET pada `/api/recon`**
Recon API gagal (connection reset), artinya:
- `tokens_used` tidak pernah masuk ke frontend
- `session.setReconTokens()` tidak pernah dipanggil
- `token_recon` yang dikirim ke `/api/craft` = 0
- Bahkan jika Craft berhasil, `token_recon` yang ditulis = 0

Jadi, meskipun Recon GAGAL lalu user melanjutkan dari Research Library (data dari 
Supabase), token Recon hilang selamanya. Kita butuh mekanisme fallback.

**Masalah 1b: `campaign_analytics` mungkin kosong**
Campaign yang dibuat SEBELUM kode token tracking ditambahkan tidak memiliki data 
token di `campaign_analytics`. Kolom `token_recon`, `token_craft`, `estimated_cost_idr` 
semuanya 0 karena data tidak pernah ditulis.

### TASKS

**Task 1.1 — Investigasi ERR_CONNECTION_RESET**
1. Restart server: `uvicorn app.main:app --reload --port 8000`
2. Monitor output terminal uvicorn
3. Trigger Recon dari browser: masukkan URL `karyamasmakmur.com` di halaman `/recon`
4. Perhatikan apakah ada error di uvicorn log. Kemungkinan:
   - ImportError / ModuleNotFoundError → fix import yang salah
   - Memory crash karena response terlalu besar → tambahkan `max_tokens` limit
   - Timeout dari external API (Tavily/Serper/OpenAI)
   - Python syntax error dari perubahan sebelumnya

Jika ditemukan error, perbaiki. Jika Recon berhasil berjalan normal (30-60 detik), 
berarti ERR_CONNECTION_RESET hanya terjadi karena server pernah crash sebelumnya 
(sebelum fix `from supabase import` dihapus).

**Task 1.2 — Backend: Simpan Token Recon ke Database saat Generate**
Saat ini token Recon HANYA dikirim ke frontend via response JSON. Jika response 
gagal sampai, token hilang. Fix: simpan token langsung ke tabel `companies` di backend.

File: `backend/app/api/routers/recon.py`

Tambahkan kolom dan logika:
1. Setelah `run_recon_pipeline()` return `(profile, tokens_used)` 
2. Simpan `tokens_used` ke response (SUDAH ADA) 
3. JUGA simpan ke tabel `companies` saat frontend memanggil `saveCompanyProfile()`

Sebenarnya, approach yang lebih robust:
- Bukan di backend, tapi di **frontend `lib/api/recon.ts`** → fungsi `saveCompanyProfile()`
  sudah insert ke tabel `companies`. Tambahkan kolom `token_recon` ke tabel `companies`
  dan masukkan nilainya saat save.

**BUT** — ini butuh migration. Alternatif yang lebih sederhana:

Ubah `lib/api/craft.ts` `generateCampaign()` → jika `session.getReconTokens()` 
adalah 0, coba estimasi dari data. Tapi ini band-aid.

**BEST APPROACH — Kirim token dari backend `craft.py` secara mandiri:**

File: `backend/app/api/routers/craft.py`

Saat ini, `_write_tokens_to_supabase()` menerima `token_recon` dari frontend payload.
Jika frontend mengirim 0, maka tetap 0. 

**Fix sederhana via Supabase MCP:**
Jalankan query ini via MCP Supabase untuk mengisi data campaign yang sudah ada:

```sql
-- Cek campaign_analytics yang token-nya masih 0
SELECT ca.campaign_id, ca.token_recon, ca.token_craft, ca.estimated_cost_idr
FROM campaign_analytics ca
WHERE ca.token_recon = 0 AND ca.token_craft = 0;
```

Untuk campaign lama, set estimasi manual:
```sql
UPDATE campaign_analytics 
SET token_recon = 8500,       -- estimasi rata-rata Recon pipeline
    token_craft = 3500,       -- estimasi rata-rata Craft pipeline
    estimated_cost_idr = ROUND((8500 + 3500) * 0.000163)
WHERE token_recon = 0 AND token_craft = 0;
```

**Task 1.3 — Verifikasi End-to-End (BARU)**
1. Jalankan ulang full pipeline: Recon → Match → Craft → Polish → Launch
2. Setelah Craft selesai, cek di terminal uvicorn ada log:
   ```
   [POST /api/craft] token write OK | recon=XXXX craft=XXXX total=XXXX idr=XXXX
   ```
3. Cek Supabase tabel `campaign_analytics` — kolom `token_recon` dan `token_craft` 
   harus > 0
4. Buka Pulse dashboard `/pulse` — kartu "Penggunaan Token AI" harus menampilkan angka

---

## ISSUE 2 — ERR_CONNECTION_RESET pada `/api/recon` (dari Console)

```
:8000/api/recon:1  Failed to load resource: net::ERR_CONNECTION_RESET
```

Ini terjadi karena FastAPI server crash SEBELUM fix `supabase` import yang sudah 
diterapkan. Namun, ada kemungkinan error lain.

### TASKS

**Task 2.1 — Verifikasi Backend Bisa Menerima Request**
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:8000/api/recon \
  -H "Content-Type: application/json" \
  -d '{"url": "tokopedia.com", "mode": "free"}'
```

Jika return HTTP 200 → backend sudah OK, ERR_CONNECTION_RESET hanya artefak dari 
crash sebelumnya (sudah di-fix dengan menghapus `from supabase import`).

Jika return selain 200 → ada error baru. Lihat output lengkap:
```bash
curl -X POST http://localhost:8000/api/recon \
  -H "Content-Type: application/json" \
  -d '{"url": "tokopedia.com", "mode": "free"}' 2>&1 | head -50
```

Laporkan error yang ditemukan.

**Task 2.2 — Jika masih ERR_CONNECTION_RESET saat curl**
Kemungkinan:
1. `uvicorn` tidak running → restart `uvicorn app.main:app --reload --port 8000`
2. Port 8000 diblokir firewall → coba port lain: `--port 8001`
3. Memory issue (Python 3.9 + uvloop) → restart terminal fresh

---

## ISSUE 3 — Form A11y Warnings (id/name/label)

Chrome DevTools "Issues" tab melaporkan:
- **6 form field tanpa id atau name attribute**
- **12 label tanpa for attribute yang match**

Ini bukan error runtime tapi penting untuk aksesibilitas dan autofill browser.

### File yang Perlu Diperbaiki:

**3a. `app/launch/components/ManualScheduleForm.tsx` (baris 124, 143)**
Dua `<input>` (date dan time) tidak punya `id` atau `name`. label menggunakan 
`<label>` generik tanpa `htmlFor`.

Fix: Tambahkan unique id dan `htmlFor`:
```tsx
// Date input — tambahkan id unique per email
<label htmlFor={`date-email-${index}`} className="...">Tanggal Kirim</label>
<input id={`date-email-${index}`} name={`date-email-${index}`} type="date" ... />

// Time input — tambahkan id unique per email  
<label htmlFor={`time-email-${index}`} className="...">Jam Kirim</label>
<input id={`time-email-${index}`} name={`time-email-${index}`} type="time" ... />
```

**3b. `app/match/components/PdfUploadZone.tsx` (baris 94)**
`<input type="file">` tidak punya `id` atau `name`.

Fix:
```tsx
<input id="pdf-upload" name="pdf-upload" type="file" accept=".pdf" ... />
```

**3c. `app/match/components/ProductCatalogTab.tsx` (baris 167, 220)**
- Baris 167: `<input type="file">` hidden tanpa id/name
- Baris 220: `<input type="text">` search tanpa id/name atau label

Fix baris 167:
```tsx
<input id="pdf-catalog-upload" name="pdf-catalog-upload" type="file" ... />
```

Fix baris 220:
```tsx
<label htmlFor="catalog-search" className="sr-only">Cari produk</label>
<input id="catalog-search" name="catalog-search" type="text" ... />
```

**3d. `app/polish/components/EmailEditor.tsx` (baris 25-26)**
`<label>` untuk Subject Line tidak punya `htmlFor`, dan `<Input>` shadcn tidak 
punya explicit `id`.

Fix:
```tsx
<label htmlFor="email-subject" className="...">Subject Line</label>
<Input id="email-subject" name="email-subject" ... />
```

Catatan: `EmailEditor` dipanggil untuk multiple emails. Jika menerima prop `emailIndex`, 
gunakan dynamic id: `id={`email-subject-${emailIndex}`}`.

Cek apakah ada prop index yang diteruskan dari parent. Jika tidak ada, tambahkan 
prop `emailIndex: number` ke interface `EmailEditorProps`.

---

## VERIFICATION CHECKLIST

Setelah semua fix selesai:

1. **Backend**: `uvicorn` menyala tanpa error → `curl POST /api/recon` return 200
2. **TypeScript**: `npx tsc --noEmit` pass (0 errors)
3. **Token Values**: Supabase `campaign_analytics` memiliki `token_recon > 0` 
   dan `token_craft > 0` (minimal untuk 1 campaign)
4. **Pulse UI**: Buka `/pulse` → kartu "Penggunaan Token AI" menunjukkan angka 
   bukan 0 (untuk campaign yang sudah di-update)
5. **A11y**: Buka Chrome DevTools → Issues tab → tidak ada warning "form field 
   should have id" atau "no label associated"
6. **Console Error**: Buka Chrome DevTools → Console → tidak ada ERR_CONNECTION_RESET
   baru saat navigasi normal

Laporkan hasil tiap item di atas.
