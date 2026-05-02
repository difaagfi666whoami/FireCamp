# Existing Billing Architecture — Stripe (Phase 2)

## Overview

Campfire uses a **pay-as-you-go credits** model. Users purchase credit packs
via Stripe Checkout; those credits are consumed by AI operations (Recon, Match,
Craft, Polish). There are no subscriptions.

---

## Credit Packs

| ID       | Name    | Credits | Price (IDR) | Recommended |
|----------|---------|---------|-------------|-------------|
| starter  | Starter | 50      | Rp 100,000  | No          |
| growth   | Growth  | 200     | Rp 350,000  | Yes         |
| scale    | Scale   | 500     | Rp 750,000  | No          |

Source of truth: `backend/app/core/billing.py` → `CREDIT_PACKS`.

---

## Operation Costs (credits)

| Operation    | Cost |
|-------------|------|
| Recon Free  | 1    |
| Recon Pro   | 5    |
| Match       | 1    |
| Craft       | 2    |
| Polish      | 1    |

Source: `backend/app/core/billing.py` → `OpCost`.

---

## Database Tables

### `user_credits`
One row per user. Holds current credit balance.
```sql
user_id     UUID PRIMARY KEY
balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0)
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```
- RLS: users can SELECT only their own row
- Writes only via service_role (backend)

### `credit_transactions`
Append-only ledger. Every credit add/deduct is a row here.
```sql
id                 UUID PRIMARY KEY
user_id            UUID REFERENCES auth.users(id)
type               ENUM('purchase', 'debit', 'refund', 'grant')
amount             INTEGER  -- positive for purchase/grant/refund, negative for debit
description        TEXT
stripe_session_id  TEXT     -- unique; NULL for debit/grant rows
created_at         TIMESTAMPTZ
```
- Unique index on `stripe_session_id WHERE NOT NULL` — prevents duplicate webhook crediting

---

## SQL Helper Functions

### `debit_credits(p_user_id, p_amount, p_description) → BOOLEAN`
- Locks the `user_credits` row, checks balance, deducts atomically
- Inserts a `type='debit'` ledger entry with negative amount
- Returns `FALSE` (and rolls back) if balance insufficient

### `credit_credits(p_user_id, p_amount, p_type, p_description, p_stripe_session_id) → BOOLEAN`
- Upserts `user_credits` (adds to balance)
- Inserts `type=p_type` ledger entry
- Returns `FALSE` (no-op) if `stripe_session_id` was already processed

Both are `SECURITY DEFINER` and only reachable via service-role key.

---

## Stripe Payment Flow

```
1. User clicks "Beli" on /pricing
2. Frontend: createCheckout(packId)  → POST /api/billing/checkout
3. Backend: stripe.checkout.Session.create() with metadata {user_id, pack_id, credits}
4. Backend returns { url }
5. Frontend: window.location.href = url  (redirect to Stripe)
6. User pays on Stripe
7. Stripe → POST /api/webhooks/stripe
8. Backend: verify signature, extract metadata
9. Backend: credits_service.grant(user_id, credits, "purchase", stripe_session_id)
10. SQL: credit_credits() upserts balance + inserts ledger row
11. User lands on /billing/success  (polls balance every 1.5s for ~9s)
```

---

## Backend Files

| File | Purpose |
|------|---------|
| `backend/app/core/billing.py` | Pricing constants (packs + OpCost) |
| `backend/app/api/routers/billing.py` | HTTP endpoints: packages, balance, checkout, webhook |
| `backend/app/services/credits_service.py` | Low-level Supabase RPC wrappers (debit / grant / get_balance) |
| `supabase/migrations/019_billing.sql` | Tables + SQL functions |
| `supabase/migrations/020_signup_credit_grant.sql` | Auto-grant 5 credits on signup |

---

## Frontend Files

| File | Purpose |
|------|---------|
| `lib/api/credits.ts` | Fetch wrappers: getBalance, getPackages, createCheckout, getTransactions |
| `app/(shell)/pricing/page.tsx` | Package grid + cost breakdown + checkout trigger |
| `app/(shell)/billing/success/page.tsx` | Post-checkout landing, polls balance |

---

## Credit Debit Pattern (used in every AI router)

```python
if not await credits_service.debit(user_id, OpCost.RECON_PRO, "Recon Pro"):
    raise HTTPException(status_code=402, detail="Kredit tidak cukup. Top up di /pricing.")
try:
    result = await do_ai_work()
except Exception:
    await credits_service.grant(user_id, OpCost.RECON_PRO, "Refund — Recon Pro gagal", tx_type="refund")
    raise
```

The `402` response is the frontend's cue to show a top-up CTA.
