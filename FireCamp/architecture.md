# architecture.md — Tech Stack & Architecture

> Keputusan teknis proyek **Campfire**.
> Jangan install library atau buat folder baru di luar yang sudah didefinisikan di sini.
> File ini adalah sumber kebenaran teknis — semua perubahan stack harus didokumentasikan di sini.

---

## Riwayat Perubahan Stack

| Versi | Perubahan | Alasan |
|---|---|---|
| v1 | Proxycurl untuk LinkedIn data | — |
| v2 | Proxycurl → Apollo + Apify | Proxycurl shutdown Juli 2025 akibat lawsuit LinkedIn |
| v2 | Firecrawl dihapus | Tavily `/extract` sudah cover kebutuhan yang sama |
| v2 | Tavily expanded | Support `/search` + `/extract` + `/research` (Free + Pro mode) |
| v3 | Apollo + Apify → Serper.dev + Jina Reader | Apollo/Apify paywall tidak viable; Serper dorking + Jina article reader sudah cukup |
| v3 | Anthropic/Claude → OpenAI (gpt-4o + gpt-4o-mini) | Unifikasi vendor AI; gpt-4o Structured Output lebih reliabel untuk schema enforcement |
| v3 | Two-Lane → Three-Lane (Lane C: Dedicated News Engine) | News sering hilang di Lane A; Lane C menjamin UI News selalu terisi |
| v3 | Pro Mode = Agentic Confidence Gap Agent | Pro Mode lama hanya mengubah prompt output — penelitiannya identik dengan Free. Diganti dengan recursive research loop |

---

## Tech Stack

### Frontend
| Layer | Pilihan | Versi | Status |
|---|---|---|---|
| Framework | Next.js | 14.x (App Router) | Tidak berubah |
| Language | TypeScript | 5.x | Tidak berubah |
| Styling | Tailwind CSS | 3.x | Tidak berubah |
| UI Components | shadcn/ui | latest | Tidak berubah |
| Icons | Lucide React | latest | Tidak berubah |
| Charts | Recharts | 2.x | Tidak berubah |
| Forms | React Hook Form | 7.x | Tidak berubah |
| Data Fetching | TanStack Query | 5.x | Tidak berubah |
| HTTP Client | Axios | 1.x | Tidak berubah |

### Backend
| Layer | Pilihan | Status | Catatan |
|---|---|---|---|
| API | FastAPI (Python) | Tidak berubah | AI processing engine |
| Database | Supabase (PostgreSQL + pgvector) | Tidak berubah | Schema existing masih valid |
| AI — Synthesis | OpenAI GPT-4o | Aktif | Final synthesis via Structured Output (`beta.chat.completions.parse`) |
| AI — Distill | OpenAI GPT-4o-mini | Aktif | Gap analysis, query generation, distillation, contact scoring |
| Search & Extract | Tavily API | Aktif | `/search` (general + news) + `/extract` (homepage + sub-pages) |
| Contact Discovery | Serper.dev | Aktif | LinkedIn dorking via Google organic snippets |
| Article Extraction | Jina Reader | Aktif | Baca konten penuh artikel berita (`r.jina.ai/{url}`) |
| Automation | In-House (Vercel Cron + Resend API + Webhook) | Aktif | Email dispatch & tracking — n8n dihapus |
| Email | Resend | Tidak berubah | Email delivery |
| PDF Gen | Puppeteer | Tidak berubah | Export profil ke PDF |
| File Storage | Supabase Storage | Tidak berubah | PDF dan dokumen upload |
| ~~Contact Enrichment~~ | ~~Apollo.io~~ | DIHAPUS | Digantikan Serper dorking (v3) |
| ~~Contact Fallback~~ | ~~Apify LinkedIn Actor~~ | DIHAPUS | Digantikan Serper dorking (v3) |
| ~~LinkedIn Data~~ | ~~Proxycurl~~ | DIHAPUS | Shutdown Juli 2025 |
| ~~Web Scraping~~ | ~~Firecrawl~~ | DIHAPUS | Digantikan Tavily Extract |

---

## Folder Structure

