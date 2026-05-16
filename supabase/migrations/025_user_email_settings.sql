-- =============================================================================
-- Migration 025 — Custom Sending Domain per User
--
-- Stores per-user email sender configuration.
-- Integrates with Resend Domains API for DNS verification.
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_email_settings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Sender identity
  from_name           TEXT        NOT NULL DEFAULT '',
  from_email          TEXT        NOT NULL DEFAULT '',

  -- Resend domain management
  resend_domain_id    TEXT,
  domain_status       TEXT        NOT NULL DEFAULT 'unverified'
                      CHECK (domain_status IN ('unverified', 'pending', 'verified', 'failed')),
  dns_records         JSONB,
  domain_verified_at  TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_email_settings_user_id_idx ON user_email_settings(user_id);
CREATE INDEX IF NOT EXISTS user_email_settings_domain_status_idx ON user_email_settings(domain_status);

ALTER TABLE user_email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_owns_row" ON user_email_settings;
CREATE POLICY "user_owns_row"
  ON user_email_settings
  FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_user_email_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_email_settings_updated_at ON user_email_settings;
CREATE TRIGGER trg_user_email_settings_updated_at
  BEFORE UPDATE ON user_email_settings
  FOR EACH ROW EXECUTE FUNCTION update_user_email_settings_updated_at();
