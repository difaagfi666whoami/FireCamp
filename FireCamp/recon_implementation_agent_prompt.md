# Agent Prompt: Recon Pipeline Two-Pass Architecture Implementation

> Dokumen ini adalah instruksi lengkap untuk subagent yang akan mengeksekusi
> perubahan pada pipeline Recon di project FireCamp.
> Baca seluruh dokumen sebelum memulai pekerjaan apapun.

---

## Konteks Project

**FireCamp (Campfire)** adalah B2B outreach automation tool dengan pipeline:
`Recon → Match → Craft → Polish → Launch → Pulse`

Stack:
- Frontend: Next.js 14 (App Router) di `/Users/difaagfi/Documents/Project/FireCamp`
- Backend: FastAPI di `backend/app/`
- Database: Supabase (PostgreSQL)
- AI: OpenAI GPT-4o + GPT-4o-mini
- UI: shadcn/ui + Tailwind CSS
- Icons: Lucide React only

**Working directory:** `/Users/difaagfi/Documents/Project/FireCamp`

**Aturan wajib:**
- Semua UI text dalam Bahasa Indonesia
- Semua code (variable, function, comment) dalam English
- Jangan tambah library baru yang tidak ada di package.json
- Jangan ubah file di luar scope yang ditentukan di bawah

---

## Masalah yang Harus Diselesaikan

### Masalah A: 6 Bug Disconnection (Frontend ↔ Backend ↔ Database)

```
BUG 1: intentSignals tidak pernah disimpan ke Supabase
        Lokasi: lib/api/recon.ts → saveCompanyProfile()
        Akibat: IntentSignalsCard selalu kosong setelah redirect ke /recon/[id]

BUG 2: signalType pada news item tidak di-map saat getCompanyById
        Lokasi: lib/api/recon.ts → getCompanyById()
        Akibat: signalType selalu undefined setelah fetch dari DB

BUG 3: techStack tidak pernah disimpan ke Supabase
        Lokasi: lib/api/recon.ts → saveCompanyProfile()
        Akibat: StrategicSidebar tech stack selalu kosong setelah redirect

BUG 4: mode (free/pro) tidak dikirim ke backend API
        Lokasi: lib/api/recon.ts → generateReconProfile()
        Akibat: selalu jalan dalam free mode meski user pilih Pro

BUG 5: matchAngle belum ada di schema manapun
        Lokasi: types/recon.types.ts + backend/app/models/schemas.py
        Akibat: pain points tidak punya sales framing

BUG 6: Anomaly, Citation, situationalSummary belum ada di mana pun
        Akibat: fitur baru tidak bisa dirender
```

### Masalah B: Output Recon Generik & Ada Hallucination

Pipeline sekarang mensintesis dari **snippet Google** (2-3 kalimat), bukan
dari full article content. Akibatnya:
- Strategic report berisi klaim AI tanpa evidence (hallucination)
- Pain points ada yang merupakan inferensi terbalik yang salah
- Tidak ada citation/source yang bisa diklik untuk verifikasi
- Framing salah: menulis "tentang bisnis perusahaan" bukan
  "intelligence untuk sales team"

### Masalah C: Two-Pass Architecture Belum Diimplementasi

**Sekarang (satu pass):**
```
Serper/Tavily search → snippet → langsung ke synthesizer
```

**Yang dibutuhkan (dua pass):**
```
Pass 1: Discovery (URLs + snippets) — sudah ada
Pass 2: Deep Read (fetch full article via Jina Reader) — BELUM ADA
```

Lanes yang perlu two-pass: **A, C, D, E**
Lane F dan G sudah solid, jangan diubah.

---

## Output yang Diharapkan Setelah Implementasi

Mengacu pada demo yang sudah divalidasi, output pipeline Recon harus menghasilkan:

```
1. Strategic title yang spesifik ke kondisi perusahaan target
2. Kapabilitas internal dengan citation [source: URL | media | tanggal]
3. Situational summary: 1 paragraf briefing untuk DM (kenapa approach sekarang)
4. Pain points: spesifik, cited, ada matchAngle (sales framing)
5. Anomali terdeteksi: patterns yang tidak normal (evidence-bound)
6. Intent signals dengan verifiedAmount + verifiedDate dari artikel asli
7. News dengan summary real (bukan snippet Google)
8. Key contacts dengan disclaimer jika data dari indeks publik
```

---

## Sprint 1 — Fix Foundation & Disconnections

**Tujuan:** Fix semua 6 bug disconnection, tambah schema baru, upgrade Lane C.
Semua perubahan Sprint 1 bersifat backward-compatible.

---

### S1-1: Supabase Migration Baru

Buat file baru:
`/Users/difaagfi/Documents/Project/FireCamp/supabase/migrations/014_recon_twopass_schema.sql`

Isi file:

