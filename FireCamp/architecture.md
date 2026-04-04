# architecture.md — Tech Stack & Architecture

> Keputusan teknis proyek **Campfire**.
> Jangan install library atau buat folder baru di luar yang sudah didefinisikan di sini.

---

## Tech Stack

### Frontend
| Layer | Pilihan | Versi |
|---|---|---|
| Framework | Next.js | 14.x (App Router) |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| UI Components | shadcn/ui | latest |
| Icons | Lucide React | latest |
| Charts | Recharts | 2.x |
| Forms | React Hook Form | 7.x |
| Data Fetching | TanStack Query | 5.x |
| HTTP Client | Axios | 1.x |

### Backend (Phase 2 — belum dibangun)
| Layer | Pilihan |
|---|---|
| API | FastAPI (Python) |
| Database | Supabase (PostgreSQL + pgvector) |
| AI | Claude API (Anthropic) |
| Search | Tavily API |
| LinkedIn Data | Proxycurl API |
| Web Scraping | Firecrawl |
| Automation | n8n (self-hosted) |
| Email | Resend |
| PDF Gen | Puppeteer |
| File Storage | Supabase Storage |

---

## Folder Structure

```
campfire/
├── app/
│   ├── layout.tsx                      # Root layout — sidebar global
│   ├── page.tsx                        # Redirect ke /research-library
│   ├── research-library/
│   │   └── page.tsx                    # Halaman utama — semua profil tersimpan
│   ├── recon/
│   │   ├── page.tsx                    # Recon — profiling baru
│   │   ├── [id]/
│   │   │   └── page.tsx                # Lihat profil tersimpan by ID
│   │   └── components/
│   │       ├── ReconForm.tsx           # Input URL + tombol generate
│   │       ├── CompanyHeader.tsx       # Header card company
│   │       ├── KeyContacts.tsx         # PIC contacts (BARU)
│   │       ├── PainPointList.tsx       # List pain point cards
│   │       ├── NewsSection.tsx         # Recent news dengan citation links
│   │       └── LoadingSteps.tsx        # Reusable step-by-step loading
│   ├── match/
│   │   ├── page.tsx                    # Match — dua tab
│   │   └── components/
│   │       ├── MatchingTab.tsx         # Tab 1: AI matching
│   │       ├── ProductCatalogTab.tsx   # Tab 2: Catalog management (BARU)
│   │       ├── ProductMatchCard.tsx    # Kartu per produk hasil matching
│   │       ├── ProductListItem.tsx     # Baris produk di katalog
│   │       ├── ProductFormModal.tsx    # Modal tambah/edit produk (BARU)
│   │       └── PdfUploadZone.tsx       # Drag & drop PDF upload (BARU)
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
│   ├── ui/                             # shadcn/ui (auto-generated)
│   ├── layout/
│   │   ├── Sidebar.tsx                 # Navigasi global
│   │   ├── MilestoneProgress.tsx       # Recon ✓ → Match ✓ → ...
│   │   └── PageHeader.tsx              # Title + subtitle
│   └── shared/
│       ├── Badge.tsx
│       ├── LoadingSteps.tsx
│       ├── EmptyState.tsx
│       ├── ConfirmDialog.tsx           # Dialog konfirmasi untuk destructive actions
│       └── CitationLink.tsx            # Link citation dengan ikon ExternalLink (BARU)
│
├── hooks/
│   ├── use-recon.ts
│   ├── use-match.ts
│   ├── use-catalog.ts                  # State management product catalog (BARU)
│   ├── use-pdf-upload.ts               # File drag & drop logic (BARU)
│   ├── use-craft.ts
│   ├── use-polish.ts
│   ├── use-launch.ts
│   └── use-pulse.ts
│
├── lib/
│   ├── mock/
│   │   └── mockdata.ts                 # Type-safe wrappers dari mockdata.json
│   ├── api/
│   │   ├── recon.ts
│   │   ├── matching.ts
│   │   ├── catalog.ts                  # CRUD product catalog (BARU)
│   │   ├── pdf-extract.ts              # PDF extraction mock/real (BARU)
│   │   ├── craft.ts
│   │   └── analytics.ts
│   └── utils.ts
│
├── types/
│   ├── recon.types.ts
│   ├── match.types.ts                  # Includes ProductCatalogItem type
│   ├── craft.types.ts
│   └── analytics.types.ts
│
├── data/
│   └── mockdata.json
│
├── public/
│   └── logo.svg
│
├── .env.local
├── .env.example
├── gemini.md
├── specs.md
├── architecture.md
└── mockdata.md
```