```text
campfire/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        # Redirect ke /research-library
│   ├── research-library/
│   │   └── page.tsx
│   ├── recon/
│   │   ├── page.tsx
│   │   ├── [id]/
│   │   │   └── page.tsx
│   │   └── components/
│   │       ├── ReconForm.tsx
│   │       ├── ReconModeSelector.tsx
│   │       ├── CompanyHeader.tsx
│   │       ├── KeyContacts.tsx
│   │       ├── PainPointList.tsx
│   │       ├── NewsSection.tsx
│   │       └── LoadingSteps.tsx
│   ├── match/
│   │   ├── page.tsx
│   │   └── components/
│   │       ├── MatchingTab.tsx
│   │       ├── ProductCatalogTab.tsx
│   │       ├── ProductMatchCard.tsx
│   │       ├── ProductListItem.tsx
│   │       ├── ProductFormModal.tsx
│   │       └── PdfUploadZone.tsx
│   ├── craft/
│   │   ├── page.tsx
│   │   └── components/
│   │       ├── CampaignReasoning.tsx
│   │       └── EmailPreviewCard.tsx
│   ├── polish/
│   │   ├── page.tsx
│   │   └── components/
│   │       ├── ToneSelector.tsx
│   │       ├── EmailEditor.tsx
│   │       └── ApproveButton.tsx
│   ├── launch/
│   │   ├── page.tsx
│   │   └── components/
│   │       ├── ModeSelector.tsx
│   │       ├── AiScheduleView.tsx
│   │       └── ManualScheduleForm.tsx
│   └── pulse/
│       ├── page.tsx
│       └── components/
│           ├── StatCards.tsx
│           ├── PerformanceBarChart.tsx
│           ├── EngagementLineChart.tsx
│           └── TokenUsageCard.tsx
│
├── components/
│   ├── ui/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── MilestoneProgress.tsx
│   │   └── PageHeader.tsx
│   └── shared/
│       ├── Badge.tsx
│       ├── LoadingSteps.tsx
│       ├── EmptyState.tsx
│       ├── ConfirmDialog.tsx
│       └── CitationLink.tsx
│
├── hooks/
│   ├── use-recon.ts
│   ├── use-match.ts
│   ├── use-catalog.ts
│   ├── use-pdf-upload.ts
│   ├── use-craft.ts
│   ├── use-polish.ts
│   ├── use-launch.ts
│   └── use-pulse.ts
│
├── lib/
│   ├── mock/
│   │   └── mockdata.ts
│   ├── api/
│   │   ├── recon.ts
│   │   ├── matching.ts
│   │   ├── catalog.ts
│   │   ├── pdf-extract.ts
│   │   ├── craft.ts
│   │   └── analytics.ts
│   └── utils.ts
│
├── types/
│   ├── recon.types.ts
│   ├── match.types.ts
│   ├── craft.types.ts
│   └── analytics.types.ts
│
├── data/
│   └── mockdata.json
│
├── backend/
│   └── app/
│       ├── api/routers/
│       │   └── recon.py                # Orchestrator — Three-Lane Pipeline
│       ├── services/
│       │   ├── lane_a_service.py       # Company profiling (Tavily multi-round)
│       │   ├── lane_b_service.py       # Contact discovery (Serper dorking)
│       │   ├── lane_c_service.py       # News engine (Serper + Jina)
│       │   ├── openai_service.py       # Final synthesis + scoring (GPT-4o)
│       │   ├── tavily_service.py       # Tavily search/extract wrapper
│       │   └── external_apis.py        # Serper + Jina HTTP clients
│       └── models/
│           └── schemas.py              # Pydantic schemas
│
├── .env.local
├── .env.example
├── CLAUDE.md
├── specs.md
├── architecture.md
└── mockdata.md
```

---

## Recon — Three-Lane Pipeline Architecture

### Diagram Alur

```
Input: URL company + mode ('free' | 'pro')
             │
             ▼
    Step 0: Tavily /extract
    Baca homepage → ambil nama, domain, raw content (ground truth)
             │
   ┌─────────┼─────────┐
   │         │         │  ← asyncio.gather() — PARALEL
LANE A     LANE B     LANE C
Profiler   Contact    News
(Tavily)   (Serper)   (Serper+Jina)
   │         │         │
   └────┬────┘         │
        └──────┬───────┘
               ▼
    GPT-4o: synthesize_profile()
    Lane A (evidence + summary) + Lane B (contacts) + Lane C (news + pain signals)
    → CompanyProfile JSON (Pydantic Structured Output)
               │
               ▼
    Output: CompanyProfile ter-validasi
```

---

## Lane A — Company Profiling (7-Step Advanced Pipeline)

Lane A bertujuan menghasilkan "raw evidence string" sekaya mungkin untuk dikonsumsi `synthesize_profile()`.

