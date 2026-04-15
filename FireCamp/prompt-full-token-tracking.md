# Prompt: Full Token Tracking — Semua Pipeline yang Konsumsi AI

> Context: Campfire B2B Outreach App.
> Backend: FastAPI (Python) di `/backend`. Frontend: Next.js 14 di root.
> Database: Supabase (PostgreSQL).
> Settings: Backend baca env dari `app/core/config.py` → `settings` object 
>   (BUKAN `os.environ`! Gunakan `from app.core.config import settings`).

## OVERVIEW

Saat ini hanya Recon dan Craft yang tracking token — tapi implementasinya rusak 
karena arsitektur yang terlalu kompleks (frontend menyimpan ke sessionStorage, 
lalu mengirim balik ke backend). Kita akan menyederhanakan:

**Arsitektur Baru: SETIAP backend endpoint menulis token-nya sendiri ke Supabase.**
Tidak ada lagi passing token via frontend sessionStorage.

Pipeline yang konsumsi AI:

| Pipeline | Endpoint | Service Function | Token Field DB |
|---|---|---|---|
| Recon | `POST /api/recon` | `openai_service.synthesize_profile()` | `token_recon` |
| Match | `POST /api/match` | `openai_service.run_matching()` | `token_match` |
| Craft | `POST /api/craft` | `craft_service.generate_campaign_emails()` | `token_craft` |
| Polish | `POST /api/craft/rewrite` | `craft_service.rewrite_email_tone_async()` | `token_polish` ← BARU |

---

## TASK 1 — Database: Tambah Kolom `token_polish`

Gunakan Supabase MCP untuk menjalankan migration:

```sql
ALTER TABLE campaign_analytics 
ADD COLUMN IF NOT EXISTS token_polish integer DEFAULT 0;
```

Verifikasi kolom ada:
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'campaign_analytics' 
AND column_name LIKE 'token_%';
```

Expected output: `token_recon`, `token_match`, `token_craft`, `token_polish` 
— semua integer, default 0.

---

## TASK 2 — Backend Shared Helper: `_write_token()`

Buat file baru: `backend/app/services/token_writer.py`

Ini adalah shared helper yang dipanggil oleh SEMUA router (recon, match, craft).
Menggunakan `httpx` (bawaan FastAPI) untuk REST API call ke Supabase.
WAJIB gunakan `from app.core.config import settings` — BUKAN `os.environ.get()`.

```python
"""
token_writer.py — Shared helper untuk menulis token usage ke Supabase.

Semua router memanggil write_token() setelah AI call selesai.
Non-fatal: jika gagal, hanya log warning — pipeline tetap berjalan.
"""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_IDR_PER_TOKEN = 0.000163  # ~Rp per token (GPT-4o $10/1M tokens, kurs Rp 16.300)


async def write_token(
    campaign_id: str,
    field: str,      # "token_recon" | "token_match" | "token_craft" | "token_polish"
    tokens: int,
) -> None:
    """
    Tulis atau AKUMULASI token ke campaign_analytics.

    Untuk token_polish, nilainya di-increment (karena user bisa rewrite 
    beberapa kali). Untuk field lain, nilainya di-overwrite.

    Jika campaign_id tidak ditemukan di campaign_analytics, skip silently.
    """
    supabase_url = settings.NEXT_PUBLIC_SUPABASE_URL
    supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY

    if not supabase_url or not supabase_key:
        logger.warning("[token_writer] SKIP — SUPABASE_URL atau SERVICE_ROLE_KEY kosong")
        return

    if not campaign_id or tokens <= 0:
        return

    rest_url = f"{supabase_url}/rest/v1/campaign_analytics"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Read current values
        resp = await client.get(
            rest_url,
            params={
                "campaign_id": f"eq.{campaign_id}",
                "select": "token_recon,token_match,token_craft,token_polish,estimated_cost_idr",
            },
            headers=headers,
        )
        resp.raise_for_status()
        rows = resp.json()

        if not rows:
            logger.warning("[token_writer] campaign_id=%s not found in campaign_analytics", campaign_id)
            return

        current = rows[0]

        # 2. Calculate new value
        if field == "token_polish":
            # Polish accumulates (user mungkin rewrite berkali-kali)
            new_value = (current.get("token_polish") or 0) + tokens
        else:
            new_value = tokens

        # 3. Recalculate total cost
        token_recon  = new_value if field == "token_recon"  else (current.get("token_recon") or 0)
        token_match  = new_value if field == "token_match"  else (current.get("token_match") or 0)
        token_craft  = new_value if field == "token_craft"  else (current.get("token_craft") or 0)
        token_polish = new_value if field == "token_polish" else (current.get("token_polish") or 0)
        total = token_recon + token_match + token_craft + token_polish

        # 4. Write
        update_resp = await client.patch(
            rest_url,
            params={"campaign_id": f"eq.{campaign_id}"},
            headers={**headers, "Prefer": "return=minimal"},
            json={
                field: new_value,
                "estimated_cost_idr": round(total * _IDR_PER_TOKEN),
            },
        )
        update_resp.raise_for_status()

    logger.info(
        "[token_writer] OK | campaign=%s field=%s tokens=%d total=%d idr=%d",
        campaign_id, field, new_value, total, round(total * _IDR_PER_TOKEN),
    )
