-- =============================================================================
-- Migration 026 — Add user_id to v_pending_emails view
--
-- The cron dispatcher needs user_id to resolve per-user sending domains.
-- Recreates the view (originally defined in 009_remove_n8n_view.sql) with
-- ce.user_id added. All other columns preserved exactly.
-- =============================================================================

DROP VIEW IF EXISTS v_pending_emails;

CREATE VIEW v_pending_emails AS
SELECT
  ce.id              AS email_id,
  ce.user_id,
  ce.subject,
  ce.body,
  ce.scheduled_date,
  ce.scheduled_time,
  COALESCE(ct.email, 'difaagfi1998@gmail.com') AS target_email,
  COALESCE(ct.name, 'Developer Test')          AS target_name
FROM campaign_emails ce
JOIN campaigns c ON c.id = ce.campaign_id
LEFT JOIN LATERAL (
  SELECT email, name FROM contacts
  WHERE company_id = c.company_id AND email IS NOT NULL
  ORDER BY prospect_score DESC NULLS LAST
  LIMIT 1
) ct ON true
WHERE ce.status = 'scheduled';
