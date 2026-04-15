# Prompt: Token Usage Tracking — Full Stack Implementation

## Konteks Proyek
Campfire adalah aplikasi B2B outreach Next.js 14 + FastAPI + Supabase.
Kamu sedang mengimplementasikan fitur "Penggunaan Token AI" di halaman Pulse (dashboard analytics).

**Yang sudah ada (jangan disentuh):**
- Database: kolom `token_recon`, `token_match`, `token_craft`, `token_total` (GENERATED), `estimated_cost_idr` di tabel `campaign_analytics` — SUDAH ADA
- UI: `app/pulse/components/TokenUsageCard.tsx` — sudah render dengan benar, hanya perlu tambah section baru di bagian bawah
- Fetcher: `lib/api/analytics.ts` — sudah membaca kolom token dari Supabase

**Yang perlu dibangun:** Pipeline pengiriman data token dari OpenAI response → FastAPI → Supabase → Frontend.

---

## TASK 1 — Backend Service: `openai_service.py`

**File:** `backend/app/services/openai_service.py`

Cari fungsi `synthesize_profile()`. Saat ini fungsi ini me-log token tapi tidak me-return-nya.

**Perubahan:**
1. Ubah return type annotation menjadi `tuple[CompanyProfile, int]`
2. Sebelum `return profile`, ambil token count dan return sebagai tuple:

```python
# Cari baris yang sudah ada (sekitar L453-455):
#   logger.info("[openai] synthesize_profile OK | company=%r tokens=%d ...")
#   response.usage.total_tokens if response.usage else 0

# Simpan ke variable terlebih dahulu
tokens_used = response.usage.total_tokens if response.usage else 0

# Lalu ubah return dari:
return profile
# Menjadi:
return profile, tokens_used
```

---

## TASK 2 — Backend Router: `recon.py`

**File:** `backend/app/api/routers/recon.py`

Ada 2 fungsi yang perlu diubah:

### 2a. Fungsi `run_recon_pipeline()`
- Ubah return type dari `CompanyProfile` menjadi `tuple[CompanyProfile, int]`
- Di Step 2 (Final Synthesis), unpack hasil dari `openai_service.synthesize_profile()`:

```python
# SEBELUM (sekitar baris 234):
profile = await openai_service.synthesize_profile(...)

# SESUDAH:
profile, tokens_used = await openai_service.synthesize_profile(...)
```

- Ubah baris `return profile` menjadi `return profile, tokens_used`

### 2b. Fungsi `generate_recon()` (router endpoint)
- Unpack tuple dari `run_recon_pipeline()`
- Teruskan ke `ReconResponse`:

```python
# SEBELUM (sekitar baris 293):
profile = await run_recon_pipeline(url=url, mode=payload.mode)
return ReconResponse.model_validate(profile.model_dump())

# SESUDAH:
profile, tokens_used = await run_recon_pipeline(url=url, mode=payload.mode)
return ReconResponse.model_validate({**profile.model_dump(), "tokens_used": tokens_used})
```

---

## TASK 3 — Backend Schema: `schemas.py`

**File:** `backend/app/models/schemas.py`

Tambahkan 2 field baru:

### 3a. Di class `ReconResponse`
```python
class ReconResponse(BaseModel):
    # ... field yang sudah ada (jangan hapus) ...
    tokens_used: Optional[int] = None
```

### 3b. Di class `CraftRequest`
```python
class CraftRequest(BaseModel):
    companyProfile: CompanyProfile
    selectedProduct: Any  # atau ProductMatch — sesuaikan dengan yang sudah ada
    token_recon: Optional[int] = 0    # token dari fase Recon, dikirim frontend
    campaign_id: Optional[str] = None  # untuk UPDATE campaign_analytics
```

---

## TASK 4 — Backend Service: `craft_service.py`

**File:** `backend/app/services/craft_service.py`

Cari fungsi `generate_campaign_emails()`. Sudah ada logging token di dalamnya.

**Perubahan:** Ubah return type dan return statement:
```python
# Cari baris yang ada (sekitar L291-294):
#   logger.info("[craft_service] OK | company=%r emails=%d tokens=%d ...")
#   response.usage.total_tokens if response.usage else 0

# Simpan ke variable:
tokens_used = response.usage.total_tokens if response.usage else 0

# Ubah return — dari:
return result_dict
# Menjadi:
return result_dict, tokens_used
```

---

## TASK 5 — Backend Router: `craft.py`

**File:** `backend/app/api/routers/craft.py`

Ini adalah titik sentral — unpack token dan tulis ke Supabase.

### 5a. Tambah import di bagian atas file
```python
import os
from supabase import create_client, Client
```

### 5b. Tambah konstanta setelah import
```python
_SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
_SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
_IDR_PER_TOKEN = 0.000163  # ~Rp per token (GPT-4o $10/1M tokens, kurs Rp 16.300)
```

