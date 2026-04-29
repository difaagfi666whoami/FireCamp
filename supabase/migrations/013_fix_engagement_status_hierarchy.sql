-- =============================================================================
-- 013: Fix Engagement Status Hierarchy
-- Status hanya boleh naik dalam hirarki, tidak boleh turun.
-- Hirarki: pending → sent → opened → clicked → replied
-- Terminal: bounced, complained, failed — tidak bisa dioverwrite apapun.
-- =============================================================================

CREATE OR REPLACE FUNCTION increment_email_opens(p_campaign_email_id uuid)
RETURNS void AS $$
DECLARE
  v_campaign_analytics_id uuid;
  v_total_sent integer;
  v_total_opens integer;
  v_current_status text;
BEGIN
  SELECT engagement_status INTO v_current_status
  FROM email_analytics
  WHERE campaign_email_id = p_campaign_email_id;

  UPDATE email_analytics
  SET
    opens = opens + 1,
    updated_at = now(),
    engagement_status = CASE
      WHEN v_current_status IN ('bounced', 'complained', 'failed', 'clicked', 'replied')
        THEN v_current_status  -- jangan turunkan status yang lebih tinggi
      ELSE 'opened'
    END
  WHERE campaign_email_id = p_campaign_email_id
  RETURNING campaign_analytics_id INTO v_campaign_analytics_id;

  IF v_campaign_analytics_id IS NOT NULL THEN
    SELECT emails_sent INTO v_total_sent
    FROM campaign_analytics WHERE id = v_campaign_analytics_id;

    IF COALESCE(v_total_sent, 0) > 0 THEN
      SELECT sum(opens) INTO v_total_opens
      FROM email_analytics WHERE campaign_analytics_id = v_campaign_analytics_id;

      UPDATE campaign_analytics
      SET open_rate = ROUND(LEAST((v_total_opens::numeric / v_total_sent::numeric) * 100, 100.0), 2)
      WHERE id = v_campaign_analytics_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION increment_email_clicks(p_campaign_email_id uuid)
RETURNS void AS $$
DECLARE
  v_campaign_analytics_id uuid;
  v_total_sent integer;
  v_total_clicks integer;
  v_current_status text;
BEGIN
  SELECT engagement_status INTO v_current_status
  FROM email_analytics
  WHERE campaign_email_id = p_campaign_email_id;

  UPDATE email_analytics
  SET
    clicks = clicks + 1,
    updated_at = now(),
    engagement_status = CASE
      WHEN v_current_status IN ('bounced', 'complained', 'failed', 'replied')
        THEN v_current_status  -- 'replied' tidak boleh diturunkan ke 'clicked'
      ELSE 'clicked'
    END
  WHERE campaign_email_id = p_campaign_email_id
  RETURNING campaign_analytics_id INTO v_campaign_analytics_id;

  IF v_campaign_analytics_id IS NOT NULL THEN
    SELECT emails_sent INTO v_total_sent
    FROM campaign_analytics WHERE id = v_campaign_analytics_id;

    IF COALESCE(v_total_sent, 0) > 0 THEN
      SELECT sum(clicks) INTO v_total_clicks
      FROM email_analytics WHERE campaign_analytics_id = v_campaign_analytics_id;

      UPDATE campaign_analytics
      SET click_rate = ROUND(LEAST((v_total_clicks::numeric / v_total_sent::numeric) * 100, 100.0), 2)
      WHERE id = v_campaign_analytics_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;
