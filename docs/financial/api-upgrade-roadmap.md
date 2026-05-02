# Campfire — API Upgrade Roadmap
**Generated:** 2026-05-02

When to upgrade each external API from free to paid tier, triggered by user/usage milestones.

---

## Upgrade Decision Framework

Each API upgrade is triggered by a **usage signal**, not a calendar date. The signals below are ordered by urgency — Serper should be upgraded before you acquire even the first paying user.

| Priority | API | Trigger | Action |
|----------|-----|---------|--------|
| 🚨 P0 | Serper | First paying customer | Upgrade immediately |
| 🔴 P1 | Hunter | 3–5 active users | Upgrade to Basic |
| 🟡 P2 | Tavily | 10–15 active users | Upgrade to Basic |
| 🟢 P3 | Jina | Monitor; likely never paid | Evaluate if rate-limited |
| ℹ️ N/A | OpenAI | Already pay-per-use | Scale naturally |

---

## Detailed Upgrade Milestones

### Milestone 0 — Pre-Launch (NOW)
**Trigger:** Any paying user expected within 30 days

**Problem:** Serper free tier = 100 searches/month. One Recon run uses ~15 searches. Free tier is exhausted after ~6 Recon runs — that is less than 1 week of usage for a single active user.

**Action Required:**
- Sign up for Serper paid plan at https://serper.dev/
- Choose: **$50/month for 2,500 searches**
- Update `SERPER_API_KEY` in `.env.local` (already set; just ensure billing is active)
- Set a monthly spend alert in the Serper dashboard

**Cost Impact:**
| | Before Upgrade | After Upgrade |
|-|---------------|---------------|
| Serper cost/Recon | $0.00 (free tier) | $0.30 per Recon Free |
| Monthly fixed cost | $0 | **$50/month** |
| Break-even | — | ~167 Recon runs/month (~33 users at 1/week) |

**IDR equivalent:** Rp 800,000/month fixed

---

### Milestone 1 — 3–5 Active Users
**Trigger:** Hunter free tier (25 verifications/month) exhausted; ~8 Recon runs

**Problem:** Hunter free tier = 25 verifications/month. Each Recon run uses ~3 Hunter calls. Free tier lasts only ~8 Recon runs. After exhaustion, Hunter silently fails (returns empty emails) — degrading contact quality without an error message.

**Action Required:**
- Upgrade Hunter.io to paid plan
- Recommended: **Starter plan at $49/month (1,000 verifications)**
- Verify in `external_apis.py` that 404 responses are handled gracefully (they are — function returns `{}`)

**Cost Impact:**
| | Before Upgrade | After Upgrade |
|-|---------------|---------------|
| Hunter cost/run | $0.00 (free tier) | $0.147 per Recon run |
| Monthly fixed cost | $0 | **$49/month** |

**IDR equivalent:** Rp 784,000/month

**Note:** Hunter enrichment is optional — `HUNTER_API_KEY` defaults to `None`. If budget is constrained, consider leaving Hunter on free tier and accepting degraded email enrichment until Milestone 2.

---

### Milestone 2 — 10–15 Active Users
**Trigger:** Tavily free tier (1,000 searches/month) approaching exhaustion; ~200 Recon Free or ~100 Recon Pro runs

**Problem:** Tavily free tier is generous (1,000/month) but the Tavily Research API (used in Recon Pro) may count differently than regular searches. Actual exhaustion point is [NEEDS MANUAL VERIFICATION in Tavily dashboard].