```sql
-- Tambah kolom baru ke tabel companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS tech_stack          TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS situational_summary TEXT,
  ADD COLUMN IF NOT EXISTS anomalies           JSONB   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS citations           JSONB   DEFAULT '[]'::jsonb;

-- Tambah match_angle ke tabel pain_points
ALTER TABLE pain_points
  ADD COLUMN IF NOT EXISTS match_angle TEXT;

-- Buat tabel intent_signals (Lane D + E data)
CREATE TABLE IF NOT EXISTS intent_signals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  date            TEXT,
  source          TEXT,
  summary         TEXT,
  url             TEXT,
  signal_type     TEXT        NOT NULL,
  verified_amount TEXT,
  verified_date   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intent_signals_company_id
  ON intent_signals (company_id);

ALTER TABLE intent_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_intent_signals" ON intent_signals
  FOR ALL USING (true) WITH CHECK (true);
```

Setelah membuat file, jalankan migration menggunakan Supabase MCP tool
`mcp__supabase__apply_migration`.

---

### S1-2: Tambah `fetch_and_extract_urls` ke `external_apis.py`

File: `backend/app/services/external_apis.py`

Tambahkan fungsi baru ini di **akhir file**, setelah fungsi `fetch_jina_reader`:

```python
async def fetch_and_extract_urls(
    urls: list[str],
    max_urls: int = 3,
    timeout_per_url: float = 10.0,
) -> list[dict[str, Any]]:
    """
    Two-Pass utility: fetch full content dari top URLs via Jina Reader.
    Dipakai oleh Lane A, C, D, E untuk deep read setelah Pass 1 discovery.

    Returns:
        List dict { url, content, fetched_at } — hanya URL yang berhasil.
        Empty list jika semua gagal — tidak pernah raise exception.
    """
    import asyncio
    from datetime import datetime, timezone

    target_urls = [u for u in urls if u and u.strip()][:max_urls]
    if not target_urls:
        return []

    semaphore = asyncio.Semaphore(3)

    async def _fetch_one(url: str) -> dict[str, Any] | None:
        async with semaphore:
            try:
                content = await asyncio.wait_for(
                    fetch_jina_reader(url),
                    timeout=timeout_per_url,
                )
                if content and len(content) > 200:
                    return {
                        "url": url,
                        "content": content[:8000],
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                    }
                return None
            except asyncio.TimeoutError:
                logger.warning("[extract_urls] TIMEOUT | url=%r", url[:60])
                return None
            except Exception as exc:
                logger.warning("[extract_urls] FAILED | url=%r: %s", url[:60], exc)
                return None

    results = await asyncio.gather(*[_fetch_one(u) for u in target_urls])
    fetched = [r for r in results if r is not None]
    logger.info(
        "[extract_urls] DONE | requested=%d fetched=%d",
        len(target_urls), len(fetched),
    )
    return fetched
```

---

### S1-3: Update `types/recon.types.ts`

File: `types/recon.types.ts`

Baca file ini lebih dulu, lalu lakukan perubahan berikut:

**Tambah dua interface baru** sebelum interface `StrategicReport`:

```typescript
export interface Citation {
  url: string
  title: string
  source: string
  date: string
}

export interface Anomaly {
  title: string
  observation: string
  implication: string
  evidenceUrl?: string
}
```

**Update interface `StrategicReport`** — tambah dua field opsional:

```typescript
// Tambah di dalam StrategicReport:
citations?: Citation[]
situationalSummary?: string
```

**Update interface `PainPoint`** — tambah satu field opsional:

```typescript
// Tambah di dalam PainPoint:
matchAngle?: string
```

**Update interface `IntentSignal`** — tambah dua field opsional:

```typescript
// Tambah di dalam IntentSignal:
verifiedAmount?: string
verifiedDate?: string
```

**Update interface `CompanyProfile`** — tambah dua field opsional:

```typescript
// Tambah di dalam CompanyProfile:
anomalies?: Anomaly[]
situationalSummary?: string
```

---

### S1-4: Update `backend/app/models/schemas.py`

File: `backend/app/models/schemas.py`

Baca file lebih dulu. Lakukan perubahan berikut:

**Tambah dua model baru** sebelum model `StrategicReport`:

```python
class Citation(BaseModel):
    url:    str = ""
    title:  str = ""
    source: str = ""
    date:   str = ""


class Anomaly(BaseModel):
    title:        str = ""
    observation:  str = ""
    implication:  str = ""
    evidenceUrl:  str = ""
```

**Update `StrategicReport`** — tambah dua field:

```python
citations:          list[Citation] = []
situationalSummary: str            = ""
```

**Update `PainPoint`** — tambah satu field:

```python
matchAngle: str = ""
```

**Update `IntentSignal`** — tambah dua field optional:

```python
from typing import Optional
# (pastikan Optional sudah diimport)

verifiedAmount: Optional[str] = None
verifiedDate:   Optional[str] = None
```

**Update `CompanyProfile`** — tambah dua field:

```python
anomalies:          list[Anomaly] = []
situationalSummary: str           = ""
```

---

### S1-5: Upgrade Lane C — Two-Pass News Extraction

File: `backend/app/services/lane_c_service.py`