```

---

## TASK 3 — Match: Tracking Token

### 3a. Service: `run_matching()` return tuple

File: `backend/app/services/openai_service.py`, function `run_matching()` (baris 470)

Saat ini baris 560-561:
```python
logger.info("[openai] run_matching OK | matches=%d", len(result))
return result
```

Ubah menjadi:
```python
tokens_used = response.usage.total_tokens if response.usage else 0
logger.info("[openai] run_matching OK | matches=%d tokens=%d", len(result), tokens_used)
return result, tokens_used
```

### 3b. Router: `match.py` tangkap token dan tulis ke Supabase

File: `backend/app/api/routers/match.py`

Tambahkan import di atas:
```python
from app.services.token_writer import write_token
```

Ubah baris 105:
```python
# SEBELUM:
matches = await openai_service.run_matching(profile, catalog)

# SESUDAH:
matches, match_tokens = await openai_service.run_matching(profile, catalog)
```

Tambahkan setelah logger.info "[POST /api/match] DONE" (sebelum `return`):
```python
# Tulis token ke Supabase — non-fatal
campaign_id = payload.campaign_id  # <-- perlu tambah field ini di MatchRequest
if campaign_id:
    try:
        await write_token(campaign_id, "token_match", match_tokens)
    except Exception as e:
        logger.warning("[POST /api/match] token write FAILED (non-fatal): %s", e)
```

### 3c. Schema: Tambah `campaign_id` di MatchRequest

File: `backend/app/models/schemas.py`, class `MatchRequest` (cari di file)

Tambahkan field optional:
```python
class MatchRequest(BaseModel):
    companyProfile: CompanyProfile
    campaign_id: Optional[str] = None   # ← TAMBAH INI
```

### 3d. Frontend: Kirim `campaign_id` saat match

File: `lib/api/match.ts`

Cari fungsi yang memanggil `POST /api/match` dan tambahkan `campaign_id` dari 
session ke request body:

```typescript
const body = {
  companyProfile: profile,
  campaign_id: session.getCampaignId() ?? undefined,  // ← TAMBAH INI
}
```

---

## TASK 4 — Recon: Backend Langsung Tulis Token (Bypass Frontend)

Saat ini alur Recon token sangat fragile:
Backend → response `tokens_used` → frontend sessionStorage → kirim ke Craft → 
Craft menulis ke Supabase. Jika ada 1 step yang gagal, data hilang.

**Perbaikan: Backend Recon langsung menulis ke Supabase.**

### 4a. Router: `recon.py` tulis token langsung

File: `backend/app/api/routers/recon.py`

Tambahkan import:
```python
from app.services.token_writer import write_token
```

Di endpoint `generate_recon()` (baris 293-295), setelah `run_recon_pipeline()` 
return sukses:

```python
try:
    profile, tokens_used = await run_recon_pipeline(url=url, mode=payload.mode)
    
    # Tulis token Recon langsung ke Supabase — non-fatal
    # campaign_id belum ada saat Recon, jadi ini di-skip saat ini
    # Token akan ditulis saat Craft menerima token_recon dari response
    
    return ReconResponse.model_validate({**profile.model_dump(), "tokens_used": tokens_used})