```
Step 0: Tavily /extract homepage → raw_content (3000 chars, ground truth)
Step 1: GPT-4o-mini Gap Analysis → GapAnalysis (identified_gaps, known_facts, priority_research_areas)
Step 2: GPT-4o-mini Query Generation → QuerySet (6-angle taxonomy — lihat tabel di bawah)
Step 3: [PARALEL] Tavily Search per angle → hasil mentah dengan URL + content
Step 4: [PARALEL] GPT-4o-mini distill setiap batch → DistilledInsights (key_facts + named_entities + pain_signals)
Step 5: Tavily Deep Targeted Search (R3) → pakai entitas dari Step 4
Step 6: Gabung semua evidence → string DENGAN URL citation untuk setiap fakta
```

### QueryAngle Taxonomy (6 Sudut Wajib)

Setiap query yang di-generate HARUS mencakup 6 angle berikut. Ini bukan opsional — semua angle harus ada query-nya agar tidak ada blind spot dalam research.

| Angle | Query Target | Mengapa Penting untuk B2B |
|---|---|---|
| `REPUTATION` | `site:glassdoor.com "{company}"`, forum, review | Employee pain = company pain; mencerminkan masalah internal yang tidak pernah ada di press release |
| `TECH_STACK` | Job postings, `site:builtwith.com`, `site:stackshare.io` | Open positions = proxy terbaik untuk tech gaps dan strategic priorities |
| `REGULATORY_EXPOSURE` | IDX filings, OJK, regulasi industri spesifik | Tekanan compliance = pain point yang sudah pasti ada anggarannya |
| `COMPETITIVE_POSITION` | `"{company}" vs OR alternative OR competitor` | Kelemahan yang disebutkan di halaman perbandingan = ammunition outreach |
| `FINANCIAL_SIGNALS` | Funding rounds, `site:crunchbase.com`, laporan keuangan | Capital stage menentukan strategi pitch |
| `CUSTOMER_VOICE` | `site:g2.com OR site:capterra.com "{company}"`, complaint, keluhan | Customer reviews = pain points yang sudah ter-artikulasi oleh orang yang merasakannya |

### Aturan Pengelolaan Evidence (Mencegah Information Loss)

**MASALAH LAMA:** Hasil Tavily di-distilasi oleh GPT-4o-mini dengan `max_tokens=800`, menghilangkan URL dan detail kualitatif. Akibatnya `sourceUrl` di pain points kosong atau hallusinasi.

**ATURAN BARU:**
1. Step 4 distillation **WAJIB** mempertahankan `source_url` per fakta — `key_facts` bukan plain string, melainkan `{"fact": "...", "url": "..."}`.
2. `_step6_combine()` **WAJIB** menyertakan `homepage_content` (raw, 3000 chars) sebagai section tersendiri — jangan hanya ambil `gap_analysis.known_facts`.
3. `synthesize_profile()` menerima dua input dari Lane A: (a) summary/narrative untuk orientasi, (b) `evidence_list` — array objek `{"fact": str, "url": str, "title": str}` untuk citation.
4. GPT-4o **HANYA boleh** menggunakan URL dari `evidence_list` sebagai `sourceUrl` pain point. Jika tidak ada URL yang cocok, `sourceUrl` = `""` dan `severity` = `"low"`.

### Deep Targeted Search — Domain Dinamis

Step 5 tidak lagi hardcode ke `idx.co.id` + `bisnis.com` untuk semua perusahaan.

| Kondisi Perusahaan | Domain Target R3 |
|---|---|
| Perusahaan publik (ada "Tbk" di nama atau ticker terdeteksi di R1) | `idx.co.id`, `bisnis.com`, `kontan.co.id` |
| Perusahaan fintech/perbankan | `ojk.go.id`, `cnbcindonesia.com`, `katadata.co.id` |
| Perusahaan SaaS / startup | `startupranking.com`, `producthunt.com`, `g2.com` |
| Perusahaan manufaktur/industri | `kemenperin.go.id`, `industri.co.id`, `bisnis.com` |
| Default (tidak terdeteksi) | `kontan.co.id`, `katadata.co.id`, `swa.co.id` |

---

## Lane B — Contact Discovery (Serper Dorking + Tiered Strategy)

### Arsitektur Baru (Target)