Baca seluruh file. Temukan fungsi `_extract_news_signals` (atau nama serupa
yang memanggil OpenAI untuk memproses artikel berita).

Update system prompt dalam fungsi tersebut menjadi:

```python
system_content = (
    "Kamu adalah fact-extractor B2B. "
    "ATURAN KERAS: ekstrak HANYA fakta yang BENAR-BENAR ada di dalam artikel. "
    "DILARANG: inference, tambah konteks, atau generalisasi industri. "
    "Jika artikel tidak menyebut angka spesifik → jangan tulis angka. "
    "Jika tanggal tidak disebutkan eksplisit → isi verified_date dengan null. "
    "Balas JSON: {\n"
    "  \"event_summary\": \"1 kalimat, hanya fakta dari artikel\",\n"
    "  \"implied_challenge\": \"1 kalimat implikasi bisnis bagi perusahaan\",\n"
    "  \"pain_category\": \"Marketing|Operations|Technology|Growth\",\n"
    "  \"signal_type\": \"direct|regulatory|competitive|technology|intent\",\n"
    "  \"verified_amount\": \"angka exact dari artikel atau null\",\n"
    "  \"verified_date\": \"tanggal exact dari artikel atau null\"\n"
    "}"
)
```

Tambahkan juga **Pass 2 deep read** sebelum memanggil OpenAI.
Temukan bagian di mana fungsi mengambil konten artikel (biasanya dari
`jina_contents` atau `raw_content`). Tambahkan pemanggilan
`fetch_and_extract_urls` untuk URL yang belum punya konten panjang:

```python
from app.services.external_apis import fetch_and_extract_urls

# Kumpulkan URL yang kontennya pendek (masih snippet)
short_content_urls = [
    art.get("url", "") for art, content in zip(articles, jina_contents)
    if len(content) < 500 and art.get("url")
]

# Fetch full content untuk URL tersebut
if short_content_urls:
    deep_pages = await fetch_and_extract_urls(short_content_urls, max_urls=3)
    # Buat lookup url -> content
    deep_lookup = {p["url"]: p["content"] for p in deep_pages}
    # Update jina_contents dengan konten yang lebih panjang
    for i, art in enumerate(articles):
        url = art.get("url", "")
        if url in deep_lookup:
            jina_contents[i] = deep_lookup[url]
```

---

### S1-6: Fix `lib/api/recon.ts` — Semua 6 Bug

File: `lib/api/recon.ts`

Baca seluruh file. Ini adalah file dengan 6 bug yang harus diperbaiki sekaligus.

**Fix BUG 4 — Tambah `mode` parameter ke `generateReconProfile`:**

```typescript
export async function generateReconProfile(
  url: string,
  mode: 'free' | 'pro' = 'free'
): Promise<CompanyProfile> {
  // ...
  body: JSON.stringify({ url, mode }),
```

**Fix BUG 3 — Tambah `tech_stack` ke insert di `saveCompanyProfile`:**

Dalam blok insert ke tabel `companies`, tambahkan:
```typescript
tech_stack:          profile.techStack          ?? [],
situational_summary: profile.strategicReport?.situationalSummary ?? null,
anomalies:           JSON.stringify(profile.anomalies ?? []),
citations:           JSON.stringify(profile.strategicReport?.citations ?? []),
```

**Fix BUG 1 — Tambah insert `intent_signals` di `saveCompanyProfile`:**

Setelah blok insert news, tambahkan:
```typescript
// Save intent signals
if (profile.intentSignals && profile.intentSignals.length > 0) {
  const intentSignalRows = profile.intentSignals.map(s => ({
    company_id:     companyId,
    title:          s.title,
    date:           s.date          ?? null,
    source:         s.source        ?? null,
    summary:        s.summary       ?? null,
    url:            s.url           ?? null,
    signal_type:    s.signalType,
    verified_amount: s.verifiedAmount ?? null,
    verified_date:   s.verifiedDate   ?? null,
  }))
  const { error: intentError } = await supabase
    .from('intent_signals')
    .insert(intentSignalRows)
  if (intentError) {
    console.error('[recon] intent_signals insert error:', intentError.message)
    // Non-fatal: lanjut meski gagal
  }
}
```

**Fix BUG 5 — Tambah `match_angle` ke insert pain_points:**

Dalam blok insert pain_points, tambahkan field:
```typescript
match_angle: pp.matchAngle ?? null,
```

**Fix BUG 2 + BUG 6 — Update select query dan mapping di `getCompanyById`:**

Update query `.select()` untuk mengambil field baru:

