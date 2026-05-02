# Campfire — Financial Cost Analysis
**Generated:** 2026-05-02 | **Status:** Estimated (pending manual verification)

---

## Executive Summary

Campfire's credit pricing is **healthy on paper but critically fragile in practice**: Match, Craft, and Polish all generate 90%+ margins at every pack tier, but Recon (the most-used entry point) is entirely dependent on free-tier API quotas remaining unexhausted. Serper's free tier (100 searches/month) is the single most dangerous dependency — it covers only ~6 Recon Free runs before flipping to $0.02/search, which instantly turns Recon Free from a thin +48% margin into a -350% loss per run. The business is currently viable only because early-stage usage fits within free tiers; a single moderately active user will exhaust Serper within the first week of usage. **Recommended immediate action:** raise Recon Free to 2 credits and plan Serper upgrade before acquiring the first paying user.

---

## Step 1 — External API Catalog

| API | Service | Location | Current Tier | Pricing Model |
|-----|---------|----------|--------------|---------------|
| OpenAI GPT-4o | LLM (primary) | `backend/app/services/openai_service.py` | Pay-per-token | Input $2.50/1M, Output $10.00/1M tokens |
| OpenAI GPT-4o-mini | LLM (enrichment) | `backend/app/services/openai_service.py` | Pay-per-token | Input $0.15/1M, Output $0.60/1M tokens |
| Serper.dev | Google Search | `backend/app/services/external_apis.py` | **Free (100 searches/mo)** | $50/2,500 = $0.02/search |
| Tavily | Web Research | `backend/app/services/tavily_service.py`, `tavily_research_service.py` | **Free (1,000 searches/mo)** | ~$0.01/search (paid plan) |
| Jina Reader | URL Scraping | `backend/app/services/external_apis.py` | **Free (with API key)** | ~$0.02/10K tokens (paid) |
| Hunter.io | Email Enrichment | `backend/app/services/external_apis.py` | **Free (25 verifications/mo)** | ~$49/1,000 = $0.049/call |
| Stripe | Payment processing | `backend/app/api/routers/billing.py` | 2.9% + Rp 0 fixed | Per transaction fee |
| Resend | Email dispatch | (Launch/Pulse stage) | Free tier exists | ~$20/mo for 50K emails |

> **Note:** USD/IDR exchange rate used throughout: **1 USD = Rp 16,000** (May 2025 reference).

---

## Step 2 — Token Usage & API Call Estimates Per Pipeline Stage

Token estimation method: character count from source prompt strings ÷ 3.5 chars/token (mixed Bahasa Indonesia/English content). All values marked as estimates pending dashboard verification.

### GPT Models Used Per Stage

| Stage | Function | Model | Max Tokens Out |
|-------|----------|-------|---------------|
| Recon: Gap Analysis | `lane_a` Step 1 | GPT-4o-mini | 800 |
| Recon: Query Gen | `lane_a` Step 2 | GPT-4o-mini | 600 |
| Recon: Distillation ×6 | `lane_a` Step 4 | GPT-4o-mini | 1,000 ×6 |
| Recon: Contact Scoring | `score_contacts()` | GPT-4o-mini | 1,024 |
| Recon: News Signals ×3 | `lane_c` extraction | GPT-4o-mini | 300 ×3 |
| Recon: Tavily Extraction | `extract_from_tavily_report()` | GPT-4o-mini | 2,000 (Pro only) |
| Recon: Final Synthesis | `synthesize_profile()` | **GPT-4o** | **8,000** |
| Match | `run_matching()` | **GPT-4o** | 2,048 |
| Craft: Email Generation | `generate_campaign()` | **GPT-4o** | 3,000 |
| Polish: Tone Rewrite | `rewrite_email_tone_async()` | **GPT-4o** | 2,000 |

### Estimated Token Counts & External API Calls Per Stage

