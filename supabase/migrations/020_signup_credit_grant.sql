-- =============================================================================
-- Migration 020 — Auto-grant 5 free credits on signup
--
-- Without this, new users hit HTTP 402 on their first Recon because
-- user_credits has no row yet (debit_credits returns false on missing row).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_grant_signup_credits()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_credits WHERE user_id = NEW.id) THEN
    PERFORM credit_credits(
      NEW.id,
      5,
      'grant'::credit_tx_type,
      'Free trial: 5 credits to test the pipeline',
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_signup_credits ON auth.users;
CREATE TRIGGER trg_grant_signup_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_grant_signup_credits();
