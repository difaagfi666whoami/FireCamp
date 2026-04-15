# Prompt: Fix Recon Pipeline Stuck — Debug & Repair

## KONTEKS MASALAH
Setelah implementasi Token Usage Tracking, halaman Recon (`/recon`) stuck saat 
proses Generate Profil. Halaman loading tidak pernah selesai.

Kode backend dan frontend yang baru sudah di-review dan terstruktur benar. 
Bug kemungkinan besar ada di salah satu dari 3 area berikut.

## TASK 1 — Cek TypeScript Compilation

Jalankan:
```bash
npx tsc --noEmit
```

Jika ada error, perbaiki. Kemungkinan error terjadi karena:
- `lib/session.ts` — Arrow function return type di dalam object literal
- `app/recon/page.tsx` — akses `resolvedProfile?.tokens_used` yang tidak ada 
  di interface `CompanyProfile`

**Fix jika ada TS2339 (tokens_used does not exist on CompanyProfile):**
Buka `types/recon.types.ts` dan tambahkan field optional ke interface `CompanyProfile`:
```typescript
export interface CompanyProfile {
  // ... field yang sudah ada ...
  tokens_used?: number  // Token AI dari synthesize_profile (opsional, hanya ada saat generate baru)
}
```

## TASK 2 — Cek Error di Browser Console

1. Buka `http://localhost:3000/recon`
2. Buka Chrome DevTools → tab Console
3. Masukkan URL company di form dan klik Generate
4. Perhatikan error di Console

**Kemungkinan error yang akan muncul:**
- `TypeError: session.setReconTokens is not a function` → Cek apakah `lib/session.ts` 
  sudah punya method `setReconTokens` (SUDAH ADA — di baris 74)
- `TypeError: Cannot destructure property...` → Format response backend berubah
- `Unhandled Promise Rejection` → API call gagal tanpa error handling

## TASK 3 — Cek Error di Terminal FastAPI (uvicorn)

Perhatikan terminal `uvicorn` saat Generate dijalankan. Kemungkinan error:

**3a. Pydantic ValidationError di ReconResponse:**
```
Field 'tokens_used' has conflict with inherited CompanyProfile
```
Ini terjadi jika `ReconResponse(CompanyProfile)` dan field `tokens_used` bentrok 
dengan Pydantic model_validate. 

**Fix:**
Buka `backend/app/models/schemas.py` dan pastikan `ReconResponse` didefinisikan seperti ini
(BUKAN `model_validate`, tapi menggunakan inheritance biasa):
```python
class ReconResponse(CompanyProfile):
    tokens_used: Optional[int] = None
```
Ini sudah benar di file saat ini.

**3b. Tuple unpacking error di recon.py:**
```
ValueError: too many values to unpack
```
Ini terjadi jika `synthesize_profile()` return nya bukan tuple.
Pastikan baris L459 `openai_service.py` mengembalikan `return profile, tokens_used` 
(ini sudah benar).

## TASK 4 — Paling Kritis: Cek `app/recon/page.tsx` Loading Flow

baris 88-90:
```typescript
if (resolvedProfile?.tokens_used && resolvedProfile.tokens_used > 0) {
  session.setReconTokens(resolvedProfile.tokens_used)
}
```

Alur loading di komponen ini:
1. `generateReconProfile(reconUrl)` dipanggil (baris 107)
2. Interval animasi step-by-step berjalan bersamaan (baris 117)
3. Ketika animasi selesai DAN API selesai → `settle()` dipanggil (baris 79)
4. `settle()` set profile dan panggil `session.setReconTokens()`

**Bug potensial:** Jika `generateReconProfile()` THROW error, `resolvedProfile` 
menjadi `null` dan `settle()` hanya set `setIsLoading(false)`. 
Tapi jika error di catch block itu sendiri (misalnya toast error gagal), 
maka `settle()` tidak pernah dipanggil → UI stuck selamanya.

**Debug step:**
Tambahkan console.log di catch block untuk melihat apakah ada error:
```typescript
// Di baris 110-114 app/recon/page.tsx
}).catch(e => {
  console.error("[ReconPage] API call FAILED:", e)  // tambahkan ini
  toast.error("Gagal generate profil.", { description: e instanceof Error ? e.message : "Error" })
  resolvedProfile = null
  settle()
})
```

## TASK 5 — Verifikasi Backend Response Format

Jalankan manual test menggunakan curl:
```bash
curl -X POST http://localhost:8000/api/recon \
  -H "Content-Type: application/json" \
  -d '{"url": "tokopedia.com", "mode": "free"}' \
  2>&1 | head -100
```

Jika backend mengembalikan error, perbaiki berdasarkan pesan error.
Jika backend mengembalikan response valid, periksa apakah field `tokens_used` 
ada di response JSON.

## VERIFICATION

Setelah semua fix diterapkan:
1. Pastikan `npx tsc --noEmit` pass
2. Buka `/recon`, generate profil baru
3. Konfirmasi:
   - Loading step-by-step muncul (4 langkah)
   - Profil berhasil tampil setelah loading selesai
   - Browser Console tidak ada error merah
   - DevTools → Application → Session Storage → key `campfire_recon_tokens` terisi angka
4. Laporkan hasil dan jika ada error, sertakan teks error lengkapnya.