### 5c. Modifikasi `generate_craft()` endpoint
```python
async def generate_craft(payload: CraftRequest) -> CraftResponse:
    company_data = payload.companyProfile.model_dump()
    product_data = payload.selectedProduct.model_dump()

    if not payload.companyProfile.painPoints:
        raise HTTPException(status_code=400, detail="...")

    logger.info("[POST /api/craft] START | ...")

    try:
        result, craft_tokens = await craft_service.generate_campaign_emails(
            company_data, product_data
        )  # unpack tuple
    except RuntimeError as exc:
        ...  # error handling tetap sama

    # Tulis token ke Supabase — non-fatal (jangan stop jika gagal)
    if payload.campaign_id and _SUPABASE_URL and _SUPABASE_KEY:
        try:
            sb: Client = create_client(_SUPABASE_URL, _SUPABASE_KEY)
            token_recon = payload.token_recon or 0
            total_tokens = token_recon + craft_tokens
            sb.table("campaign_analytics").update({
                "token_recon": token_recon,
                "token_craft": craft_tokens,
                "estimated_cost_idr": round(total_tokens * _IDR_PER_TOKEN),
            }).eq("campaign_id", payload.campaign_id).execute()
            logger.info(
                "[POST /api/craft] token write OK | recon=%d craft=%d total=%d idr=%d",
                token_recon, craft_tokens, total_tokens,
                round(total_tokens * _IDR_PER_TOKEN)
            )
        except Exception as e:
            logger.warning("[POST /api/craft] token write FAILED (non-fatal): %s", e)

    logger.info("[POST /api/craft] DONE | ...")
    return CraftResponse(**result)
```

### 5d. Cek `requirements.txt` backend
Pastikan `supabase` ada di `backend/requirements.txt`. Jika belum ada, tambahkan:
```
supabase>=2.0.0
```

---

## TASK 6 — Frontend: `lib/session.ts`

**File:** `lib/session.ts`

Tambahkan 2 method baru ke dalam object `session` (atau class, sesuai struktur yang sudah ada):

```typescript
const RECON_TOKENS_KEY = "campfire_recon_tokens"

// Di dalam object/class session, tambahkan:
setReconTokens(n: number): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(RECON_TOKENS_KEY, String(n))
},

getReconTokens(): number {
  if (typeof window === "undefined") return 0
  return parseInt(sessionStorage.getItem(RECON_TOKENS_KEY) ?? "0", 10)
},
```

---

## TASK 7 — Frontend: `app/recon/page.tsx`

**File:** `app/recon/page.tsx`

Cari handler setelah profil berhasil di-generate (biasanya di dalam `handleGenerate` atau `handleSubmit`).
Tambahkan penyimpanan token ke session:

```typescript
// Setelah hasil recon berhasil didapat dari API
// Cari baris yang assign profile/data ke state
// Contoh pola yang mungkin ada:
// const data = await generateReconProfile(url, mode)
// setProfile(data)

// Tambahkan SETELAH assignment:
if (data?.tokens_used && data.tokens_used > 0) {
  session.setReconTokens(data.tokens_used)
}
```

**Catatan:** Sesuaikan dengan struktur aktual `handleGenerate` yang ada di file. Cari return value dari function `generateReconProfile` di `lib/api/recon.ts` untuk mengetahui bentuk response-nya.

---

## TASK 8 — Frontend: `lib/api/craft.ts`

**File:** `lib/api/craft.ts`

Cari fungsi yang mengirim request ke `/api/craft` (biasanya `generateCampaign` atau `createCampaign`).
Tambahkan 2 field baru ke request body:

```typescript
// Tambahkan di dalam JSON.stringify body:
token_recon: session.getReconTokens(),
campaign_id: session.getCampaignId() ?? undefined,
```

---

## TASK 9 — Frontend: `app/pulse/components/TokenUsageCard.tsx`

**File:** `app/pulse/components/TokenUsageCard.tsx`

Tambahkan section "Pantau Kredit API Eksternal" di paling bawah card, setelah bagian "Estimasi Biaya".

### 9a. Tambah import
```typescript
import { ExternalLink } from "lucide-react"
// Cpu, Search, Tag, PenLine, DollarSign sudah ada
```

### 9b. Tambah data links
```typescript
const EXTERNAL_APIS = [
  { name: "Tavily Search", url: "https://app.tavily.com",       color: "text-blue-600" },
  { name: "Jina AI",       url: "https://jina.ai/dashboard",   color: "text-violet-600" },
  { name: "Serper.dev",    url: "https://serper.dev/dashboard", color: "text-emerald-600" },
  { name: "Resend",        url: "https://resend.com/overview",  color: "text-orange-600" },
]
```

### 9c. Tambah JSX setelah closing tag div estimasi biaya (sebelum closing tag card div)
```tsx
{/* External API Monitor */}
<div className="border-t border-border/50 pt-4 mt-1">
  <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
    Pantau Kredit API Eksternal
  </p>
  <div className="space-y-0.5">
    {EXTERNAL_APIS.map((api) => (
      <a
        key={api.name}
        href={api.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/60 transition-colors group"
      >
        <span className={cn("text-[12px] font-semibold", api.color)}>
          {api.name}
        </span>
        <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
      </a>
    ))}
  </div>
</div>
```

---

## TASK 10 — Verification

Setelah semua task selesai, lakukan verifikasi berikut:

### Backend check
```bash
cd backend
python -m py_compile app/services/openai_service.py app/api/routers/recon.py app/api/routers/craft.py app/models/schemas.py app/services/craft_service.py
echo "✅ No syntax errors"
```

### Frontend check
```bash
cd ..
npx tsc --noEmit
```

### Laporkan
Setelah check selesai, laporkan:
1. Apakah ada error TypeScript atau Python yang perlu diperbaiki?
2. Apakah `supabase` sudah ada di `backend/requirements.txt`?
3. Tampilkan isi `CraftRequest` class yang sudah dimodifikasi untuk konfirmasi.