---

## TypeScript Interfaces

```typescript
// types/recon.types.ts

export interface CompanyProfile {
  id: string
  url: string
  name: string
  industry: string
  size: string
  founded: string
  hq: string
  description: string
  linkedin: {
    followers: string
    employees: number
    growth: string
  }
  contacts: PicContact[]       // BARU
  painPoints: PainPoint[]
  news: NewsItem[]
  campaignProgress: CampaignProgress   // BARU — untuk Research Library
  createdAt: string
  cachedAt: string
}

export interface PicContact {  // BARU
  id: string
  name: string
  title: string
  email: string
  phone: string
  linkedinUrl?: string
  prospectScore: number        // 0-100
  reasoning: string            // 1 kalimat mengapa dia relevan
}

export interface PainPoint {
  category: 'Marketing' | 'Operations' | 'Technology' | 'Growth'
  issue: string
  severity: 'high' | 'medium' | 'low'
}

export interface NewsItem {
  title: string
  date: string
  source: string
  summary: string
  url: string                  // WAJIB ada — untuk citation link
}

export interface CampaignProgress {   // BARU — untuk progress indicator
  recon: boolean
  match: boolean
  craft: boolean
  polish: boolean
  launch: boolean
  pulse: boolean
}

// types/match.types.ts

export interface ProductCatalogItem {  // BARU — untuk catalog management
  id: string
  name: string
  tagline: string
  description: string
  price: string
  painCategories: Array<'Marketing' | 'Operations' | 'Technology' | 'Growth'>
  usp: string[]                // array of USP bullet points
  source: 'manual' | 'pdf'    // bagaimana produk ini diinput
  createdAt: string
  updatedAt: string
}

export interface ProductMatch extends ProductCatalogItem {
  matchScore: number
  addressedPainIndices: number[]
  reasoning: string
  isRecommended: boolean
}

export interface PdfExtractionResult {  // BARU
  extractedName: string
  extractedTagline: string
  extractedDescription: string
  extractedPrice: string
  extractedUsp: string[]
  confidence: number           // 0-100, seberapa confident AI
}
```

---

## Environment Variables

```bash
# .env.example

NEXT_PUBLIC_USE_MOCK=true
NEXT_PUBLIC_APP_NAME=Campfire

# Backend (Phase 2)
NEXT_PUBLIC_API_URL=http://localhost:8000
PROXYCURL_API_KEY=
TAVILY_API_KEY=
ANTHROPIC_API_KEY=
FIRECRAWL_API_KEY=
RESEND_API_KEY=

# Supabase (Phase 2)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# n8n (Phase 2)
N8N_WEBHOOK_URL=
N8N_API_KEY=
```

---

## Routes

| Route | Halaman |
|---|---|
| `/` | Redirect ke `/research-library` |
| `/research-library` | Home — semua profil tersimpan |
| `/recon` | Recon baru — input URL |
| `/recon/[id]` | Lihat profil Recon yang tersimpan |
| `/match` | Match — dua tab (Matching + Katalog) |
| `/craft` | Craft — generate email campaign |
| `/polish` | Polish — editor & approval |
| `/launch` | Launch — automation scheduling |
| `/pulse` | Pulse — analytics dashboard |

---

## PDF Upload — Implementation Notes

```typescript
// hooks/use-pdf-upload.ts

interface UsePdfUpload {
  file: File | null
  isDragging: boolean
  isExtracting: boolean
  extractionResult: PdfExtractionResult | null
  error: string | null
  handleDrop: (files: FileList) => void
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  startExtraction: () => Promise<void>
  reset: () => void
}

// Accepted file types
const ACCEPTED_TYPES = ['.pdf', '.docx', '.pptx']
const MAX_SIZE_MB = 10

// Validation
function validateFile(file: File): string | null {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!ACCEPTED_TYPES.includes(ext))
    return `Format tidak didukung. Gunakan: ${ACCEPTED_TYPES.join(', ')}`
  if (file.size > MAX_SIZE_MB * 1024 * 1024)
    return `Ukuran file melebihi ${MAX_SIZE_MB}MB`
  return null
}
```

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
