-- =============================================================================
-- 010: Reply Tracking Support
--
-- Adds resend_message_id to campaign_emails for In-Reply-To header matching,
-- and creates increment_email_replies RPC for webhook-driven reply counting.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add Resend Message-ID column to campaign_emails
--    Stored when the dispatcher sends an email via Resend.
--    Used by inbound webhook Layer 2 (In-Reply-To header matching).
-- ---------------------------------------------------------------------------
ALTER TABLE campaign_emails ADD COLUMN IF NOT EXISTS resend_message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_campaign_emails_resend_message_id
  ON campaign_emails (resend_message_id)
  WHERE resend_message_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. RPC for Webhook (Replies) — mirrors increment_email_opens/clicks
--    Called by inbound webhook when a reply is detected via 3-layer defense.
--    Atomically increments replies count and recalculates reply_rate.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_email_replies(p_campaign_email_id uuid)
RETURNS void AS $$
DECLARE
  v_campaign_analytics_id uuid;
  v_total_sent integer;
  v_total_replies integer;
BEGIN
  UPDATE email_analytics
  SET replies = replies + 1, engagement_status = 'replied'
  WHERE campaign_email_id = p_campaign_email_id
  RETURNING campaign_analytics_id INTO v_campaign_analytics_id;

  IF v_campaign_analytics_id IS NOT NULL THEN
    SELECT emails_sent INTO v_total_sent
    FROM campaign_analytics
    WHERE id = v_campaign_analytics_id;

    IF COALESCE(v_total_sent, 0) > 0 THEN
      SELECT sum(replies) INTO v_total_replies
      FROM email_analytics
      WHERE campaign_analytics_id = v_campaign_analytics_id;

      UPDATE campaign_analytics
      SET reply_rate = ROUND(
        LEAST((v_total_replies::numeric / v_total_sent::numeric) * 100, 100.0), 2
      )
      WHERE id = v_campaign_analytics_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;