```
Step 1: Tavily /extract sub-pages perusahaan
        → target /about, /team, /management, /direksi
        → ekstrak nama eksekutif dari sumber primer (ground truth, pasti current)

Step 2: [PARALEL] Serper Dorking — 3 tier query
        Tier 1: site:linkedin.com/in "{company}" (CEO OR CTO OR Founder OR President OR "Chief")
        Tier 2: site:linkedin.com/in "{company}" (VP OR Director OR "Head of" OR GM)
        Tier 3: site:linkedin.com/in "@{domain}" (Manager OR Lead OR Senior)
        → Prioritaskan Tier 1; gunakan Tier 2-3 hanya jika Tier 1 < 2 hasil

Step 3: Validasi Ketat per kontak
        → Temporal filter: tolak jika snippet mengandung (formerly | ex- | alumni | previously | tahun range "2019–2022")
        → Company match: verifikasi dengan nama dari Step 1 (team page) jika tersedia
        → Threshold: prospectScore >= 55 (bukan 30)

Step 4: GPT-4o-mini score_contacts() — output terstruktur 5-field per kontak
        (lihat "Reasoning Structure" di bawah)
```

### Contact Reasoning Structure (Bukan 1 Kalimat)

`reasoning` di `PicContact` harus berisi brief outreach, bukan justifikasi scoring. Format:

```
[MANDATE] Kemungkinan sedang fokus pada: {apa yang sedang dikerjakan orang ini berdasarkan jabatan + konteks}
[PAIN OWNERSHIP] Kategori pain yang dia miliki: {Marketing | Operations | Technology | Growth}
[HOOK] Opening conversation yang tepat: {1 kalimat spesifik berdasarkan data}
[RECENCY SIGNAL] Bukti employment saat ini: {ada/tidak ada, berdasarkan snippet}
```

Panjang: 4 kalimat. Bukan ringkasan jabatan, bukan generik.

---

## Lane C — Dedicated News Engine (NewsSignal Architecture)

### Arsitektur Baru (Target)

```
Step 1: Serper multi-strategy news search (cascade fallback tetap sama)
        Strategy 1-4: direct company news
        Strategy 5: contextual signals (BUKAN generic industry news)
            → Regulatory: "OJK" OR "Kominfo" + {industry_label} + 2025/2026
            → Competitive: {top_competitor_from_r1_entities} + "ekspansi" OR "market share"
            → Technology: {tech_signals_from_job_postings} + "adoption" + "Indonesia enterprise"
        Strategy 6: DIHAPUS — generic "bisnis Indonesia teknologi" tidak boleh digunakan

Step 2: Jina Reader hanya untuk artikel TERATAS (1-2 artikel, bukan 4)
        → Ambil hingga 1500 chars konten penuh (bukan 2 kalimat)
        → Tujuan: beri GPT-4o bahan untuk quote verbatim di pain point reasoning

Step 3: NewsSignal Extraction — NEW STEP
        → Jalankan GPT-4o-mini per artikel
        → Output: {"event_summary": str, "implied_challenge": str, "pain_category": str}
        → Ini yang masuk ke synthesize_profile() sebagai "pain_signals_from_news" (bukan raw news)

Step 4: Return dua objek ke orchestrator:
        (a) news_items: list[NewsItem] — untuk di-inject ke profile.news (deterministic, bypass AI)
        (b) pain_signals_from_news: list[NewsSignal] — masuk ke synthesis prompt sebagai evidence
```

### Skema NewsSignal (Pydantic — baru)

```python
class NewsSignal(BaseModel):
    event_summary: str    # Apa yang terjadi (1 kalimat)
    implied_challenge: str # Implikasi bisnis untuk perusahaan target (1 kalimat)
    pain_category: str    # "Marketing" | "Operations" | "Technology" | "Growth"
    source_url: str       # URL artikel asal
    signal_type: str      # "direct" | "regulatory" | "competitive" | "technology"
```

### Label signal_type untuk UI

| signal_type | Tampilan di UI | Arti |
|---|---|---|
| `direct` | *(tanpa prefix)* | Berita langsung menyebut perusahaan target |
| `regulatory` | `[Regulasi]` | Perubahan regulasi yang berdampak ke industri target |
| `competitive` | `[Kompetitor]` | Gerakan kompetitor yang mengancam atau mengubah landscape |
| `technology` | `[Tech Shift]` | Perubahan teknologi yang relevan untuk vertikalnya |

---

## synthesize_profile() — Kontrak Input Baru