```typescript
const { data, error } = await supabase
  .from('companies')
  .select(`
    id, url, name, industry, size, founded, hq, description,
    deep_insights, strategic_report, recon_mode,
    tech_stack, situational_summary, anomalies, citations,
    linkedin_followers, linkedin_employees, linkedin_growth,
    progress_recon, progress_match, progress_craft,
    progress_polish, progress_launch, progress_pulse,
    created_at, cached_at,
    contacts (
      id, name, title, email, phone, linkedin_url, location,
      prospect_score, reasoning, connections, about, role_duration, source
    ),
    pain_points (
      id, category, issue, severity, source_url, source_title, match_angle
    ),
    news (
      id, title, published_date, source, summary, url, signal_type
    ),
    intent_signals (
      id, title, date, source, summary, url,
      signal_type, verified_amount, verified_date
    )
  `)
  .eq('id', id)
  .single()
```

Update mapping hasil query — tambah field-field baru:

```typescript
// Dalam mapping news:
signalType: n.signal_type ?? undefined,    // Fix BUG 2

// Dalam mapping pain_points:
matchAngle: p.match_angle ?? undefined,    // Fix BUG 5

// Tambah mapping intent_signals:
intentSignals: (data.intent_signals ?? []).map((s: any) => ({
  title:          s.title,
  date:           s.date          ?? '',
  source:         s.source        ?? '',
  summary:        s.summary       ?? '',
  url:            s.url           ?? '',
  signalType:     s.signal_type,
  verifiedAmount: s.verified_amount ?? undefined,
  verifiedDate:   s.verified_date   ?? undefined,
})),

// Tambah mapping field baru di company:
techStack:          data.tech_stack ?? [],
situationalSummary: data.situational_summary ?? undefined,
anomalies:          typeof data.anomalies === 'string'
                      ? JSON.parse(data.anomalies)
                      : (data.anomalies ?? []),
```

Juga update mapping `strategicReport` untuk menyertakan citations:
```typescript
strategicReport: data.strategic_report ? {
  ...data.strategic_report,
  citations:          data.citations
                        ? (typeof data.citations === 'string'
                            ? JSON.parse(data.citations)
                            : data.citations)
                        : [],
  situationalSummary: data.situational_summary ?? '',
} : undefined,
```

---

### S1-7: Fix Mode Passthrough di `app/recon/page.tsx`

File: `app/recon/page.tsx`

Baca file. Tambahkan state untuk mode:

```typescript
const [reconMode, setReconMode] = useState<'free' | 'pro'>('free')
```

Update pemanggilan `generateReconProfile` untuk menyertakan mode:
```typescript
generateReconProfile(reconUrl, reconMode)
```

Pastikan `ReconModeSelector` (jika sudah dirender) memanggil `setReconMode`
saat user ganti mode. Jika belum ada `onModeChange` prop, tambahkan.

---

## Sprint 2 — Two-Pass Lane D & E

**Tujuan:** Lane D (hiring signals) dan Lane E (money signals) mendapat
full article read dengan verified facts.

---

### S2-1: Upgrade Lane D — Two-Pass Hiring Signals

File: `backend/app/services/lane_d_service.py`

Baca seluruh file. Tambahkan fungsi internal baru sebelum `fetch_hiring_signals`:

```python
async def _deep_read_hiring_signals(
    raw_results: list[dict[str, Any]],
    company_name: str,
) -> list[dict[str, Any]]:
    """
    Pass 2: Fetch halaman job posting via Jina, extract sinyal bisnis spesifik.
    Graceful fallback ke raw_results jika fetch gagal.
    """
    import asyncio
    import json as _json
    from openai import AsyncOpenAI
    from app.services.external_apis import fetch_and_extract_urls
    from app.core.config import settings

    top_urls = [r["url"] for r in raw_results[:3] if r.get("url")]
    if not top_urls:
        return raw_results

    fetched_pages = await fetch_and_extract_urls(top_urls, max_urls=3)
    if not fetched_pages:
        return raw_results

    client    = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    enriched: list[dict[str, Any]] = []

    for page in fetched_pages:
        url      = page["url"]
        content  = page["content"]
        original = next((r for r in raw_results if r.get("url") == url), {})

        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=400,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Kamu adalah analis B2B. Dari halaman lowongan kerja ini, "
                            "ekstrak sinyal bisnis yang relevan untuk sales outbound. "
                            "HANYA fakta yang ada di halaman — jangan inference. "
                            "Balas JSON: {"
                            "\"job_title\": string, "
                            "\"key_requirements\": [string], "
                            "\"team_signal\": string, "
                            "\"business_signal\": string, "
                            "\"verified_date\": string|null"
                            "}"
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Perusahaan: {company_name}\n"
                            f"URL: {url}\n\n"
                            f"Konten halaman:\n{content[:3000]}"
                        ),
                    },
                ],
            )
            parsed = _json.loads(response.choices[0].message.content or "{}")
            reqs   = parsed.get("key_requirements", [])[:3]
            enriched.append({
                "title":         f"[LOWONGAN] {parsed.get('job_title', original.get('title', ''))}",
                "date":          parsed.get("verified_date") or original.get("date", ""),
                "source":        original.get("source", "Job Board"),
                "summary": (
                    f"{parsed.get('business_signal', '')}. "
                    f"Requirements: {', '.join(reqs)}"
                ).strip(". "),
                "url":           url,
                "signal_type":   "hiring",
                "verifiedDate":  parsed.get("verified_date"),
            })
        except Exception as exc:
            logger.warning("[lane_d] _deep_read FAILED url=%r: %s", url[:60], exc)
            enriched.append(original)

    return enriched if enriched else raw_results
```

