-- =============================================================================
-- Migration 027 — Fix Analytics Triggers Multi-tenancy
-- Add SECURITY DEFINER to analytics triggers so they bypass RLS when automatically
-- inserting rows, and explicitly set search_path for security.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_auto_create_campaign_analytics()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO campaign_analytics (campaign_id, user_id)
  VALUES (NEW.id, NEW.user_id)
  ON CONFLICT (campaign_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_auto_create_email_analytics()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_analytics_id uuid;
BEGIN
  SELECT ca.id INTO v_analytics_id
    FROM campaign_analytics ca
   WHERE ca.campaign_id = NEW.campaign_id;

  IF v_analytics_id IS NULL THEN
    INSERT INTO campaign_analytics (campaign_id, user_id)
    VALUES (NEW.campaign_id, NEW.user_id)
    ON CONFLICT (campaign_id) DO NOTHING
    RETURNING id INTO v_analytics_id;

    IF v_analytics_id IS NULL THEN
      SELECT ca.id INTO v_analytics_id
        FROM campaign_analytics ca
       WHERE ca.campaign_id = NEW.campaign_id;
    END IF;
  END IF;

  IF v_analytics_id IS NOT NULL THEN
    INSERT INTO email_analytics (
      campaign_analytics_id,
      campaign_email_id,
      email_number,
      user_id
    )
    VALUES (
      v_analytics_id,
      NEW.id,
      NEW.sequence_number,
      NEW.user_id
    )
    ON CONFLICT (campaign_analytics_id, campaign_email_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