**Action Required:**
- Monitor Tavily dashboard usage weekly once you exceed 10 users
- Upgrade when monthly usage hits 700–800 searches (leave headroom)
- Recommended: **Tavily Basic plan** (~$20/month — verify current pricing at https://tavily.com)

**Cost Impact:**
| | Before Upgrade | After Upgrade |
|-|---------------|---------------|
| Tavily cost/run | $0.00 (free tier) | ~$0.05–$0.07 per Recon run |
| Monthly fixed cost | $0 | **~$20/month** |

**IDR equivalent:** Rp 320,000/month

---

### Milestone 3 — 25–50 Active Users
**Trigger:** Serper $50 tier approaching 2,500 searches/month (ceiling)

**Problem:** At 25 active users each running 2 Recons/week = 200 runs/month × 15 searches = 3,000 searches/month, which exceeds the $50 tier.

**Action Required:**
- Upgrade to Serper next tier ($50/5,000 searches or $100/10,000 — verify at https://serper.dev/pricing)
- OR begin reducing Serper calls per run: replace some angles with a single Tavily Research call (Tavily bundles multiple searches internally at lower effective per-query cost)

**Cost Impact:**
| | $50 tier | Next tier |
|-|---------|-----------|
| Searches included | 2,500 | 5,000–10,000 |
| Monthly fixed cost | Rp 800,000 | Rp 1,600,000–Rp 3,200,000 |
| Cost per search | $0.020 | $0.010–$0.020 |

---

### Milestone 4 — 50–100 Active Users
**Trigger:** OpenAI spend becomes material (>$200/month)

**Problem:** GPT-4o costs are variable, not fixed. At 50 users × 4 Recon Pro/month = 200 runs × $0.083 OpenAI cost = $16.60/month in OpenAI — this is manageable. The issue scales when users also run Match + Craft heavily. Watch the OpenAI usage dashboard.

**Actions Available:**
1. **Enable OpenAI Prompt Caching** — `synthesize_profile` has an 8,800-token static system prompt. Enabling cache control reduces input token cost by 75% on cache hits. Estimated monthly saving at 200 runs: $0.022 × 0.75 × 200 = **$3.30/month** (small now, scales linearly).
2. **Consider GPT-4o-mini for Match** — `run_matching` currently uses GPT-4o (950 tokens in, 800 out = $0.0104/run). Switching to GPT-4o-mini would cost $0.000623/run — a 94% cost reduction with acceptable quality tradeoff.
3. **Monitor `generate_campaign` output length** — Craft is capped at 3,000 tokens output (3 emails). If actual output consistently hits the cap, consider whether shorter emails reduce token cost without hurting conversion.

---

## Monthly Total API Fixed Cost by Milestone

| Milestone | Active Users | APIs Upgraded | Fixed Monthly (USD) | Fixed Monthly (IDR) |
|-----------|-------------|--------------|--------------------|--------------------|
| Pre-launch | 0–1 | Serper | $50 | Rp 800,000 |
| M1 | 3–5 | + Hunter | $99 | Rp 1,584,000 |
| M2 | 10–15 | + Tavily | ~$119 | ~Rp 1,904,000 |
| M3 | 25–50 | Serper upgrade | ~$149 | ~Rp 2,384,000 |
| M4 | 50–100 | Prompt caching + optimization | ~$149 + variable | ~Rp 2,384,000 + variable |

> **Rule of thumb:** Fixed API costs should stay below 15% of monthly credit revenue. At Rp 1,904,000/month fixed costs, you need at least Rp 12,700,000/month in credit sales = ~6,350 credits sold = ~127 Starter packs/month.

---

## Revenue Coverage Check

At each milestone, verify that monthly credit revenue covers fixed API costs:

| Milestone | Fixed API Cost/mo | Credits to Break Even | Starter Packs to Break Even |
|-----------|------------------|-----------------------|-----------------------------|
| Pre-launch | Rp 800,000 | 400 credits | 8 Starter packs |
| M1 | Rp 1,584,000 | 792 credits | ~16 Starter packs |
| M2 | Rp 1,904,000 | 952 credits | ~20 Starter packs |
| M3 | Rp 2,384,000 | 1,192 credits | ~24 Starter packs |

*Break-even credits = Fixed cost ÷ Rp 2,000 (Starter price/credit).*

---

## What to Monitor on a Weekly Basis

Once you have 5+ active users, check these dashboards weekly:

| Dashboard | URL | What to Check |
|-----------|-----|---------------|
| OpenAI Usage | https://platform.openai.com/usage | Token costs per day; watch for spike |
| Serper Dashboard | https://serper.dev/dashboard | Search count this month |
| Tavily Dashboard | https://app.tavily.com | Search/research credits used |
| Hunter Dashboard | https://hunter.io/account | Verifications used this month |
| Supabase `credit_transactions` | SQL: `SELECT COUNT(*), SUM(amount) FROM credit_transactions WHERE type = 'debit'` | Credits consumed vs purchased |

---

*All cost figures use May 2025 API pricing. Verify current pricing before making upgrade decisions.*
