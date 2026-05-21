-- =============================================================================
-- Migration 030 — Email Suppression List + Per-Email Unsubscribe Token
--
-- Compliance: CAN-SPAM, GDPR Art. 21, UU PDP Indonesia Pasal 26,
-- Gmail/Yahoo bulk sender requirements (Feb 2024).
--
-- NOTE: this codebase resolves a campaign_email's target recipient through
-- campaigns → company → contacts via the v_pending_emails LATERAL view
-- (campaign_emails has no direct contact_id FK). The suppression RPC mirrors
-- the same resolution pattern.
-- =============================================================================

-- 1. Suppression list per user (the mailbox owner) — scoped via RLS.
CREATE TABLE IF NOT EXISTS email_suppression_list (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  reason      TEXT NOT NULL DEFAULT 'unsubscribed'
              CHECK (reason IN ('unsubscribed', 'bounced', 'complained', 'manual')),
  source      TEXT NOT NULL DEFAULT 'recipient_action',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, email)
);

CREATE INDEX IF NOT EXISTS email_suppression_user_email_idx
  ON email_suppression_list (user_id, email);

ALTER TABLE email_suppression_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_owns_row" ON email_suppression_list;
CREATE POLICY "user_owns_row" ON email_suppression_list
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Per-email unsubscribe token (UUID, unique). Backfill existing rows;
--    new rows get a default via gen_random_uuid().
ALTER TABLE campaign_emails
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS campaign_emails_unsubscribe_token_idx
  ON campaign_emails (unsubscribe_token);

-- 3. SECURITY DEFINER RPC for the public unsubscribe endpoint.
--    Resolves token → (user_id, email) using the same LATERAL pattern as
--    v_pending_emails, then idempotently adds the address to the user's
--    suppression list and cancels any future scheduled emails to it.
CREATE OR REPLACE FUNCTION add_to_suppression_list(
  p_unsubscribe_token UUID
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email   TEXT;
BEGIN
  -- Resolve recipient: campaign_email → campaign → company → top-scored contact.
  SELECT ce.user_id, ct.email
    INTO v_user_id, v_email
    FROM campaign_emails ce
    JOIN campaigns c ON c.id = ce.campaign_id AND c.user_id = ce.user_id
    JOIN LATERAL (
      SELECT email FROM contacts
       WHERE company_id = c.company_id
         AND user_id    = c.user_id
         AND email IS NOT NULL
       ORDER BY prospect_score DESC NULLS LAST
       LIMIT 1
    ) ct ON true
   WHERE ce.unsubscribe_token = p_unsubscribe_token
   LIMIT 1;

  IF v_user_id IS NULL OR v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;

  -- Idempotent insert.
  INSERT INTO email_suppression_list (user_id, email, reason)
    VALUES (v_user_id, v_email, 'unsubscribed')
    ON CONFLICT (user_id, email) DO NOTHING;

  -- Cancel any future scheduled emails for this address.
  -- We only mark them 'failed' (not dead_letter) so analytics distinguishes
  -- recipient opt-out from delivery failure.
  UPDATE campaign_emails
     SET status     = 'failed',
         last_error = 'Recipient unsubscribed'
   WHERE user_id = v_user_id
     AND status  = 'scheduled'
     AND campaign_id IN (
       SELECT c.id FROM campaigns c
       JOIN LATERAL (
         SELECT email FROM contacts
          WHERE company_id = c.company_id
            AND user_id    = c.user_id
            AND email IS NOT NULL
          ORDER BY prospect_score DESC NULLS LAST
          LIMIT 1
       ) ct ON ct.email = v_email
       WHERE c.user_id = v_user_id
     );

  RETURN jsonb_build_object('ok', true, 'email', v_email);
END;
$$;

GRANT EXECUTE ON FUNCTION add_to_suppression_list(UUID) TO anon, authenticated, service_role;

-- 4. Rewrite v_pending_emails to (a) carry unsubscribe_token, (b) exclude
--    addresses in the suppression list. Preserves the parent-ownership
--    consistency check from migration 028.
DROP VIEW IF EXISTS v_pending_emails;
CREATE VIEW v_pending_emails AS
SELECT
  ce.id              AS email_id,
  ce.user_id,
  ce.subject,
  ce.body,
  ce.scheduled_date,
  ce.scheduled_time,
  ce.unsubscribe_token,
  COALESCE(ct.email, 'difaagfi1998@gmail.com') AS target_email,
  COALESCE(ct.name,  'Developer Test')          AS target_name
FROM campaign_emails ce
JOIN campaigns c
  ON c.id = ce.campaign_id
 AND c.user_id = ce.user_id
LEFT JOIN LATERAL (
  SELECT email, name
    FROM contacts
   WHERE company_id = c.company_id
     AND user_id    = c.user_id
     AND email IS NOT NULL
   ORDER BY prospect_score DESC NULLS LAST
   LIMIT 1
) ct ON true
LEFT JOIN email_suppression_list sl
       ON sl.user_id = ce.user_id
      AND sl.email   = ct.email
WHERE ce.status = 'scheduled'
  AND sl.id IS NULL;   -- exclude addresses on the suppression list