```python
async def synthesize_profile(
    lane_a_summary: str,           # Narrative overview untuk orientasi GPT-4o
    lane_a_evidence: list[dict],   # [{"fact": str, "url": str, "title": str}] — untuk citation
    scored_contacts: list[dict],
    company_url: str,
    mode: ReconMode,
    extracted_news: list[dict],          # Untuk di-inject ke profile.news (bypass AI)
    pain_signals_from_news: list[dict],  # NewsSignal objects — masuk ke synthesis prompt
) -> CompanyProfile
```

**Aturan synthesis pain points:**
1. Setiap `PainPoint.sourceUrl` WAJIB diambil dari `lane_a_evidence` atau `pain_signals_from_news`. Dilarang hallusinasi.
2. Jika tidak ada evidence URL yang cocok → `sourceUrl = ""` dan `severity = "low"` secara otomatis.
3. `pain_signals_from_news` masuk ke prompt sebagai block `=== PAIN SIGNALS DARI BERITA ===` — bukan dicampur dengan news array.
4. `news` field di-inject deterministik setelah synthesis selesai (`object.__setattr__`) — ini tetap dipertahankan (terbukti mencegah AI memodifikasi data berita).

---

## Pro Mode — Agentic Confidence Gap Architecture

**Mengapa Pro Mode lama gagal:** Pro Mode hanya mengubah prompt synthesis (minta lebih banyak pain points). Data riset yang masuk ke GPT-4o identik dengan Free Mode. Lebih banyak instruksi + data tipis = lebih banyak hallusinasi, bukan kedalaman.

**Arsitektur baru Pro Mode — 5 Fase:**

```
FASE 1: Broad Sweep (sama dengan Free Mode + expanded QueryAngle taxonomy)
        → Jalankan Lane A 7-step dengan search_depth="advanced"
        → Hasilkan DraftProfile + confidence_scores per field (0-100)

FASE 2: Confidence Evaluation (Pro only — GPT-4o)
        Input: DraftProfile
        Task: "Untuk setiap section, berikan confidence score dan ALASAN mengapa tidak yakin.
               List 3 query spesifik yang akan mengisi gap tertinggi."
        Output: ConfidenceReport[{section, score, gap_description, suggested_query}]

FASE 3: Recursive Gap-Filling (Pro only — maksimal 2 iterasi)
        → Untuk semua field dengan score < 70: jalankan suggested_query via Tavily Advanced
        → Hasil baru masuk ke GPT-4o: "Update HANYA field dengan confidence < 70.
           Jangan ubah field yang sudah confidence >= 70."
        → Batas: 2 putaran untuk kontrol biaya

FASE 4: Cross-Validation Challenge (Pro only — GPT-4o)
        Input: final painPoints array + lane_a_evidence list
        Task: "Untuk setiap pain point, tunjukkan kalimat PERSIS dari evidence yang membuktikannya.
               Jika tidak ada, set sourceUrl = '' dan severity = 'low'. Dilarang mengarang."
        → Ini mengeliminasi hallusinasi citation secara struktural

FASE 5: Deep Sub-page Scraping (Pro only — Tavily Extract)
        → Deteksi link sub-pages dari homepage: /blog, /case-study, /resources, /about, /team
        → Ambil 3-5 sub-pages via Tavily Extract
        → Konten sub-pages masuk ke synthesize_profile() sebagai section tambahan
        → Sub-pages sering punya: logo klien, detail proses bisnis, mention teknologi spesifik
```

### Perbedaan Output Free vs Pro (Updated)

| Field | Free Mode | Pro Mode |
|---|---|---|
| Research rounds | 3 (R1 General + R2 News + R3 Deep) | 3 + 2 recursive gap-filling rounds |
| Contact sources | Serper Tier 1 only | Serper Tier 1-3 + team page extraction |
| Pain point citations | Best-effort dari evidence | Cross-validated, hallusinasi di-eliminasi |
| Sub-page scraping | Tidak ada | /about, /team, /blog, /case-study |
| Confidence scoring | Tidak ada | Setiap field dinilai, field lemah di-re-research |
| deepInsights | 5 item (IDENTITAS/PRODUK/DIGITAL/POSISI PASAR/VULNERABILITIES) | 5 item + 2 item tambahan (KOMPETITOR SPESIFIK + TECH ASSESSMENT) |
| Pain points | 3-4 item | 4-5 item, semua harus ada citation URL |
| Contact reasoning | 4-sentence outreach brief | 4-sentence brief + recency signal + mandate analysis |
| News items | 3-4 artikel | 4-6 artikel dari lebih banyak sumber |
| Estimasi waktu | 8–15 detik | 35–60 detik |
| Estimasi biaya | ~$0.02–0.04 per recon | ~$0.10–0.20 per recon |