```

CATATAN: Saat Recon berjalan, campaign belum dibuat (campaign dibuat saat 
Match → proceed). Jadi Recon TIDAK bisa menulis langsung ke campaign_analytics.
Token Recon tetap dikirim via response → frontend → Craft. Ini OK karena 
mekanismenya sudah ada dan berfungsi.

Yang perlu dipastikan: `token_recon` yang dikirim frontend ke Craft HARUS 
benar. Cek `lib/session.ts` sudah punya `setReconTokens`/`getReconTokens`.

### 4b. Craft: Tetap terima `token_recon` dari frontend (TIDAK BERUBAH)

File: `backend/app/api/routers/craft.py` — SUDAH benar.
Craft menerima `token_recon` dari payload dan menulisnya bersama `token_craft`.

Tapi ganti fungsi `_write_tokens_to_supabase()` bawaan craft.py dengan 
shared `write_token()`:

```python
from app.services.token_writer import write_token

# Di dalam generate_craft(), ganti blok token write:
if payload.campaign_id:
    try:
        if payload.token_recon and payload.token_recon > 0:
            await write_token(payload.campaign_id, "token_recon", payload.token_recon)
        await write_token(payload.campaign_id, "token_craft", craft_tokens)
    except Exception as e:
        logger.warning("[POST /api/craft] token write FAILED (non-fatal): %s", e)
```

Hapus fungsi `_write_tokens_to_supabase()` lokal dari `craft.py` — sudah 
diganti oleh shared `token_writer.write_token()`.

---

## TASK 5 — Polish: Tracking Token Rewrite

### 5a. Service: `rewrite_email_tone_async()` return tuple

File: `backend/app/services/craft_service.py`, function `rewrite_email_tone_async()` 
(baris 350)

Saat ini baris 406-407:
```python
result = json.loads(content)
return result
```

Ubah menjadi:
```python
result = json.loads(content)
tokens_used = response.usage.total_tokens if response.usage else 0
logger.info("[craft_service] rewrite OK | tone=%r tokens=%d", new_tone, tokens_used)
return result, tokens_used
```

### 5b. Router: `craft.py` rewrite endpoint

File: `backend/app/api/routers/craft.py`, endpoint `regenerate_craft_tone()`

Ubah unpacking:
```python
# SEBELUM:
result = await craft_service.rewrite_email_tone_async(...)

# SESUDAH:
result, polish_tokens = await craft_service.rewrite_email_tone_async(...)
```

Tambahkan token write setelah berhasil:
```python
# Tulis token Polish ke Supabase — akumulatif (bisa rewrite berkali-kali)
if payload.campaign_id:
    try:
        await write_token(payload.campaign_id, "token_polish", polish_tokens)
    except Exception as e:
        logger.warning("[POST /api/craft/rewrite] token write FAILED (non-fatal): %s", e)
```

### 5c. Schema: Tambah `campaign_id` di RewriteRequest

File: `backend/app/models/schemas.py`, class `RewriteRequest` (baris 246)

Tambahkan field optional:
```python
class RewriteRequest(BaseModel):
    targetCompany:     str
    originalSubject:   str
    originalBody:      str
    campaignReasoning: str
    newTone:           str
    sequenceNumber:    int
    campaign_id:       Optional[str] = None  # ← TAMBAH INI