Update fungsi `fetch_hiring_signals` — tambahkan pemanggilan deep read
setelah Pass 1 mengumpulkan `results`:

```python
# Setelah Pass 1 selesai dan results tidak kosong:
if results:
    results = await _deep_read_hiring_signals(results, company_name)

return results[:max_items]
```

---

### S2-2: Upgrade Lane E — Two-Pass Money Signals

File: `backend/app/services/lane_e_service.py`

Baca seluruh file. Tambahkan fungsi internal baru:

```python
async def _deep_read_money_signal(
    raw_items: list[dict[str, Any]],
    company_name: str,
    signal_type: str,
) -> list[dict[str, Any]]:
    """
    Pass 2: Baca artikel funding/leadership secara penuh untuk verified facts.
    Graceful fallback ke raw_items jika fetch gagal.
    """
    import json as _json
    from openai import AsyncOpenAI
    from app.services.external_apis import fetch_and_extract_urls
    from app.core.config import settings

    top_urls = [r["url"] for r in raw_items[:2] if r.get("url")]
    if not top_urls:
        return raw_items

    fetched_pages = await fetch_and_extract_urls(top_urls, max_urls=2)
    if not fetched_pages:
        return raw_items

    client   = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    enriched: list[dict[str, Any]] = []

    for page in fetched_pages:
        url      = page["url"]
        content  = page["content"]
        original = next((r for r in raw_items if r.get("url") == url), {})

        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=350,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Ekstrak HANYA fakta dari artikel ini. "
                            "DILARANG inference atau tambah informasi. "
                            "Balas JSON: {"
                            "\"verified_amount\": string|null, "
                            "\"verified_date\": string|null, "
                            "\"key_actors\": [string], "
                            "\"use_of_funds\": string|null, "
                            "\"summary_one_sentence\": string"
                            "}"
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Perusahaan: {company_name}\n"
                            f"Tipe sinyal: {signal_type}\n\n"
                            f"Konten artikel:\n{content[:3000]}"
                        ),
                    },
                ],
            )
            parsed = _json.loads(response.choices[0].message.content or "{}")
            enriched.append({
                **original,
                "summary":        parsed.get("summary_one_sentence") or original.get("summary", ""),
                "verifiedAmount": parsed.get("verified_amount"),
                "verifiedDate":   parsed.get("verified_date"),
            })
        except Exception as exc:
            logger.warning("[lane_e] _deep_read FAILED url=%r signal=%s: %s", url[:60], signal_type, exc)
            enriched.append(original)

    return enriched if enriched else raw_items
```

Update fungsi utama di Lane E — setelah mengumpulkan raw items per signal type,
panggil deep read:

```python
# Setelah mengumpulkan raw items, sebelum return:
if raw_items:
    raw_items = await _deep_read_money_signal(raw_items, company_name, signal_type)
```

---

### S2-3: Update `openai_service.py` — Inject Verified Fields ke IntentSignal

File: `backend/app/services/openai_service.py`

Baca seluruh file. Temukan blok di `synthesize_profile` yang mem-parse
`intent_signals` menjadi `IntentSignal` objects (sekitar baris 480-510,
cari `for i_sig in intent_signals`).

Update blok tersebut untuk menyertakan `verifiedAmount` dan `verifiedDate`:

```python
for i_sig in intent_signals:
    try:
        injected_intent.append(IntentSignal(
            title=          i_sig.get("title", ""),
            date=           i_sig.get("date", ""),
            source=         i_sig.get("source", ""),
            summary=        i_sig.get("summary", ""),
            url=            i_sig.get("url", ""),
            signal_type=    i_sig.get("signal_type") or "signal",
            verifiedAmount= i_sig.get("verifiedAmount"),
            verifiedDate=   i_sig.get("verifiedDate"),
        ))
    except Exception:
        pass
```

---

### S2-4: Update `IntentSignalsCard.tsx` — Tampilkan Verified Fields

File: `app/recon/components/IntentSignalsCard.tsx`

Baca file. Dalam render tiap signal item, tambahkan badge untuk
`verifiedAmount` dan `verifiedDate` setelah elemen summary/description:

```typescript
{(item.verifiedAmount || item.verifiedDate) && (
  <div className="flex flex-wrap gap-1.5 mt-2">
    {item.verifiedAmount && (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
        💰 {item.verifiedAmount}
      </span>
    )}
    {item.verifiedDate && (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/50">
        📅 {item.verifiedDate}
      </span>
    )}
  </div>
)}
```

Gunakan Lucide icons jika ingin ganti emoji:
- `DollarSign` untuk amount
- `Calendar` untuk date

---

## Sprint 3 — Strategic Report: 4-Layer Synthesis + Lane A Two-Pass