---

## TypeScript Interfaces (Updated)

```typescript
// types/recon.types.ts

export type ReconMode = 'free' | 'pro'

export interface CompanyProfile {
  id: string
  url: string
  name: string
  industry: string
  size: string
  founded: string
  hq: string
  description: string
  deepInsights: string[]    // Array 5-7 item dengan prefix label [IDENTITAS][PRODUK][DIGITAL]...
  reconMode?: ReconMode
  linkedin: {
    followers: string
    employees: number
    growth: string
  }
  contacts: PicContact[]
  painPoints: PainPoint[]
  news: NewsItem[]
  campaignProgress: CampaignProgress
  createdAt: string
  cachedAt: string
}

export interface PicContact {
  id: string
  name: string
  title: string
  email: string
  phone: string
  linkedinUrl?: string
  prospectScore: number        // 0-100; hanya tampil jika >= 55
  reasoning: string            // 4-sentence outreach brief (bukan 1 kalimat justifikasi)
  source?: 'linkedin_public' | 'serper' | 'web'
  // Rich fields
  location?: string
  connections?: string
  about?: string               // Snippet dari LinkedIn Google result
  roleDuration?: string
}

export interface PainPoint {
  category: 'Marketing' | 'Operations' | 'Technology' | 'Growth'
  issue: string                // Kalimat lengkap dengan konteks spesifik
  severity: 'high' | 'medium' | 'low'
  sourceUrl: string            // URL dari evidence — string kosong jika tidak ada bukti
  sourceTitle: string          // Judul artikel/halaman sumber
}

export interface NewsItem {
  title: string
  date: string                 // Format "DD Mon YYYY"
  source: string
  summary: string
  url: string
  signalType?: 'direct' | 'regulatory' | 'competitive' | 'technology'  // Untuk badge di UI
}

export interface CampaignProgress {
  recon: boolean
  match: boolean
  craft: boolean
  polish: boolean
  launch: boolean
  pulse: boolean
}
```

---

## Environment Variables

```bash
# .env.example — versi terbaru (v3)

NEXT_PUBLIC_USE_MOCK=true
NEXT_PUBLIC_APP_NAME=Campfire
NEXT_PUBLIC_DEFAULT_RECON_MODE=free

# Backend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Tavily (Search + Extract)
TAVILY_API_KEY=

# OpenAI (GPT-4o synthesis + GPT-4o-mini distillation)
OPENAI_API_KEY=

# Serper.dev (Contact dorking + News search)
SERPER_API_KEY=

# Jina Reader (Article content extraction)
JINA_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Email & Automation (In-House — n8n removed)
RESEND_API_KEY=
RESEND_FROM_EMAIL=Campfire <noreply@yourdomain.com>
RESEND_WEBHOOK_SECRET=
CRON_SECRET=

# DIHAPUS — hapus dari .env.local jika masih ada
# N8N_WEBHOOK_URL=
# N8N_API_KEY=

# DIHAPUS — hapus dari .env.local jika masih ada
# ANTHROPIC_API_KEY=
# APOLLO_API_KEY=
# APIFY_API_TOKEN=
# PROXYCURL_API_KEY=
# FIRECRAWL_API_KEY=
```

---

## Routes

| Route | Halaman |
|---|---|
| `/` | Redirect ke `/research-library` |
| `/research-library` | Home — semua profil tersimpan |
| `/recon` | Recon baru — input URL + mode selector |
| `/recon/[id]` | Lihat profil tersimpan by ID |
| `/match` | Match — dua tab (Matching + Katalog) |
| `/craft` | Craft — generate email campaign |
| `/polish` | Polish — editor & approval |
| `/launch` | Launch — automation scheduling |
| `/pulse` | Pulse — analytics dashboard |

---

## Tailwind Config

```typescript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      brand: {
        DEFAULT: '#0F6E56',
        light: '#E1F5EE',
        dark: '#085041',
      },
      severity: {
        high: '#D85A30',
        medium: '#BA7517',
        low: '#1D9E75',
      }
    },
    fontFamily: {
      sans: ['var(--font-geist-sans)'],
    }
  }
}
```