| Stage | Credits | GPT-4o-mini In | GPT-4o-mini Out | GPT-4o In | GPT-4o Out | Serper | Tavily | Jina URLs | Hunter |
|-------|---------|----------------|-----------------|-----------|------------|--------|--------|-----------|--------|
| Recon Free | 1 | ~9,300 | ~4,950 | ~12,267 | ~3,000 | ~15 | ~5 | ~3 | ~3 |
| Recon Pro | 5 | ~11,300 | ~5,450 | ~15,000 | ~4,000 | ~20 | ~6 + 1 Research | ~5 | ~4 |
| Match | 1 | 0 | 0 | ~950 | ~800 | 0 | 0 | 0 | 0 |
| Craft | 2 | 0 | 0 | ~1,600 | ~2,000 | 0 | 0 | 0 | 0 |
| Polish (rewrite) | 1 | 0 | 0 | ~300 | ~600 | 0 | 0 | 0 | 0 |

**Token estimate breakdown for `synthesize_profile` (GPT-4o):**
The system prompt alone is ~6,200 words ≈ 8,800 tokens. Adding aggregated lane data context, total input is estimated at 12,000–15,000 tokens. This single function dominates OpenAI costs.

---

## Step 3 — Cost Per Pipeline Stage

### Pricing rates applied
| Service | Rate |
|---------|------|
| GPT-4o input | $2.50 / 1M tokens |
| GPT-4o output | $10.00 / 1M tokens |
| GPT-4o-mini input | $0.15 / 1M tokens |
| GPT-4o-mini output | $0.60 / 1M tokens |
| Serper (paid) | $0.02 / search |
| Tavily (paid) | $0.01 / search |
| Jina (paid) | $0.02 / 10K tokens (~3 URLs × 8K chars ≈ negligible) |
| Hunter (prorated $49/1,000) | $0.049 / call |

### Cost Breakdown — Free Tier APIs (early stage, <~6–8 Recon runs/month)

| Stage | GPT-4o-mini Cost | GPT-4o Cost | Serper Cost | Tavily Cost | Hunter Cost | **Total (USD)** | **Total (IDR)** |
|-------|-----------------|------------|-------------|-------------|-------------|----------------|----------------|
| Recon Free | $0.004 | $0.061 | **$0.000** | **$0.000** | **$0.000** | **$0.065** | **Rp 1,040** |
| Recon Pro | $0.005 | $0.078 | **$0.000** | **$0.000** | **$0.000** | **$0.083** | **Rp 1,328** |
| Match | $0.000 | $0.010 | $0.000 | $0.000 | $0.000 | **$0.010** | **Rp 166** |
| Craft | $0.000 | $0.024 | $0.000 | $0.000 | $0.000 | **$0.024** | **Rp 384** |
| Polish | $0.000 | $0.007 | $0.000 | $0.000 | $0.000 | **$0.007** | **Rp 108** |

### Cost Breakdown — Paid APIs (scale stage, free tiers exhausted)

| Stage | GPT-4o-mini Cost | GPT-4o Cost | Serper Cost | Tavily Cost | Hunter Cost | **Total (USD)** | **Total (IDR)** |
|-------|-----------------|------------|-------------|-------------|-------------|----------------|----------------|
| Recon Free | $0.004 | $0.061 | **$0.300** | **$0.050** | **$0.147** | **$0.563** | **Rp 9,005** |
| Recon Pro | $0.005 | $0.078 | **$0.400** | **$0.070** | **$0.196** | **$0.689** | **Rp 11,018** |
| Match | $0.000 | $0.010 | $0.000 | $0.000 | $0.000 | **$0.010** | **Rp 166** |
| Craft | $0.000 | $0.024 | $0.000 | $0.000 | $0.000 | **$0.024** | **Rp 384** |
| Polish | $0.000 | $0.007 | $0.000 | $0.000 | $0.000 | **$0.007** | **Rp 108** |

---

## Step 4 — Margin Analysis: Three Pricing Scenarios