**Tujuan:** Lane A mendapat two-pass, synthesis diubah menjadi
sales-intelligence-first dengan anomaly detection dan citations.

---

### S3-1: Upgrade Lane A — Tambah Step 3.5 dan 3.6

File: `backend/app/services/lane_a_service.py`

Baca seluruh file. Pahami flow: Step 0 → 1 → 2 → 3 → 4 → 5 → 6.

**Tambahkan fungsi `_step3_5_filter_top_urls`** sebelum fungsi `_step4_parallel_distill`:

```python
def _step3_5_filter_top_urls(
    angle_results: dict[str, list[dict]],
    max_per_angle: int = 2,
) -> dict[str, list[str]]:
    """
    Step 3.5: Filter dan rank URL terbaik dari setiap angle search.
    Skip social media dan login-wall domains.
    """
    SKIP_DOMAINS = [
        "linkedin.com", "facebook.com", "instagram.com",
        "twitter.com", "x.com", "tiktok.com",
    ]

    angle_urls: dict[str, list[str]] = {}
    for angle, results in angle_results.items():
        scored: list[tuple[int, str]] = []
        for r in results:
            url = (r.get("url") or "").strip()
            if not url:
                continue
            if any(skip in url for skip in SKIP_DOMAINS):
                continue
            content_len = len(r.get("content", r.get("raw_content", "")))
            scored.append((content_len, url))
        scored.sort(reverse=True)
        angle_urls[angle] = [u for _, u in scored[:max_per_angle]]

    return angle_urls
```

**Tambahkan fungsi `_step3_6_extract_articles`** setelah fungsi di atas:

```python
async def _step3_6_extract_articles(
    angle_urls: dict[str, list[str]],
) -> dict[str, list[dict]]:
    """
    Step 3.6: Fetch full article content untuk setiap angle secara paralel.
    """
    from app.services.external_apis import fetch_and_extract_urls

    async def _fetch_angle(
        angle: str, urls: list[str]
    ) -> tuple[str, list[dict]]:
        if not urls:
            return angle, []
        fetched = await fetch_and_extract_urls(urls, max_urls=2)
        return angle, fetched

    tasks   = [_fetch_angle(a, u) for a, u in angle_urls.items() if u]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    angle_content: dict[str, list[dict]] = {}
    for result in results:
        if isinstance(result, Exception):
            logger.warning("[lane_a] Step3.6 angle fetch error: %s", result)
            continue
        angle, pages = result
        angle_content[angle] = pages

    total = sum(len(p) for p in angle_content.values())
    logger.info("[lane_a] Step3.6 DONE | total_pages=%d", total)
    return angle_content
```

**Update fungsi `_distill_one`** (atau nama serupa di dalam `_step4_parallel_distill`)
untuk menerima parameter `full_pages` opsional:

Cari baris di mana text untuk distillation disiapkan (biasanya mengambil
`content` atau `raw_content` dari results). Tambahkan kondisi:

```python
# Di awal _distill_one atau blok yang menyiapkan teks:
if full_pages:
    text = "\n\n---\n\n".join(
        f"URL: {p['url']}\nFetched: {p.get('fetched_at', '')}\n\n{p['content'][:3000]}"
        for p in full_pages
    )
else:
    # existing logic untuk format dari search results
    text = _format_results(results, max_items=4)
```

**Update `run_lane_a_advanced`** — tambahkan pemanggilan Step 3.5 dan 3.6
di antara Step 3 dan Step 4:

```python
# Setelah Step 3 (parallel search) selesai:
logger.info("[lane_a] Step 3.5 — filtering top URLs per angle")
angle_url_map  = _step3_5_filter_top_urls(angle_results)

logger.info("[lane_a] Step 3.6 — fetching full article content")
angle_content  = await _step3_6_extract_articles(angle_url_map)

# Step 4: pass full content ke distillation
final_insights = await _step4_parallel_distill(
    angle_results,
    company_name,
    angle_content=angle_content,   # parameter baru
)
```

---

### S3-2: Update `openai_service.py` — 4-Layer Synthesis

File: `backend/app/services/openai_service.py`

Baca seluruh fungsi `synthesize_profile`. Ini perubahan terbesar.

**Perubahan 1 — Update system prompt utama:**

Temukan `system_prompt` dalam `synthesize_profile`. Ubah instruksi
untuk menghasilkan output yang sales-intelligence-first.

Tambahkan instruksi berikut ke dalam system prompt (atau ganti bagian
yang relevan):

