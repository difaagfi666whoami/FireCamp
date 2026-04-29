-- =============================================================================
-- Migration 019 — Phase 2 Billing (Stripe pay-as-you-go credits)
--
-- Two new tables:
--   user_credits          — per-user balance (1 row per user)
--   credit_transactions   — append-only ledger (purchase + debit history)
--
-- Helper SQL function:
--   debit_credits(uid, amount, description) → BOOLEAN
--     Atomically deducts credits + writes a debit transaction.
--     Returns false (and rolls back) if balance is insufficient.
--
-- Seed: gives the existing seed user 100 free credits to test the flow.
-- =============================================================================

-- ── 1. user_credits ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_credits (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_owns_row" ON user_credits;
CREATE POLICY "user_owns_row" ON user_credits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Writes are exclusively done via service_role (backend) so we don't expose a
-- write policy for `authenticated`.

-- ── 2. credit_transactions (append-only ledger) ──────────────────────────────

DO $$ BEGIN
  CREATE TYPE credit_tx_type AS ENUM ('purchase', 'debit', 'refund', 'grant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS credit_transactions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type               credit_tx_type NOT NULL,
  amount             INTEGER NOT NULL,                                 -- positive for purchase/grant/refund, negative for debit
  description        TEXT NOT NULL DEFAULT '',
  stripe_session_id  TEXT,                                             -- only for type='purchase'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_stripe_session_uniq
  ON credit_transactions(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS credit_transactions_user_id_idx ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS credit_transactions_created_at_idx ON credit_transactions(created_at DESC);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_owns_row" ON credit_transactions;
CREATE POLICY "user_owns_row" ON credit_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ── 3. debit_credits() helper ────────────────────────────────────────────────
--
-- Used by backend service role. Atomic: locks row, checks balance, deducts,
-- writes ledger entry. Returns true on success, false on insufficient funds.

CREATE OR REPLACE FUNCTION public.debit_credits(
  p_user_id      UUID,
  p_amount       INTEGER,
  p_description  TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'debit_credits: amount must be positive (got %)', p_amount;
  END IF;

  -- Lock the row to avoid race conditions on concurrent debits
  SELECT balance INTO current_balance
    FROM user_credits
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF current_balance IS NULL THEN
    -- No row yet → treat as zero balance (insufficient)
    RETURN FALSE;
  END IF;

  IF current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE user_credits
     SET balance     = balance - p_amount,
         updated_at  = NOW()
   WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'debit', -p_amount, p_description);

  RETURN TRUE;
END;
$$;

-- ── 4. credit_credits() helper for purchases / grants ────────────────────────
--
-- Idempotent on stripe_session_id: if the same session is processed twice
-- (e.g. webhook replay), only the first one applies.

CREATE OR REPLACE FUNCTION public.credit_credits(
  p_user_id           UUID,
  p_amount            INTEGER,
  p_type              credit_tx_type,
  p_description       TEXT,
  p_stripe_session_id TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'credit_credits: amount must be positive (got %)', p_amount;
  END IF;

  -- Idempotency: skip if this Stripe session was already processed
  IF p_stripe_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM credit_transactions WHERE stripe_session_id = p_stripe_session_id
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO user_credits (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET balance    = user_credits.balance + EXCLUDED.balance,
                updated_at = NOW();

  INSERT INTO credit_transactions (user_id, type, amount, description, stripe_session_id)
  VALUES (p_user_id, p_type, p_amount, p_description, p_stripe_session_id);

  RETURN TRUE;
END;
$$;

-- ── 5. Seed: give existing seed user 100 free credits ───────────────────────

DO $$
DECLARE
  owner_id UUID;
BEGIN
  SELECT id INTO owner_id FROM auth.users WHERE email = 'difaagfi1998@gmail.com' LIMIT 1;
  IF owner_id IS NULL THEN
    RAISE NOTICE 'Seed user difaagfi1998@gmail.com not found — skipping initial grant';
    RETURN;
  END IF;

  -- Only seed if they don't have a credit row yet
  IF NOT EXISTS (SELECT 1 FROM user_credits WHERE user_id = owner_id) THEN
    PERFORM credit_credits(owner_id, 100, 'grant', 'Seed grant for Phase 2 testing', NULL);
  END IF;
END $$;