### Scenario A — Starter Pack (Rp 2,000 / credit) ← Current

| Stage | Credits | Revenue | Cost (Free Tier) | Margin | Status | Cost (Paid) | Margin | Status |
|-------|---------|---------|-----------------|--------|--------|-------------|--------|--------|
| Recon Free | 1 | Rp 2,000 | Rp 1,040 | **+Rp 960 (+48%)** | 🟡 Thin | Rp 9,005 | **-Rp 7,005 (-350%)** | 🔴 Critical |
| Recon Pro | 5 | Rp 10,000 | Rp 1,328 | **+Rp 8,672 (+87%)** | 🟢 Healthy | Rp 11,018 | **-Rp 1,018 (-10%)** | 🔴 Negative |
| Match | 1 | Rp 2,000 | Rp 166 | **+Rp 1,834 (+92%)** | 🟢 Healthy | Rp 166 | **+Rp 1,834 (+92%)** | 🟢 Healthy |
| Craft | 2 | Rp 4,000 | Rp 384 | **+Rp 3,616 (+90%)** | 🟢 Healthy | Rp 384 | **+Rp 3,616 (+90%)** | 🟢 Healthy |
| Polish | 1 | Rp 2,000 | Rp 108 | **+Rp 1,892 (+95%)** | 🟢 Healthy | Rp 108 | **+Rp 1,892 (+95%)** | 🟢 Healthy |

### Scenario B — Growth Pack (Rp 1,750 / credit)

| Stage | Credits | Revenue | Cost (Free Tier) | Margin | Status | Cost (Paid) | Margin | Status |
|-------|---------|---------|-----------------|--------|--------|-------------|--------|--------|
| Recon Free | 1 | Rp 1,750 | Rp 1,040 | **+Rp 710 (+41%)** | 🟡 Thin | Rp 9,005 | **-Rp 7,255 (-415%)** | 🔴 Critical |
| Recon Pro | 5 | Rp 8,750 | Rp 1,328 | **+Rp 7,422 (+85%)** | 🟢 Healthy | Rp 11,018 | **-Rp 2,268 (-26%)** | 🔴 Negative |
| Match | 1 | Rp 1,750 | Rp 166 | **+Rp 1,584 (+91%)** | 🟢 Healthy | Rp 166 | **+Rp 1,584 (+91%)** | 🟢 Healthy |
| Craft | 2 | Rp 3,500 | Rp 384 | **+Rp 3,116 (+89%)** | 🟢 Healthy | Rp 384 | **+Rp 3,116 (+89%)** | 🟢 Healthy |
| Polish | 1 | Rp 1,750 | Rp 108 | **+Rp 1,642 (+94%)** | 🟢 Healthy | Rp 108 | **+Rp 1,642 (+94%)** | 🟢 Healthy |

### Scenario C — Scale Pack (Rp 1,500 / credit)

| Stage | Credits | Revenue | Cost (Free Tier) | Margin | Status | Cost (Paid) | Margin | Status |
|-------|---------|---------|-----------------|--------|--------|-------------|--------|--------|
| Recon Free | 1 | Rp 1,500 | Rp 1,040 | **+Rp 460 (+31%)** | 🟡 Thin | Rp 9,005 | **-Rp 7,505 (-500%)** | 🔴 Critical |
| Recon Pro | 5 | Rp 7,500 | Rp 1,328 | **+Rp 6,172 (+82%)** | 🟢 Healthy | Rp 11,018 | **-Rp 3,518 (-47%)** | 🔴 Negative |
| Match | 1 | Rp 1,500 | Rp 166 | **+Rp 1,334 (+89%)** | 🟢 Healthy | Rp 166 | **+Rp 1,334 (+89%)** | 🟢 Healthy |
| Craft | 2 | Rp 3,000 | Rp 384 | **+Rp 2,616 (+87%)** | 🟢 Healthy | Rp 384 | **+Rp 2,616 (+87%)** | 🟢 Healthy |
| Polish | 1 | Rp 1,500 | Rp 108 | **+Rp 1,392 (+93%)** | 🟢 Healthy | Rp 108 | **+Rp 1,392 (+93%)** | 🟢 Healthy |