```python
# Tambahkan ke bagian aturan pain points:
"   - 'matchAngle': 1 kalimat sales framing. "
"     Format: 'Approach dengan [tipe solusi] untuk [outcome spesifik mereka].' "
"     Ini untuk DM yang akan pitch produk — bukan deskripsi masalah ulang.\n"

# Tambahkan ke bagian aturan strategic report:
"   - 'situationalSummary': 1 paragraf 3-4 kalimat briefing untuk Sales Manager. "
"     Jelaskan: kondisi perusahaan sekarang + kenapa ini timing yang tepat untuk approach. "
"     Tone: langsung, tidak bertele-tele. "
"     Contoh: 'PT X baru hiring 3 Head of Sales dalam 4 bulan — ada instabilitas. "
"     Mereka punya budget post-funding tapi eksekusi macet. "
"     Window optimal: 30-60 hari ke depan.'\n"

# Tambahkan instruksi citations:
"   - 'citations': Array of {url, title, source, date} dari evidence yang mendukung "
"     internalCapabilities dan marketDynamics. "
"     HANYA dari URL yang ada di evidence_list. "
"     Jangan buat URL baru. Minimal 2, maksimal 6.\n"

# Tambahkan instruksi anomalies (di level CompanyProfile):
"   - 'anomalies': Array of {title, observation, implication, evidenceUrl}. "
"     Isi HANYA jika ada pola tidak normal yang bisa dibuktikan dari data. "
"     Contoh valid: klaim 500 karyawan tapi 0 job posting = inkonsistensi. "
"     JANGAN isi jika tidak ada evidence yang mendukung.\n"
```

**Perubahan 2 — Ubah framing instruksi utama:**

Ganti kalimat pembuka system prompt dari:
> "Kamu adalah analis bisnis B2B..."

Menjadi:
> "Kamu adalah intelligence analyst untuk tim sales B2B. "
> "Tugasmu BUKAN menulis profil perusahaan — tugasmu menemukan "
> "informasi yang dibutuhkan DM untuk approach perusahaan ini dengan tepat. "
> "Setiap klaim harus berdasarkan data yang disediakan. "
> "Jangan generalisasi industri. Jangan inference tanpa evidence."

**Perubahan 3 — Pastikan Pydantic output model mencakup field baru:**

Temukan Pydantic model yang dipakai sebagai `response_format` dalam
`synthesize_profile`. Verifikasi bahwa model ini mencakup:
- `anomalies: list[Anomaly]`
- `situationalSummary: str` (dalam `strategicReport`)
- `citations: list[Citation]` (dalam `strategicReport`)
- `matchAngle: str` (dalam setiap `PainPoint`)

Jika model tersebut adalah class terpisah (bukan langsung `CompanyProfile`),
update untuk mencerminkan schema baru dari `schemas.py`.

---

### S3-3: Buat Komponen Baru `AnomalySection.tsx`

Buat file baru: `app/recon/components/AnomalySection.tsx`

