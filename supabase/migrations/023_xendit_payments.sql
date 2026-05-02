-- =============================================================================
-- Migration 023 — Xendit Payment Gateway (Phase 4)
--
-- New table:
--   xendit_payments — tracks pending/paid QRIS and Virtual Account payments
--
-- Added columns on credit_transactions:
--   payment_gateway   — 'stripe' | 'xendit' (default 'stripe' for existing rows)
--   xendit_payment_id — reference to xendit_payments.xendit_id (for audit)
-- =============================================================================

-- ── 1. xendit_payments tracking table ─────────────────────────────────────────
--
-- Each row represents one pending or completed Xendit payment attempt.
-- Used for idempotency: webhook handler does an atomic UPDATE ... WHERE status='PENDING'
-- to ensure credits are only granted once even if Xendit retries the webhook.

CREATE TABLE IF NOT EXISTS xendit_payments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  xendit_id       TEXT        NOT NULL UNIQUE,  -- QR code ID or VA ID returned by Xendit
  reference_id    TEXT        NOT NULL,          -- our internal ref: "campfire-{uuid}"
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id         TEXT        NOT NULL,          -- matches CREDIT_PACKS[].id
  credits         INTEGER     NOT NULL,
  payment_method  TEXT        NOT NULL,          -- 'QRIS' | 'VA_BCA' | 'VA_MANDIRI' etc.
  amount_idr      INTEGER     NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'FAILED')),
  va_number       TEXT,                          -- account number for VA payments
  qr_string       TEXT,                          -- raw QRIS string to render as QR code
  expires_at      TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS xendit_payments_user_id_idx ON xendit_payments(user_id);
CREATE INDEX IF NOT EXISTS xendit_payments_status_idx  ON xendit_payments(status);

ALTER TABLE xendit_payments ENABLE ROW LEVEL SECURITY;

-- Users may read their own payment records (e.g. to show history).
-- Writes are exclusively backend (service_role).
DROP POLICY IF EXISTS "user_owns_row" ON xendit_payments;
CREATE POLICY "user_owns_row" ON xendit_payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ── 2. Extend credit_transactions for multi-gateway audit ─────────────────────

ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS payment_gateway  TEXT DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS xendit_payment_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_xendit_payment_uniq
  ON credit_transactions(xendit_payment_id)
  WHERE xendit_payment_id IS NOT NULL;

-- ── 3. SQL helper: mark_xendit_paid() ─────────────────────────────────────────
--
-- Atomically flips xendit_payments.status from 'PENDING' → 'PAID'.
-- Returns the payment row (user_id, credits, pack_id) if updated, nothing if
-- the payment was already processed or not found.
-- Called by the Xendit webhook handler inside the Python service via RPC.

CREATE OR REPLACE FUNCTION public.mark_xendit_paid(p_xendit_id TEXT)
RETURNS TABLE (
  user_id  UUID,
  credits  INTEGER,
  pack_id  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    UPDATE xendit_payments
       SET status     = 'PAID',
           paid_at    = NOW(),
           updated_at = NOW()
     WHERE xendit_id  = p_xendit_id
       AND status     = 'PENDING'
    RETURNING xendit_payments.user_id,
              xendit_payments.credits,
              xendit_payments.pack_id;
END;
$$;