> **Cross-scenario finding:** The pack tier (Starter/Growth/Scale) has **minimal impact** on profitability. The real cliff is free-tier vs paid-tier APIs — specifically Serper. A user on the Scale pack paying Rp 1,500/credit has virtually the same margin as a Starter user at Rp 2,000/credit because Serper dominates costs, not the LLM.

---

## Step 5 — Free Tier Burn Rate Analysis

### Quota exhaustion per API

| API | Free Quota | Calls per Recon Free | Calls per Recon Pro | Runs until Exhausted |
|-----|-----------|---------------------|--------------------|--------------------|
| **Serper** | **100 / month** | **~15** | **~20** | **~6 Recon Free or ~5 Recon Pro** |
| Tavily | 1,000 / month | ~5 | ~7 | ~200 Recon Free or ~33 Recon Pro |
| Hunter | 25 / month | ~3 | ~4 | ~8 Recon Free or ~6 Recon Pro |
| Jina | No published hard limit | ~3 URLs | ~5 URLs | N/A |

### Exhaustion timeline by user scenario

| Scenario | Serper exhausted | Tavily exhausted | Hunter exhausted |
|----------|-----------------|-----------------|-----------------|
| **1 user, 1 Recon/day** | Day 6–7 | Day 40 | Day 8 |
| **1 user, 3 Recon/week** | Day 14 | Day 95 | Day 18 |
| **3 users, 1 Recon/day each** | Day 2 | Day 13 | Day 2–3 |
| **5 users, 1 Recon/week each** | Week 3 | Month 10 | Week 5 |
| **10 users, 1 Recon/week each** | Week 1–2 | Month 5 | Week 3 |

> **Critical path:** Serper is always the first to exhaust. Once exhausted, each Recon run adds $0.30–$0.40 in unrecovered cost at current pricing. With just 1 active user doing daily Recon, Serper is exhausted **before the end of the first week**.

### Monthly API cost at scale (paid tiers)

| User Count | Recon runs/mo (est.) | Serper cost/mo | Tavily cost/mo | Hunter cost/mo | OpenAI cost/mo | **Total/mo (IDR)** |
|-----------|---------------------|---------------|---------------|---------------|----------------|-------------------|
| 5 users | ~20 runs | $0.40 × 20 = $8 | $0.05 × 20 = $1 | $0.15 × 20 = $3 | $0.083 × 20 = $1.66 | **Rp 219,456** |
| 10 users | ~50 runs | $0.40 × 50 = $20 | $0.05 × 50 = $2.5 | $0.15 × 50 = $7.5 | $0.083 × 50 = $4.15 | **Rp 544,000** |
| 25 users | ~125 runs | $0.40 × 125 = $50 | $0.05 × 125 = $6.25 | $0.15 × 125 = $18.75 | $0.083 × 125 = $10.38 | **Rp 1,366,080** |

---

## Key Risks

### Risk 1 — CRITICAL: Serper Free Tier is Not a Sustainable Baseline
**Likelihood:** 100% — any real usage exhausts it within days.
**Impact:** Recon Free margin flips from +48% to -350%. Recon Pro flips from +87% to -10%.
**Mitigation:** Upgrade to Serper paid plan ($50/2,500 searches) before the first paying customer. At $50/2,500 searches, effective rate drops to $0.02/search but that's still the dominant cost. Consider reducing Serper calls per run from ~15 to ~8 by better query batching.

### Risk 2 — HIGH: `synthesize_profile` System Prompt is 8,800 Tokens
The system prompt alone for the final synthesis step costs $0.022 per call in GPT-4o input tokens before any user data is added. If this prompt grows further or context windows expand with more lane data, the cost scales linearly. The prompt should be treated as a cost-sensitive asset and not extended casually.