```typescript
"use client"

import { Anomaly } from "@/types/recon.types"
import { AlertTriangle } from "lucide-react"

interface Props {
  anomalies?: Anomaly[]
}

export function AnomalySection({ anomalies }: Props) {
  if (!anomalies?.length) return null

  return (
    <div className="bg-amber-50/50 border border-amber-200/70 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 bg-amber-100 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
        <h3 className="font-bold text-[15px] text-foreground">
          Anomali Terdeteksi
        </h3>
        <span className="text-[12px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/50">
          {anomalies.length}
        </span>
      </div>

      <div className="space-y-3">
        {anomalies.map((a, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-amber-200/60 bg-white p-4 shadow-sm"
          >
            <p className="font-bold text-[13.5px] text-amber-800 mb-1.5">
              {a.title}
            </p>
            <p className="text-[13px] text-foreground/80 leading-snug mb-2">
              {a.observation}
            </p>
            <p className="text-[12.5px] text-muted-foreground italic leading-snug">
              {a.implication}
            </p>
            {a.evidenceUrl && (
              <a
                href={a.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-[11.5px] text-blue-600 hover:underline"
              >
                Lihat evidence →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

### S3-4: Update `PainPointList.tsx` — Tampilkan `matchAngle`

File: `app/recon/components/PainPointList.tsx`

Baca file. Temukan render tiap pain point item. Tambahkan display `matchAngle`
setelah citation link (atau di akhir tiap item):

```typescript
{pp.matchAngle && (
  <div className="mt-3 flex items-start gap-2 bg-brand-light/60 border border-brand/20 rounded-lg px-3 py-2">
    <span className="text-[10px] font-black uppercase tracking-wider text-brand mt-0.5 shrink-0 leading-none">
      Approach
    </span>
    <p className="text-[12px] text-brand/80 leading-snug">{pp.matchAngle}</p>
  </div>
)}
```

---

### S3-5: Update `CompanyHeader.tsx` — Tampilkan `situationalSummary`

File: `app/recon/components/CompanyHeader.tsx`

Baca file. Tambahkan display `situationalSummary` setelah blockquote
`executiveInsight` (jika ada):

```typescript
{sr?.situationalSummary && (
  <div className="mt-4 bg-muted/50 border border-border/50 rounded-xl px-4 py-3">
    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
      Situational Brief untuk DM
    </p>
    <p className="text-[13px] text-foreground/80 leading-relaxed">
      {sr.situationalSummary}
    </p>
  </div>
)}
```

Jika komponen ini tidak punya akses ke `strategicReport`, ambil dari
`company.strategicReport?.situationalSummary`.

---

### S3-6: Update `StrategicMainContent.tsx` — Citations Footer

File: `app/recon/components/StrategicMainContent.tsx`

Baca file. Tambahkan citations reference list di **akhir komponen**,
setelah semua kartu konten, sebelum closing return:

```typescript
{report?.citations && report.citations.length > 0 && (
  <div className="bg-slate-50 border border-border/50 rounded-2xl p-5 shadow-sm">
    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
      Sumber Referensi ({report.citations.length})
    </p>
    <ol className="space-y-2">
      {report.citations.map((c, idx) => (
        <li key={idx} className="flex gap-2 items-start text-[12px]">
          <span className="shrink-0 w-5 h-5 rounded-full bg-brand/10 text-brand text-[10px] font-black flex items-center justify-center mt-0.5">
            {idx + 1}
          </span>
          <div className="flex-1 min-w-0">
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium line-clamp-1"
            >
              {c.title || c.url}
            </a>
            {(c.source || c.date) && (
              <span className="text-muted-foreground ml-1">
                {c.source && `— ${c.source}`}
                {c.date && ` · ${c.date}`}
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  </div>
)}
```

---

### S3-7: Update `KeyContacts.tsx` — Disclaimer Banner

File: `app/recon/components/KeyContacts.tsx`

Baca file. Tambahkan disclaimer banner di bagian atas komponen,
sebelum list kontak:

```typescript
<div className="mb-3 flex items-start gap-2 bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-2.5">
  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
  <p className="text-[11.5px] text-amber-800 leading-snug">
    Data kontak bersumber dari indeks publik LinkedIn via Google.
    Verifikasi profil sebelum outreach.
  </p>
</div>
```

Import `AlertTriangle` dari `lucide-react` jika belum ada.

---

### S3-8: Update `app/recon/[id]/page.tsx` — Render `AnomalySection`

File: `app/recon/[id]/page.tsx`

Baca file. Import `AnomalySection`:

```typescript
import { AnomalySection } from "../components/AnomalySection"
```

Tambahkan render `AnomalySection` di kolom kiri (main content area),
setelah `StrategicMainContent` dan sebelum `PainPointList`:

```typescript
<AnomalySection anomalies={profile.anomalies} />
```

---

## Checklist Verifikasi Per Sprint

### Sprint 1 Verified ✓ jika:
- [ ] Migration 014 berhasil diapply (tidak ada error SQL)
- [ ] `fetch_and_extract_urls` ada di `external_apis.py` dan tidak error saat import
- [ ] `types/recon.types.ts` compile tanpa error (`npx tsc --noEmit`)
- [ ] `schemas.py` bisa diimport tanpa error
- [ ] `generateReconProfile` menerima parameter `mode`
- [ ] `saveCompanyProfile` menyimpan `tech_stack` dan `intent_signals`
- [ ] `getCompanyById` mengambil `intent_signals` dan `tech_stack` dari DB

### Sprint 2 Verified ✓ jika:
- [ ] Lane D mengembalikan hiring signals dengan `summary` yang lebih kaya dari snippet
- [ ] Lane E mengembalikan money signals dengan `verifiedAmount`/`verifiedDate` jika ada
- [ ] `IntentSignalsCard` menampilkan badge amount/date jika field ada

### Sprint 3 Verified ✓ jika:
- [ ] `AnomalySection.tsx` ter-render di `/recon/[id]` jika `anomalies` tidak kosong
- [ ] Tiap pain point menampilkan "Approach" block jika `matchAngle` ada
- [ ] `CompanyHeader` menampilkan "Situational Brief" jika `situationalSummary` ada
- [ ] Citations list muncul di bawah `StrategicMainContent` jika ada citations
- [ ] Disclaimer muncul di atas `KeyContacts`
- [ ] `npx tsc --noEmit` pass tanpa error

---

## Hal yang TIDAK Boleh Diubah

- Jangan ubah pipeline Match, Craft, Polish, Launch, Pulse
- Jangan ubah `lib/session.ts`
- Jangan ubah `lib/api/` kecuali `recon.ts`
- Jangan ubah komponen di luar `app/recon/`
- Jangan tambah library baru ke `package.json`
- Jangan ubah Tailwind config atau warna token
- Jangan ubah Lane B, Lane F, Lane G
- Jangan ubah `tavily_service.py`
- Jangan hapus atau rename fungsi yang sudah ada (hanya tambah/update)

---

## Urutan Eksekusi yang Aman

```
Sprint 1: S1-1 → S1-2 → S1-3 → S1-4 → S1-5 → S1-6 → S1-7
Sprint 2: S2-1 → S2-2 → S2-3 → S2-4
Sprint 3: S3-1 → S3-2 → S3-3 → S3-4 → S3-5 → S3-6 → S3-7 → S3-8
```

Jalankan `npx tsc --noEmit` setelah setiap sprint selesai.

---

*End of agent prompt. Mulai dari S1-1.*
