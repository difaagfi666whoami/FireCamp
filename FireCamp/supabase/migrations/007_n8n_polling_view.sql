-- =============================================================================
-- 007: n8n Polling View & Indexes
--
-- Creates a database view that n8n can poll directly to find scheduled emails
-- ready for sending, without needing complex multi-table queries.
--
-- Join path: campaign_emails → campaigns → companies ← contacts
-- Since campaigns link to companies (not individual contacts), we pick the
-- highest prospect_score contact per company using DISTINCT ON.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Indexes for fast polling on campaign_emails
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ce_status
  ON campaign_emails (status);

CREATE INDEX IF NOT EXISTS idx_ce_scheduled_date
  ON campaign_emails (scheduled_date);

CREATE INDEX IF NOT EXISTS idx_ce_scheduled_time
  ON campaign_emails (scheduled_time);

-- Composite index: the most common n8n polling filter pattern
CREATE INDEX IF NOT EXISTS idx_ce_polling
  ON campaign_emails (status, scheduled_date, scheduled_time)
  WHERE status = 'scheduled';

-- ---------------------------------------------------------------------------
-- 2. View: v_n8n_pending_emails
--    n8n polls this view with a simple:
--      SELECT * FROM v_n8n_pending_emails
--      WHERE scheduled_date = CURRENT_DATE
--        AND scheduled_time <= CURRENT_TIME
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_n8n_pending_emails AS
SELECT
  ce.id              AS email_id,
  ce.subject,
  ce.body,
  ce.scheduled_date,
  ce.scheduled_time,
  -- FALLBACK KE DUMMY EMAIL KARENA TABEL CONTACT MASIH KOSONG 
  COALESCE(ct.email, 'testing.campfire@yopmail.com') AS target_email,
  COALESCE(ct.name, 'Developer Test') AS target_name
FROM campaign_emails ce
JOIN campaigns c  ON c.id  = ce.campaign_id
LEFT JOIN LATERAL (
  SELECT email, name
  FROM contacts
  WHERE company_id = c.company_id
    AND email IS NOT NULL
  ORDER BY prospect_score DESC NULLS LAST
  LIMIT 1
) ct ON true
WHERE ce.status = 'scheduled';
