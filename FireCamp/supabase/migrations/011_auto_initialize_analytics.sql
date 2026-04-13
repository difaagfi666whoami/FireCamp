-- =============================================================================
-- 011: Auto-Initialize Analytics Rows via Triggers
--
-- ROOT CAUSE: Webhook RPCs (increment_email_opens/clicks/replies) do
-- UPDATE ... WHERE campaign_email_id = $1, but the target rows in
-- campaign_analytics and email_analytics were never created during the
-- Craft/Launch pipeline. The UPDATEs silently modify 0 rows.
--
-- FIX: PostgreSQL triggers that automatically INSERT analytics rows
-- whenever a campaign or campaign_email is created. Includes a backfill
-- script at the bottom for existing data.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. TRIGGER: Auto-create campaign_analytics when a campaign is inserted
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_auto_create_campaign_analytics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO campaign_analytics (campaign_id)
  VALUES (NEW.id)
  ON CONFLICT (campaign_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists to make migration re-runnable
DROP TRIGGER IF EXISTS trg_auto_campaign_analytics ON campaigns;

CREATE TRIGGER trg_auto_campaign_analytics
  AFTER INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_create_campaign_analytics();


-- ---------------------------------------------------------------------------
-- 2. TRIGGER: Auto-create email_analytics when a campaign_email is inserted
--    Looks up the parent campaign_analytics.id via campaign_id join,
--    then inserts the email_analytics row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_auto_create_email_analytics()
RETURNS TRIGGER AS $$
DECLARE
  v_analytics_id uuid;
BEGIN
  -- Resolve the campaign_analytics row for this email's campaign
  SELECT ca.id INTO v_analytics_id
  FROM campaign_analytics ca
  WHERE ca.campaign_id = NEW.campaign_id;

  -- Safety: if campaign_analytics somehow doesn't exist yet (race condition),
  -- create it on the fly so we never silently skip
  IF v_analytics_id IS NULL THEN
    INSERT INTO campaign_analytics (campaign_id)
    VALUES (NEW.campaign_id)
    ON CONFLICT (campaign_id) DO NOTHING
    RETURNING id INTO v_analytics_id;

    -- If the ON CONFLICT hit, we still need the id
    IF v_analytics_id IS NULL THEN
      SELECT ca.id INTO v_analytics_id
      FROM campaign_analytics ca
      WHERE ca.campaign_id = NEW.campaign_id;
    END IF;
  END IF;

  -- Insert the email_analytics row
  IF v_analytics_id IS NOT NULL THEN
    INSERT INTO email_analytics (
      campaign_analytics_id,
      campaign_email_id,
      email_number
    )
    VALUES (
      v_analytics_id,
      NEW.id,
      NEW.sequence_number
    )
    ON CONFLICT (campaign_analytics_id, campaign_email_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_email_analytics ON campaign_emails;

CREATE TRIGGER trg_auto_email_analytics
  AFTER INSERT ON campaign_emails
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_create_email_analytics();


-- ---------------------------------------------------------------------------
-- 3. BACKFILL: Seed analytics rows for ALL existing campaigns & emails
--    Safe to run multiple times (ON CONFLICT DO NOTHING).
-- ---------------------------------------------------------------------------

-- 3a. Backfill campaign_analytics for every campaign that lacks one
INSERT INTO campaign_analytics (campaign_id)
SELECT c.id
FROM campaigns c
WHERE NOT EXISTS (
  SELECT 1 FROM campaign_analytics ca WHERE ca.campaign_id = c.id
)
ON CONFLICT (campaign_id) DO NOTHING;

-- 3b. Backfill email_analytics for every campaign_email that lacks one
INSERT INTO email_analytics (campaign_analytics_id, campaign_email_id, email_number)
SELECT
  ca.id,
  ce.id,
  ce.sequence_number
FROM campaign_emails ce
JOIN campaigns camp ON camp.id = ce.campaign_id
JOIN campaign_analytics ca ON ca.campaign_id = camp.id
WHERE NOT EXISTS (
  SELECT 1
  FROM email_analytics ea
  WHERE ea.campaign_analytics_id = ca.id
    AND ea.campaign_email_id = ce.id
)
ON CONFLICT (campaign_analytics_id, campaign_email_id) DO NOTHING;