### Risk 3 — MEDIUM: Recon Free Credit Price is Too Low
At 1 credit, Recon Free has only a Rp 960 margin even on free-tier APIs, and any anomaly (longer homepage, more contacts, more news articles) can push token usage above estimates. With zero buffer against Serper costs, Recon Free has the thinnest margin of any stage.

### Risk 4 — LOW: Hunter.io Enrichment Scales Per-Contact
The hybrid pipeline in `score_and_enrich_contacts()` issues one Hunter domain search (1 credit) plus one `find_email_hunter()` per unmatched contact above prospectScore ≥ 55. In theory, a company with many high-scoring contacts could trigger 5–10 Hunter calls per Recon run, not the estimated ~3. This is bounded by the 25 contacts limit but should be verified in production.

---

## Recommended Actions

### Action 1 — Immediate: Raise Recon Free to 2 Credits
At 2 credits (Rp 4,000 Starter revenue), Recon Free margin on free-tier APIs becomes +74%. This also signals to users that even the "lite" Recon has real intelligence behind it. **Change location:** `backend/app/core/billing.py`, `OpCost.RECON_FREE = 2`.

### Action 2 — Before First Paying Customer: Upgrade Serper to Paid
$50/month for 2,500 searches covers ~166 Recon Free runs/month. This should be treated as a fixed infrastructure cost, not a variable one, and budgeted from the first month of revenue. A team of 5 users doing ~5 Recon runs/week (100/month total) fits comfortably in the $50 tier.

### Action 3 — Medium Term: Reduce Serper Calls in Lane A
Lane A currently generates ~6 angle × 2–3 Serper queries = 12–18 calls per run. Replacing 3–4 of the more generic angles (FINANCIAL, REPUTATION) with a single Tavily Research call (which bundles multiple searches) could cut Serper usage by 40–50% without degrading intelligence quality.

### Action 4 — At 50+ MAU: Cache Synthesis Prompts
The `synthesize_profile` system prompt (8,800 tokens) is fully static. Enabling OpenAI prompt caching for this system prompt would reduce its cost by ~75% on cache hits ($0.625 vs $2.50 per 1M input tokens). This is a zero-code-logic change — only the API call needs a `cache_control` header.

---

## Final Verification Checklist

After running a real Recon Pro in production, verify each of the following:

- [ ] **OpenAI Dashboard → Usage:** Check actual input/output tokens for `synthesize_profile`. If actual input > 20,000 tokens, re-run cost model with those figures.
- [ ] **OpenAI Dashboard → Usage:** Verify whether `gpt-4o-mini` or `gpt-4o` is being used for each function. If any function unexpectedly uses GPT-4o instead of mini, costs could be 10–15× higher.
- [ ] **Serper Dashboard:** Confirm how many searches were consumed per Recon run. If actual > 25 per run, update the model — Serper becomes the dominant spend.
- [ ] **Tavily Dashboard:** Verify actual search count for Recon Free vs Recon Pro. Confirm whether the `/research` endpoint counts as 1 API call or many internally.
- [ ] **Hunter Dashboard:** Confirm how many API credits were consumed per Recon run. Check whether domain-search + email-finder are both being billed per company or once per batch.
- [ ] **Supabase `credit_transactions` table:** Run a test purchase and one Recon Pro, then confirm the debit matches the expected 5 credits.
- [ ] **Actual vs Estimated Tokens:** If actual is more than 2× any estimate in Step 2, flag that stage as needing repricing. Use `/tools/pricing/calculator.js` to recalculate.
- [ ] **Recon Free vs Pro differentiation:** Confirm in production that Recon Free does NOT trigger `extract_from_tavily_report` (which adds ~$0.002 gpt-4o-mini cost). This is a Pro-only path.

---

*All cost figures are estimates based on static code analysis. Production token counts will vary based on actual company homepage length, number of contacts found, and news article volume.*
