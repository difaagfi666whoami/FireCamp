-- =============================================================================
-- 008: Resend RPC & Analytics Automation
--
-- Membuat fungsi remote procedure call (RPC) yang dipakai oleh Webhook Resend
-- untuk menambah metrik email_analytics dan mengalkulasi persentase kampanye
-- secara reaktif (trigger-like behavior).
-- =============================================================================

-- Fungsi untuk menambah email terkirim (Dispatched)
CREATE OR REPLACE FUNCTION increment_campaign_emails_sent(p_campaign_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE campaign_analytics 
  SET emails_sent = emails_sent + 1 
  WHERE campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Fungsi untuk Webhook (Opens)
CREATE OR REPLACE FUNCTION increment_email_opens(p_campaign_email_id uuid)
RETURNS void AS $$
DECLARE
  v_campaign_analytics_id uuid;
  v_total_sent integer;
  v_total_opens integer;
BEGIN
  UPDATE email_analytics 
  SET opens = opens + 1, engagement_status = 'opened' 
  WHERE campaign_email_id = p_campaign_email_id
  RETURNING campaign_analytics_id INTO v_campaign_analytics_id;

  IF v_campaign_analytics_id IS NOT NULL THEN
    SELECT emails_sent INTO v_total_sent FROM campaign_analytics WHERE id = v_campaign_analytics_id;
    IF COALESCE(v_total_sent, 0) > 0 THEN
      SELECT sum(opens) INTO v_total_opens FROM email_analytics WHERE campaign_analytics_id = v_campaign_analytics_id;
      UPDATE campaign_analytics 
      SET open_rate = ROUND( LEAST( (v_total_opens::numeric / v_total_sent::numeric) * 100, 100.0 ), 2 )
      WHERE id = v_campaign_analytics_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Fungsi untuk Webhook (Clicks)
CREATE OR REPLACE FUNCTION increment_email_clicks(p_campaign_email_id uuid)
RETURNS void AS $$
DECLARE
  v_campaign_analytics_id uuid;
  v_total_sent integer;
  v_total_clicks integer;
BEGIN
  UPDATE email_analytics 
  SET clicks = clicks + 1, engagement_status = 'clicked'
  WHERE campaign_email_id = p_campaign_email_id
  RETURNING campaign_analytics_id INTO v_campaign_analytics_id;

  IF v_campaign_analytics_id IS NOT NULL THEN
    SELECT emails_sent INTO v_total_sent FROM campaign_analytics WHERE id = v_campaign_analytics_id;
    IF COALESCE(v_total_sent, 0) > 0 THEN
      SELECT sum(clicks) INTO v_total_clicks FROM email_analytics WHERE campaign_analytics_id = v_campaign_analytics_id;
      UPDATE campaign_analytics 
      SET click_rate = ROUND( LEAST( (v_total_clicks::numeric / v_total_sent::numeric) * 100, 100.0 ), 2 )
      WHERE id = v_campaign_analytics_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;
