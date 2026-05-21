-- =============================================================================
-- Migration 029 — Email retry tracking + dead-letter terminal status
--
-- Prevents infinite retry loops on persistently failing emails. After
-- MAX_RETRIES (3) attempts the dispatcher marks the email 'dead_letter'
-- and stops re-scheduling it. Operators can inspect last_error to triage.
-- =============================================================================

-- 1. Tracking columns
ALTER TABLE campaign_emails
  ADD COLUMN IF NOT EXISTS retry_count   INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  ADD COLUMN IF NOT EXISTS last_error    TEXT,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- 2. Add 'dead_letter' value to email_status enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
     WHERE enumlabel = 'dead_letter'
       AND enumtypid = 'email_status'::regtype
  ) THEN
    ALTER TYPE email_status ADD VALUE 'dead_letter' AFTER 'failed';
  END IF;
END $$;

-- 3. Index for dead-letter analytics (partial index — small footprint)
CREATE INDEX IF NOT EXISTS campaign_emails_dead_letter_idx
  ON campaign_emails (user_id, last_retry_at DESC)
  WHERE status = 'dead_letter';
