-- =============================================================================
-- 012: Bounce & Complaint RPC
--
-- Menangani email.bounced dan email.complained dari Resend Webhook.
-- Bounce: update status kampanye jadi 'bounced', catat alasan.
-- Complaint: update engagement_status jadi 'complained', flag untuk suppression.
--
-- Prasyarat: menambahkan nilai enum 'bounced' & 'complained' pada email_status
-- dan 'complained' pada email_engagement_status (keduanya belum ada di 001).
-- =============================================================================

-- -- Enum extensions ----------------------------------------------------------
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS aman diulang dan idempoten.
-- Postgres 12+ mengizinkan ini di dalam transaksi; nilai baru belum dapat
-- *dipakai* pada transaksi yang sama, tapi body plpgsql di-parse lazily
-- sehingga CREATE FUNCTION di bawah tetap aman.

ALTER TYPE email_status ADD VALUE IF NOT EXISTS 'bounced';
ALTER TYPE email_status ADD VALUE IF NOT EXISTS 'complained';
ALTER TYPE email_engagement_status ADD VALUE IF NOT EXISTS 'complained';

-- Fungsi untuk menangani bounce
CREATE OR REPLACE FUNCTION handle_email_bounced(
  p_campaign_email_id uuid,
  p_bounce_reason text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_campaign_analytics_id uuid;
BEGIN
  -- Update campaign_emails status menjadi 'bounced'
  UPDATE campaign_emails
  SET status = 'bounced', updated_at = now()
  WHERE id = p_campaign_email_id;

  -- Update email_analytics engagement_status
  UPDATE email_analytics
  SET engagement_status = 'bounced', updated_at = now()
  WHERE campaign_email_id = p_campaign_email_id
  RETURNING campaign_analytics_id INTO v_campaign_analytics_id;

  -- Kurangi emails_sent di campaign_analytics (email ini gagal terkirim)
  IF v_campaign_analytics_id IS NOT NULL THEN
    UPDATE campaign_analytics
    SET
      emails_sent = GREATEST(emails_sent - 1, 0),
      updated_at  = now()
    WHERE id = v_campaign_analytics_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Fungsi untuk menangani spam complaint
CREATE OR REPLACE FUNCTION handle_email_complained(p_campaign_email_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE email_analytics
  SET engagement_status = 'complained', updated_at = now()
  WHERE campaign_email_id = p_campaign_email_id;

  UPDATE campaign_emails
  SET status = 'complained', updated_at = now()
  WHERE id = p_campaign_email_id;
END;
$$ LANGUAGE plpgsql;
