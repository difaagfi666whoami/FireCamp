-- =============================================================================
-- 009: Remove n8n View — Replace with In-House v_pending_emails
--
-- n8n has been removed from the architecture. The old view is replaced with
-- an identically-structured view under a vendor-neutral name so that the
-- Vercel Cron dispatcher (app/api/cron/dispatch) can query it directly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop the old n8n-specific view
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_n8n_pending_emails;

-- ---------------------------------------------------------------------------
-- 2. Recreate as v_pending_emails (same query, vendor-neutral name)
--    Join path: campaign_emails → campaigns → companies ← contacts
--    Picks highest prospect_score contact per company via LATERAL subquery.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_pending_emails AS
SELECT
  ce.id              AS email_id,
  ce.subject,
  ce.body,
  ce.scheduled_date,
  ce.scheduled_time,
  -- Fallback ke dummy email jika tabel contacts belum terisi
  COALESCE(ct.email, 'difaagfi1998@gmail.com') AS target_email,
  COALESCE(ct.name, 'Developer Test') AS target_name
FROM campaign_emails ce
JOIN campaigns c  ON c.id  = ce.campaign_id
LEFT JOIN LATERAL (
  SELECT email, name
  FROM contacts1
  WHERE company_id = c.company_id
    AND email IS NOT NULL
  ORDER BY prospect_score DESC NULLS LAST
  LIMIT 1
) ct ON true
WHERE ce.status = 'scheduled';
