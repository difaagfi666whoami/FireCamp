-- =============================================================================
-- Migration 024 — Phase 5: Early Access invite codes
--
-- 1. Drops the legacy auto-grant trigger from migration 020 so credits are
--    granted exclusively via redeem_invite_code(). FREE_CREDITS_ON_SIGNUP
--    (env var, read by the redemption API route) becomes the single source
--    of truth for the new-user grant amount.
-- 2. Creates invite_codes table + indexes + RLS policy (owner-can-read).
-- 3. Adds redeem_invite_code() SECURITY DEFINER RPC.
-- 4. Pre-redeems the seed user (difaagfi1998@gmail.com) with a synthetic
--    'CAMP-SEED' code so the invite gate doesn't lock them out, and tops
--    them up to 50 credits if their current balance is below that.
-- =============================================================================

-- ── 1. Drop legacy auto-grant trigger ────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_grant_signup_credits ON auth.users;
DROP FUNCTION IF EXISTS public.fn_grant_signup_credits();

-- ── 2. invite_codes table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(20) UNIQUE NOT NULL,
  created_by  TEXT NOT NULL,
  used_by     UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ NULL,
  max_uses    INT NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  use_count   INT NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at  TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invite_codes_used_by_idx ON invite_codes(used_by);
CREATE INDEX IF NOT EXISTS invite_codes_code_idx    ON invite_codes(code);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Users can only read invite_codes rows they have redeemed (so middleware can
-- verify redemption status under the user's session). All writes happen via
-- the SECURITY DEFINER redemption RPC or service-role admin endpoints.
DROP POLICY IF EXISTS "users_read_own_redemption" ON invite_codes;
CREATE POLICY "users_read_own_redemption"
  ON invite_codes
  FOR SELECT
  TO authenticated
  USING (used_by = auth.uid());

-- ── 3. redeem_invite_code() RPC ──────────────────────────────────────────────
-- Atomic. Validates the code, claims it for p_user_id, and grants p_credits
-- credits via the existing credit_credits() helper. Returns jsonb result.
--
-- When called via an authenticated client, auth.uid() must match p_user_id —
-- this prevents impersonation. When called via service_role (auth.uid() is
-- null), the caller is trusted to have validated user_id from the session.
CREATE OR REPLACE FUNCTION public.redeem_invite_code(
  p_code     TEXT,
  p_user_id  UUID,
  p_credits  INT
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_invite invite_codes%ROWTYPE;
  v_normalized TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'redeem_invite_code: caller does not own p_user_id';
  END IF;

  v_normalized := upper(btrim(p_code));

  -- Reject if user already redeemed any invite (one-per-user rule).
  IF EXISTS (SELECT 1 FROM invite_codes WHERE used_by = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_redeemed');
  END IF;

  -- Lock the row so concurrent redeems can't double-claim a max_uses=1 code.
  SELECT * INTO v_invite FROM invite_codes WHERE code = v_normalized FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid');
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  IF v_invite.use_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'exhausted');
  END IF;

  -- Claim. For multi-use codes, only the first redeemer is recorded as
  -- used_by; subsequent redeemers increment use_count but used_by stays.
  UPDATE invite_codes
     SET used_by   = COALESCE(used_by, p_user_id),
         used_at   = COALESCE(used_at, NOW()),
         use_count = use_count + 1
   WHERE id = v_invite.id;

  -- For multi-use codes the additional redeemers also need their own
  -- redemption record so the middleware gate recognises them.
  IF v_invite.used_by IS NOT NULL AND v_invite.used_by <> p_user_id THEN
    INSERT INTO invite_codes (code, created_by, used_by, used_at, max_uses, use_count, expires_at)
    VALUES (
      v_normalized || '-' || substr(p_user_id::text, 1, 8),
      'system:multi-use-redemption',
      p_user_id,
      NOW(),
      1,
      1,
      v_invite.expires_at
    );
  END IF;

  IF p_credits > 0 THEN
    PERFORM public.credit_credits(
      p_user_id,
      p_credits,
      'grant'::credit_tx_type,
      format('Early Access grant: %s credits via invite %s', p_credits, v_normalized),
      NULL
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'credits_granted', p_credits);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_invite_code(TEXT, UUID, INT)
  TO authenticated, service_role;

-- ── 4. Seed user bypass + top-up ─────────────────────────────────────────────
-- Insert a synthetic CAMP-SEED redemption row for difaagfi1998@gmail.com so
-- the invite gate lets them through. Then top up their balance to 50 credits
-- if currently below — non-destructive (never decrements an existing balance).
DO $$
DECLARE
  v_seed_id UUID;
  v_current INT;
BEGIN
  SELECT id INTO v_seed_id FROM auth.users WHERE email = 'difaagfi1998@gmail.com' LIMIT 1;
  IF v_seed_id IS NULL THEN
    RAISE NOTICE 'Seed user difaagfi1998@gmail.com not found — skipping seed bypass';
    RETURN;
  END IF;

  INSERT INTO invite_codes (code, created_by, used_by, used_at, max_uses, use_count)
  VALUES ('CAMP-SEED', 'system', v_seed_id, NOW(), 1, 1)
  ON CONFLICT (code) DO UPDATE
    SET used_by   = EXCLUDED.used_by,
        used_at   = EXCLUDED.used_at,
        use_count = 1;

  SELECT COALESCE(balance, 0) INTO v_current FROM user_credits WHERE user_id = v_seed_id;
  IF COALESCE(v_current, 0) < 50 THEN
    PERFORM public.credit_credits(
      v_seed_id,
      50 - COALESCE(v_current, 0),
      'grant'::credit_tx_type,
      'Early Access seed grant (FREE_CREDITS_ON_SIGNUP=50)',
      NULL
    );
  END IF;
END $$;