```

### 5d. Frontend: Kirim `campaign_id` saat rewrite

File: `lib/api/craft.ts`, interface `RewriteRequestPayload` (baris 190)

Tambahkan field:
```typescript
export interface RewriteRequestPayload {
  targetCompany: string
  originalSubject: string
  originalBody: string
  campaignReasoning: string
  newTone: string
  sequenceNumber: number
  campaign_id?: string  // ← TAMBAH INI
}
```

Dan di fungsi `regenerateEmailTone()`, pastikan `campaign_id` dari session 
sudah masuk di payload. Atau, caller di `app/polish/page.tsx` harus pass 
`campaign_id`:

Cari di `app/polish/page.tsx` dimana `regenerateEmailTone()` dipanggil dan 
tambahkan `campaign_id: session.getCampaignId()` ke payload.

---

## TASK 6 — Frontend: Update Dashboard Pulse

### 6a. TypeScript type

File: `types/analytics.types.ts`

Tambahkan field `polish`:
```typescript
export interface TokenUsage {
  recon: number
  match: number
  craft: number
  polish: number          // ← TAMBAH INI
  total: number
  estimatedCostIDR: number
}
```

### 6b. Analytics API

File: `lib/api/analytics.ts`

Tambahkan `token_polish` di SELECT query (baris 44):
```typescript
.select(`
  emails_sent, open_rate, click_rate, reply_rate,
  benchmark_open_rate, benchmark_click_rate, benchmark_reply_rate,
  token_recon, token_match, token_craft, token_polish, estimated_cost_idr,
  timeline
`)
```

Dan update return value (baris 121-124):
```typescript
const recon  = caData.token_recon  ?? 0
const match  = caData.token_match  ?? 0
const craft  = caData.token_craft  ?? 0
const polish = caData.token_polish ?? 0    // ← TAMBAH INI

return {
  // ...
  tokenUsage: {
    recon,
    match,
    craft,
    polish,                                // ← TAMBAH INI
    total: recon + match + craft + polish,  // ← UPDATE INI
    estimatedCostIDR: caData.estimated_cost_idr ?? 0,
  },
}
```

Dan update fallback (baris 117):
```typescript
tokenUsage: { recon: 0, match: 0, craft: 0, polish: 0, total: 0, estimatedCostIDR: 0 },
```

### 6c. TokenUsageCard: Tambah Stage Polish

File: `app/pulse/components/TokenUsageCard.tsx`

Tambahkan di array `STAGES` (baris 27-49), setelah entry "craft":
```typescript
{
  key: "polish",
  label: "Polish",
  icon: <Sparkles className="w-3.5 h-3.5" />,
  color: "text-amber-600",
  bgColor: "bg-amber-100",
},
```

Import `Sparkles` dari `lucide-react` (di baris 3).

Update interface `StageRow` baris 13:
```typescript
key: keyof Pick<TokenUsage, "recon" | "match" | "craft" | "polish">
```

---

## TASK 7 — Frontend Match: Kirim campaign_id

File: `lib/api/match.ts`

Cari fungsi yang memanggil `POST /api/match` ke FastAPI. Tambahkan 
`campaign_id: session.getCampaignId() ?? undefined` ke request body.

Jika campaign_id belum tersedia saat Match (karena campaign dibuat SETELAH 
match di Supabase), maka:
- Backend `match.py` harus handle `campaign_id = None` gracefully (sudah — 
  Optional field)
- Token match bisa ditulis NANTI saat campaign dibuat, ATAU kita skip token 
  match untuk sekarang

Cek di `lib/api/match.ts` apakah `session.getCampaignId()` sudah terisi 
saat Match dipanggil. Jika belum, skip task ini dan biarkan `token_match = 0` 
untuk sekarang — fokuskan ke Polish yang pasti bisa karena campaign_id sudah ada.

---

## VERIFICATION

Setelah semua task selesai:

1. `npx tsc --noEmit` → 0 errors
2. `python -m py_compile backend/app/services/token_writer.py` → OK
3. `python -m py_compile backend/app/api/routers/craft.py` → OK
4. `python -m py_compile backend/app/api/routers/match.py` → OK
5. Restart uvicorn → harus muncul `Application startup complete` tanpa error
6. Jalankan pipeline penuh: Recon → Match → Craft
   - Cek uvicorn log: `[token_writer] OK | ... field=token_craft ...`
7. Buka Polish → ganti tone 1 email →
   - Cek uvicorn log: `[token_writer] OK | ... field=token_polish ...`
8. Buka Pulse → kartu "Penggunaan Token AI" menampilkan:
   - Recon: > 0 (jika pipeline full)
   - Match: mungkin 0 (jika campaign_id belum tersedia saat match)
   - Craft: > 0
   - Polish: > 0 (jika tone diubah)
   - Total: sum semua
   - Estimasi Biaya: > Rp 0

Laporkan hasil lengkap termasuk log uvicorn.
