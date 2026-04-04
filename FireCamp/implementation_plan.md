# Campfire — Mock Pipeline Fix Plan

## Background

Backend (FastAPI) is not ready. Goal: make the **full mock pipeline** (`USE_MOCK=true`) work
perfectly end-to-end from `/research-library` → Recon → Match → Craft → Polish → Launch → Pulse,
with real-looking data and correct state-passing logic.

---

## Bugs & Gaps Found (Full Audit)

### BUG 1 — Mock mode skips session state, breaks Craft
**File:** [app/craft/page.tsx](file:///d:/AntiGravity/CampFire/app/craft/page.tsx) line 43–48  
**Problem:** On first visit, `SESSION_KEY = "campfire_craft_done"` is not set → `isCrafting=true` is
triggered. In mock IS_LIVE=false branch, `session.getReconProfile()` and
`session.getSelectedProductId()` are never written by Recon/Match in mock mode —
so Craft page shows mock data correctly BUT the [saveCraftedEmails()](file:///d:/AntiGravity/CampFire/lib/api/craft.ts#39-85) call skips because
`session.getCampaignId()` returns `null` (mock match returns `"mock-campaign-id"` but doesn't
store it in session). This causes silent failure — no error shown, but the downstream Polish page
also doesn't know what product was picked.

### BUG 2 — Mock MatchingTab doesn't persist `selectedId` properly across navigation
**File:** [app/match/components/MatchingTab.tsx](file:///d:/AntiGravity/CampFire/app/match/components/MatchingTab.tsx) line 53–57  
**Problem:** [handleSelectProduct](file:///d:/AntiGravity/CampFire/app/match/components/MatchingTab.tsx#53-58) writes to both `sessionStorage` and `session`, but if user
navigates Match → Craft → back → Match, the `SESSION_KEY ("campfire_match_done")` is already "1"
so `hasMatched=true` and the old `selectedId` from storage is restored. BUT if user clears browser
or opens a fresh tab, the whole flow restarts without any pre-populated company profile context. The
"Mulai Pencocokan" button doesn't show what company profile is being matched. No company name
visible.

### BUG 3 — Polish loads mock emails (hardcoded) even in USE_MOCK=true if Craft was already visited
**File:** [app/polish/page.tsx](file:///d:/AntiGravity/CampFire/app/polish/page.tsx) line 34–36  
**Problem:** Polish initialises state from `mockData.campaign.emails` (JSON.parse deep copy).
Then in `useEffect`, it tries to restore from `sessionStorage POLISH_KEY` or
`session.getCraftCampaign()`. If no Craft campaign was saved to session (e.g. fresh visit
without going through Craft), Polish falls back to raw mock emails which have `isApproved: false` —
that's fine. But the `email.id` values in mock JSON are integers (1, 2, 3) while some code
paths use them as strings and as tab values. The `TabsTrigger value={email.id.toString()}` and
`activeTab` need to match exactly — currently they do, but if the Craft session emails have a
different `id` structure (e.g. from Supabase which uses UUIDs), Polish tabs break entirely.

### BUG 4 — `NEXT_PUBLIC_USE_MOCK=false` in [.env.local](file:///d:/AntiGravity/CampFire/.env.local) (current state)
**File:** [.env.local](file:///d:/AntiGravity/CampFire/.env.local) line 1  
**Problem:** [.env.local](file:///d:/AntiGravity/CampFire/.env.local) currently has `NEXT_PUBLIC_USE_MOCK=false`. This means all API calls
go to `http://localhost:8000` (FastAPI) which is NOT running. Every page that hits an API
**silently fails or crashes** — Recon generate, Match run, Craft generate all break. The
immediate task is to set this back to `true` before any mock testing.

### BUG 5 — `matchingResults` in mock uses `productId` not `id`, but [MatchingTab](file:///d:/AntiGravity/CampFire/app/match/components/MatchingTab.tsx#35-322) maps `id`
**File:** [data/mockdata.json](file:///d:/AntiGravity/CampFire/data/mockdata.json) matchingResults + [app/match/components/MatchingTab.tsx](file:///d:/AntiGravity/CampFire/app/match/components/MatchingTab.tsx) line 75–85  
**Problem:** The mock `matchingResults` array has `productId: "prod-001"` but the spread in
[MatchingTab](file:///d:/AntiGravity/CampFire/app/match/components/MatchingTab.tsx#35-322) does `...match, id: match.productId`. This works for display. BUT `mockData.matchingResults`
is typed as `ProductMatch[]` whose interface has `id: string` — but the raw JSON doesn't have `id`.
TypeScript cast (`as unknown as ProductMatch[]`) hides this. The `selectedId` comparison
`matches.find(m => m.id === selectedId)` works because `id` is set via spread. However, when
[saveCampaignAndMatching](file:///d:/AntiGravity/CampFire/lib/api/match.ts#52-103) receives `selectedId = "prod-001"`, the UUID regex check fails (it's not
a UUID), so `selected_product_id` is saved as `null` in Supabase — which won't matter in mock
mode but causes data loss in live mode.

### BUG 6 — Missing `lib/api/pdf-extract.ts`
**File:** referenced in [architecture.md](file:///d:/AntiGravity/CampFire/architecture.md), missing from `lib/api/`  
**Problem:** `PdfUploadZone.tsx` likely has its own inline extraction logic OR imports from a
missing file. The architecture demands this file exists. Without it, PDF upload mock flow is
fragile and not easily switchable to real later.

### DATA QUALITY ISSUE — Mock data is thin and not cohesive
- Research Library shows 2 profiles, but only `company.id = "profile-001"` has full data
- `researchLibrary[1]` (CV Maju Bersama Logistik) has no matching `company` object — clicking
  "Lihat Profil" on it from Research Library would navigate to `/recon/profile-002` and find nothing
- `analytics.emailsSent = 3` but only 1 email has `status: "sent"` in `schedule` — inconsistent
- `schedule.date` values are in March 2026 but today is March 27 2026 — Email 2 (March 28) and
  Email 3 (April 3) look realistic; Email 1 is already "sent" — good
- `campaign.emails[*].id` are integers (1, 2, 3) — fine for now but must stay consistent

---

## Fix Plan — Ordered by Priority

### Step 1 — Fix `.env.local` (5 min)
Set `NEXT_PUBLIC_USE_MOCK=true` immediately so the dev server uses mock data.

### Step 2 — Fix BUG 4 + BUG 1: Session state in mock mode (MatchingTab → CraftPage)
In mock mode, when user clicks "Lanjutkan ke Craft" in MatchingTab:
- `saveCampaignAndMatching` already returns `"mock-campaign-id"` — but this is NOT stored in session
- Fix: store `"mock-campaign-id"` in `session.setCampaignId()` in the mock branch same as live mode

In `CraftPage` mock branch: after animation done, call `session.setCraftCampaign(mockData.campaign)`
so Polish can read it from session.

### Step 3 — Enrich Mock Data (mockdata.json)
- Add a second full company profile for "CV Maju Bersama Logistik" (profile-002) OR change
  Research Library profile-002's `id` to match the existing `company.id = "profile-001"` so
  clicking it routes to correct data
- Make `analytics.emailsSent` consistent with schedule (should be 1, not 3 — or mark all 3 as sent)
- Add `createdAt` / `cachedAt` fields where missing
- Add a 3rd Research Library entry with full campaign progress for demo richness

### Step 4 — Create `lib/api/pdf-extract.ts`
Proper file with mock extraction function that returns `pdfExtractionMock` data with step-by-step
loading simulation. Matches the pattern of other api files.

### Step 5 — Add company name to Matching tab header
Show "Mencocokkan produk untuk: **PT Kreasi Digital Indonesia**" so user knows which profile is active.

### Step 6 — Verify full pipeline manually (walk-through)
Run through: Research Library → Recon (generate) → Save → Match (run + select) → Craft → Polish
(approve all) → Launch (activate) → Pulse

---

## Claude Code Agent Prompts

Below are copy-paste ready prompts for Claude Code to execute each fix.

---

### PROMPT 1 — Fix env and session flow in mock mode

```
You are working on a Next.js 14 app called Campfire at d:\AntiGravity\CampFire.
The project uses TypeScript, Tailwind CSS, shadcn/ui, and mock data from data/mockdata.json.
Read lib/session.ts, lib/api/match.ts, app/match/components/MatchingTab.tsx, and app/craft/page.tsx
before making any changes.

Make these exact changes:

1. In `.env.local`, change line 1 to: NEXT_PUBLIC_USE_MOCK=true

2. In `app/match/components/MatchingTab.tsx`, inside `handleProceedToCraft()`:
   After `const campaignId = await saveCampaignAndMatching(...)`, there is already
   `session.setCampaignId(campaignId)`. This is INSIDE the `if (companyId)` block.
   The bug is: in MOCK mode, `companyId = session.getCompanyId()` is NULL (because mock Recon
   never sets it). So the campaign ID is never stored.
   Fix: BEFORE the `if (companyId)` block, always call:
     session.setCampaignId("mock-campaign-id")
   But ONLY when IS_LIVE is false. Actually: restructure so that in mock mode we set the
   campaign ID regardless. Specifically: move `session.setCampaignId(campaignId)` to OUTSIDE
   the `if (companyId)` block, so it always runs after `saveCampaignAndMatching` succeeds.

3. In `app/craft/page.tsx`, in the mock branch (inside `if (!IS_LIVE)` block), after setting
   `sessionStorage.setItem(SESSION_KEY, "1")` and before the `saveCraftedEmails` call,
   add: `session.setCraftCampaign(mockData.campaign)`
   This ensures Polish can read the campaign from session even in mock mode.

4. Also in `app/craft/page.tsx`, in the mock branch, ensure that `session.setCampaignId` is
   called with `"mock-campaign-id"` if there is no campaignId in session. Add before the
   saveCraftedEmails call:
   ```
   if (!session.getCampaignId()) session.setCampaignId("mock-campaign-id")
   ```

Run `npx tsc --noEmit` after changes to verify no TypeScript errors.
Do NOT change any other files. Do NOT install any new packages.
```

---

### PROMPT 2 — Enrich mockdata.json for realistic demo

```
You are working on a Next.js 14 app called Campfire at d:\AntiGravity\CampFire.
Read data/mockdata.json in full before making any changes.

Make these changes to data/mockdata.json:

1. In "researchLibrary" array, add a THIRD entry:
{
  "id": "profile-003",
  "name": "PT Solusi Logistik Nusantara",
  "industry": "Logistics & Supply Chain",
  "hq": "Surabaya",
  "savedAt": "2026-03-10T14:00:00.000Z",
  "painPointsCount": 5,
  "progress": {
    "recon": true,
    "match": true,
    "craft": true,
    "polish": true,
    "launch": true,
    "pulse": true
  }
}
This entry shows a fully completed campaign for demo purposes.

2. Change "researchLibrary[1]" (CV Maju Bersama Logistik) to:
- id: "profile-002" (keep as is)
- progress: keep as is (only recon: true, rest false)
- This is fine — it represents a company that was researched but not yet matched.

3. In "analytics.summary", change "emailsSent" from 3 to 1. The schedule shows only Email 1
   was actually sent (status: "sent"). Emails 2 and 3 are "scheduled". The analytics should
   reflect what was sent, not planned:
   - emailsSent: 1
   - openRate: 100.0 (1 out of 1 opened)
   - clickRate: 100.0 (1 out of 1 clicked)
   - replyRate: 100.0 (1 out of 1 replied)
   Keep industryBenchmarks as is.

   Also update perEmail to be consistent:
   - Email 1: opens: 1, clicks: 1, replies: 1, status: "replied" ✓ (keep)
   - Email 2: opens: 0, clicks: 0, replies: 0, status: "scheduled" (change status from "opened")
   - Email 3: opens: 0, clicks: 0, replies: 0, status: "scheduled" (change status from "sent")

4. In "analytics.timeline", it should only have data up to H4 showing real activity since
   only 1 email was sent and 1 followup is scheduled for H4. Keep H1 data, zero out H4:
   - H1: opens: 1, clicks: 1 (keep)
   - H2-H4: all zeros (keep as is)
   - Remove H10 entry entirely since Email 3 hasn't been sent yet.

5. In "schedule", update the dates to be future-looking from today (2026-03-27):
   - Email 1: date: "2026-03-27", time: "09:00", status: "sent", sentAt: "2026-03-27T02:00:00.000Z"
   - Email 2: date: "2026-03-30", time: "10:00", status: "scheduled", sentAt: null
   - Email 3: date: "2026-04-05", time: "09:30", status: "scheduled", sentAt: null
   Also update scheduledDay in "campaign.emails": Email 1→day 1, Email 2→day 4 (keep), Email 3→day 10 (keep)

6. Add "cachedAt" field to "company" if not already present: "cachedAt": "2026-03-27T06:00:00.000Z"
   Update "createdAt": "2026-03-27T06:00:00.000Z" and "cachedAt" to today's date.

After changes, run `npx tsc --noEmit` to verify no TypeScript errors from the JSON changes.
```

---

### PROMPT 3 — Create lib/api/pdf-extract.ts

```
You are working on a Next.js 14 app called Campfire at d:\AntiGravity\CampFire.
Read architecture.md, data/mockdata.json, types/match.types.ts, and lib/mock/mockdata.ts
before making any changes.

Create a NEW file: `lib/api/pdf-extract.ts`

The file must:
1. Import PdfExtractionResult from "@/types/match.types"
2. Import mockData from "@/lib/mock/mockdata"
3. Have the USE_MOCK toggle pattern (same as lib/api/catalog.ts pattern — read that file first)
4. Export one async function: `extractFromPdf(file: File): Promise<PdfExtractionResult>`
   - In mock mode: simulate a 2-second delay, then return mockData.pdfExtractionMock
   - In live mode: POST the file to `${API_URL}/api/pdf-extract` as FormData, return response JSON
5. Export one async function: `extractFromPdfSteps(onStep: (step: string) => void): Promise<PdfExtractionResult>`
   - This is the step-by-step version for the loading animation in PdfUploadZone
   - In mock mode: call onStep with each of these messages with 600ms delay between:
     "Membaca dokumen...", "Mengidentifikasi informasi produk...", 
     "Mengekstrak nama, harga, dan fitur...", "Menyiapkan form review..."
     Then return mockData.pdfExtractionMock
   - In live mode: same as extractFromPdf but also call onStep("Mengunggah dokumen...") first

Check if app/match/components/PdfUploadZone.tsx exists and read it. If it imports from a 
non-existent path or has inline extraction logic, note what changes it needs but DO NOT 
change PdfUploadZone.tsx in this prompt — only create the new file.

Run `npx tsc --noEmit` after creating the file.
```

---

### PROMPT 4 — Fix Recon mock flow: save company profile to session

```
You are working on a Next.js 14 app called Campfire at d:\AntiGravity\CampFire.
Read app/recon/page.tsx and lib/session.ts in full before making any changes.

Find the section in app/recon/page.tsx where the "Generate Profil" button triggers loading
and the mock profile is generated. 

In mock mode (IS_LIVE=false), after generating the mock profile and before showing the result:
- Call `session.setReconProfile(mockData.company)` to store the profile in session
- Call `session.setCompanyId(mockData.company.id)` to store the company ID

This ensures that:
- Match tab can call `session.getReconProfile()` and get a real company object
- Match tab can call `session.getCompanyId()` and get "profile-001"
- The "company name" display in MatchingTab will show the correct company

Look for the exact place in the code where `isCrafting` or equivalent state is set to false
after mock loading completes in Recon. Add the session calls right before or at that moment.

Also: in app/recon/page.tsx, check if there's a "Simpan ke Database" button. In mock mode,
this button should:
- Call `session.setCompanyId(mockData.company.id)` 
- Show a toast "Profil disimpan ke Research Library"
- Navigate to /research-library
If the button already does this, verify and confirm. If not, add it.

Run `npx tsc --noEmit` after changes.
```

---

### PROMPT 5 — Add company context to MatchingTab UI

```
You are working on a Next.js 14 app called Campfire at d:\AntiGravity\CampFire.
Read app/match/components/MatchingTab.tsx and lib/session.ts before making changes.

In the "Render: belum mulai" section (the card with "Jalankan AI Matching" button):
1. Read the company name from session: `session.getReconProfile()?.name ?? mockData.company.name`
2. Add a line below the title showing: 
   "Target: **[company name]**" — styled as `text-[13px] text-muted-foreground font-medium`
   with the company name in `font-bold text-foreground`

In the "Render: hasil matching" section header:
1. Add subtitle below "Hasil Pencocokan":
   styled as `text-[13px] text-muted-foreground mt-1`
   showing: "Analisis untuk **[company name]**"

These changes make it clear WHICH company is being matched at all times.

Do NOT change any matching logic. Only add UI elements.
Run `npx tsc --noEmit` after changes.
```

---

### PROMPT 6 — Full pipeline walkthrough test (manual verification)

```
After all previous prompts are applied, do the following manual verification:

1. In .env.local, confirm NEXT_PUBLIC_USE_MOCK=true
2. Restart the dev server: the server is already running at http://localhost:3001
3. Open http://localhost:3001 in browser
4. Verify redirect to /research-library — should show 2–3 profile cards
5. Click "+ Recon Baru" → go to /recon
6. Enter any URL (e.g. "kreasidigital.co.id") and click "Generate Profil"
7. Watch step-by-step loading animation (6 steps, ~3 seconds)
8. Verify profile appears: Company header, contacts (2-3 PIC cards), pain points, news with links
9. Click "Simpan ke Database" → verify toast, verify redirect to /research-library with new card
10. Click "Lanjutkan Campaign" or navigate to /match
11. Tab "Matching" → verify company name shown → click "Mulai Pencocokan"
12. Watch 4-step loading animation
13. Verify 3 product cards appear with match scores and reasoning
14. Select one product (click card) → verify selection indicator turns brand color
15. Click "Lanjutkan ke Craft" → verify navigation to /craft
16. Watch 6-step Craft loading animation
17. Verify 3 email cards appear with subject + body previews
18. Click "Lanjutkan ke Editor (Polish)"
19. In Polish: verify 3 tabs (Email 1, 2, 3)
20. Change tone on Email 1 → verify subject and body regenerate
21. Click "Approve Email 1" → verify dot turns green on tab
22. Approve all 3 emails → verify "Lanjut ke Launch" button appears
23. Navigate to /launch → select AI mode → click "Aktifkan Automation"
24. Verify schedule items show with animated pulsing dot
25. Navigate to /pulse → verify stat cards, bar chart, line chart, token usage all render

Report any step that fails with the exact error message from browser console.
```
