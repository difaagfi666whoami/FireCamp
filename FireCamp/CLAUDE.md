# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Campfire** — B2B outreach automation tool ("Research. Match. Send.") built for digital marketers/sales teams. Currently Phase 1 (full UI with mock data) with Phase 2 (FastAPI + Supabase backend) in progress.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint check
npx tsc --noEmit     # Type check only
```

## Architecture

### Six milestones in order:
`Recon → Match → Craft → Polish → Launch → Pulse`

Each milestone has a dedicated route (`/recon`, `/match`, etc.), a hook in `hooks/`, an API module in `lib/api/`, and components in `components/`.

### Key patterns:

**Mock/live toggle** — every API function in `lib/api/` checks `NEXT_PUBLIC_USE_MOCK`:
```typescript
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
async function getCompanyProfile(url: string) {
  if (USE_MOCK) return mockData.company
  return await fetchRealAPI(url)
}
```

**Anti-Monolith** — keep files under ~200–250 lines. Pages hold routing/layout; hooks hold state/logic; components hold UI. If a page grows, extract to `components/` (UI) or `hooks/` (logic).

**Error handling pattern:**
```typescript
try {
  const data = await fetchProfile(url)
  return { data, error: null }
} catch (err) {
  console.error('[Recon] Profile fetch failed:', err)
  return { data: null, error: 'Gagal memuat profil perusahaan. Coba lagi.' }
}
```

**Loading states** — always step-by-step messages (max 6 steps, ~500ms delay each), never a spinner.

### Data flow:
`data/mockdata.json` → `lib/mock/mockdata.ts` (typed wrapper) → `lib/api/*.ts` → `hooks/use-*.ts` → page components

### State across pages:
Cross-page state uses `sessionStorage` via `lib/session.ts`. Known issue: mock mode can break session state (see `implementation_plan.md` for 6 documented bugs).

## UI Rules

- **All user-facing text in Bahasa Indonesia** (labels, placeholders, toasts, errors)
- **Code (variables, functions, comments) in English**
- Use `shadcn/ui` components — never build UI primitives from scratch
- Icons: Lucide React only; Charts: Recharts only
- Max 1 primary button per page; destructive actions require confirmation dialog
- Milestone names in UI: "Recon", "Match", "Craft", "Polish", "Launch", "Pulse" — never "M1", "M2", etc.

### Color tokens (Tailwind config):
| Token | Hex |
|-------|-----|
| `brand` | `#0F6E56` |
| `brand-light` | `#E1F5EE` |
| `success` | `#1D9E75` |
| `warning` | `#BA7517` |
| `danger` | `#D85A30` |

## Critical Rules

- Read `specs.md` before changing any feature behavior
- Read `architecture.md` before adding new components or changing structure
- Do **not** add libraries not listed in `architecture.md`
- Do **not** create: landing/marketing pages, user registration flow, or components outside `specs.md`
- Never hardcode API keys — always use `.env.local`
- The `/match` page has two tabs ("Matching" + "Katalog Produk") — do not split into separate routes
- After saving a Recon profile, navigate to `/research-library`, not just show a toast

## Pre-commit Checklist (from `gemini.md`)

- All UI text in Bahasa Indonesia
- No "M1"/"M2" in UI
- Loading state is step-by-step
- Error state is informative (not generic)
- Empty state exists (not blank)
- All buttons have working handlers
- `npx tsc --noEmit` passes
