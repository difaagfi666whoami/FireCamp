# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Campfire** — B2B outreach automation tool ("Research. Match. Send.") built for digital marketers/sales teams. Live mode active (`NEXT_PUBLIC_USE_MOCK=false`). Backend: FastAPI + Supabase. Email dispatch via Resend SDK + Vercel Cron.

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

Each milestone has a dedicated route (`/recon`, `/match`, etc.), an API module in `lib/api/`, and components in `components/`. State/logic lives directly in page files; only `hooks/use-catalog.ts` remains as a standalone hook.

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
Live mode: `lib/api/*.ts` → page components (direct)
Mock mode: `data/mockdata.json` → `lib/mock/mockdata.ts` → `lib/api/*.ts` → page components

### State across pages:
Cross-page state uses `sessionStorage` via `lib/session.ts`. Call `session.clearActiveTarget()` to nuke all `campfire_*` keys when starting a new target.

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
- Do **not** add libraries not listed in `architecture.md` without discussing first
- Components / pages outside `specs.md` should be discussed before adding (Phase 2 commercialization work — billing, pricing, public landing — is now in scope)
- Never hardcode API keys — always use `.env.local`
- The `/match` page has two tabs ("Matching" + "Katalog Produk") — do not split into separate routes
- After Recon generates a profile, auto-redirect to `/recon/[id]` (Review Profil), not `/research-library`
- "Recon Baru" and "Ganti Target" must call `session.clearActiveTarget()` before navigating to `/recon`

## Multi-Tenancy (Phase 1 — DONE)

Every data table (`companies`, `contacts`, `pain_points`, `news`, `intent_signals`, `products`, `campaigns`, `campaign_emails`, `matching_results`, `campaign_analytics`, `email_analytics`, `user_profiles`) has a `user_id UUID` column with FK to `auth.users(id)` and a production RLS policy `user_owns_row` (`auth.uid() = user_id`). Migration: `supabase/migrations/018_multi_tenancy.sql`.

Rules when writing code:
- **Frontend INSERTs must include `user_id`.** Use `getCurrentUserId()` from `lib/supabase/client.ts` — it throws if the caller isn't authenticated. SELECTs and UPDATEs need no change because RLS auto-filters via the anon key.
- **Backend Supabase writes must include `user_id`** (backend uses the service role key which bypasses RLS, so writes will succeed *without* `user_id` and silently leak data). Frontend passes `user_id` in the request body for every backend POST.
- **Auto-analytics triggers** (`fn_auto_create_campaign_analytics`, `fn_auto_create_email_analytics`) propagate `user_id` from parent → child automatically. Don't bypass them.
- **Dev bypass:** set `NEXT_PUBLIC_AUTH_DEV_BYPASS=true` in `.env.local` if you need to run pages without logging in. Default is OFF — middleware will redirect unauthenticated users to `/login`.

## Phase 2 — Billing (DONE — Stripe Pay-As-You-Go Credits)

**Implementation:** [supabase/migrations/019_billing.sql](supabase/migrations/019_billing.sql), [backend/app/api/routers/billing.py](backend/app/api/routers/billing.py), [backend/app/services/credits_service.py](backend/app/services/credits_service.py), [backend/app/core/billing.py](backend/app/core/billing.py), [lib/api/credits.ts](lib/api/credits.ts), [app/(shell)/pricing/page.tsx](app/(shell)/pricing/page.tsx), [app/(shell)/billing/success/page.tsx](app/(shell)/billing/success/page.tsx).

**Tables:**
- `user_credits` (user_id PK, balance ≥ 0) — RLS read-only for owner
- `credit_transactions` — append-only ledger (`purchase`, `debit`, `refund`, `grant`)
- SQL functions `debit_credits(uid, amount, description)` and `credit_credits(uid, amount, type, description, stripe_session_id)` are SECURITY DEFINER and atomic. `credit_credits` is idempotent on `stripe_session_id` for safe webhook replay.

**Cost per operation (defined in [backend/app/core/billing.py](backend/app/core/billing.py)):**
- Recon Free = 1 credit, Recon Pro = 5, Match = 1, Craft = 2, Polish rewrite = 1.
- Routers debit BEFORE running AI work and return HTTP 402 with a top-up CTA when insufficient.

**Credit packs (in [backend/app/core/billing.py](backend/app/core/billing.py); tweak the constant to change pricing):**
- Starter: 50 credits / Rp 100,000
- Growth: 200 credits / Rp 350,000 (recommended)
- Scale: 500 credits / Rp 750,000

**API surface:**
- `GET  /api/billing/packages` — public, list packs (used by `/pricing` UI)
- `GET  /api/billing/balance` — auth, current user balance
- `POST /api/billing/checkout` — auth, create Stripe Checkout Session, returns redirect URL
- `POST /api/webhooks/stripe` — Stripe-only (signature-verified), handles `checkout.session.completed`

**Frontend:**
- `/pricing` — pack grid + cost-per-op breakdown + current balance.
- `/billing/success` — post-checkout landing, polls balance for ~9s while webhook fires.
- Sidebar: live credit widget at the top of the bottom section; doubles as "Beli Credits" link to `/pricing`.

**Stripe setup checklist (one-time, before going live):**
1. Sign up at https://stripe.com → Dashboard → Developers → API keys → copy **test mode** Secret key into `.env.local` as `STRIPE_SECRET_KEY`.
2. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` (or production URL) in `.env.local` so checkout success/cancel redirects work.
3. For local webhook testing: install Stripe CLI → `stripe listen --forward-to localhost:8000/api/webhooks/stripe`. The CLI prints a `whsec_…` signing secret — set it as `STRIPE_WEBHOOK_SECRET` in `.env.local`.
4. Run a test purchase with card `4242 4242 4242 4242` (any future expiry / any CVC).
5. When ready for production: flip Stripe to live mode, regenerate keys, update `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, set production webhook endpoint URL in Stripe Dashboard → Developers → Webhooks.

**Required env vars:**
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Seed data:** Migration 019 grants the seed user `difaagfi1998@gmail.com` 100 free credits on first run for testing.

## Pre-commit Checklist (from `gemini.md`)

- All UI text in Bahasa Indonesia
- No "M1"/"M2" in UI
- Loading state is step-by-step
- Error state is informative (not generic)
- Empty state exists (not blank)
- All buttons have working handlers
- `npx tsc --noEmit` passes
