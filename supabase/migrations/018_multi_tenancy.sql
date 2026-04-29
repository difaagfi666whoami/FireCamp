-- =============================================================================
-- Migration 018 — Multi-tenancy hardening
--
-- Adds user_id to all data tables, backfills existing rows to the seed user
-- (difaagfi1998@gmail.com), and replaces dev-only RLS policies with production
-- policies that scope every row to its owner via auth.uid().
--
-- Also creates the user_profiles table (was in local 017_add_user_profiles.sql
-- but never applied to the remote DB) and updates auto-analytics triggers to
-- propagate user_id from parent (campaigns / campaign_emails) to child rows.
-- =============================================================================

-- ── Prereq: user_profiles table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name    TEXT NOT NULL DEFAULT '',
  sender_title   TEXT NOT NULL DEFAULT '',
  signature      TEXT NOT NULL DEFAULT '',
  workspace_name TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles;
CREATE POLICY "Users can manage own profile"
  ON user_profiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 1. Add user_id column (nullable for now) ─────────────────────────────────

ALTER TABLE companies          ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE contacts           ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE pain_points        ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE news               ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE intent_signals     ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE products           ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE campaigns          ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE campaign_emails    ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE matching_results   ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE email_analytics    ADD COLUMN IF NOT EXISTS user_id UUID;

-- ── 2. Backfill existing data → assign to seed user ──────────────────────────

DO $$
DECLARE
  owner_id UUID;
BEGIN
  SELECT id INTO owner_id
    FROM auth.users
   WHERE email = 'difaagfi1998@gmail.com'
   LIMIT 1;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Seed user difaagfi1998@gmail.com not found in auth.users';
  END IF;

  UPDATE companies          SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE contacts           SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE pain_points        SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE news               SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE intent_signals     SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE products           SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE campaigns          SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE campaign_emails    SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE matching_results   SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE campaign_analytics SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE email_analytics    SET user_id = owner_id WHERE user_id IS NULL;
END $$;

-- ── 3. Set NOT NULL + foreign keys ───────────────────────────────────────────

ALTER TABLE companies          ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE contacts           ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE pain_points        ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE news               ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE intent_signals     ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE products           ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE campaigns          ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE campaign_emails    ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE matching_results   ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE campaign_analytics ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE email_analytics    ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_user_id_fkey') THEN
    ALTER TABLE companies          ADD CONSTRAINT companies_user_id_fkey          FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_user_id_fkey') THEN
    ALTER TABLE contacts           ADD CONSTRAINT contacts_user_id_fkey           FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pain_points_user_id_fkey') THEN
    ALTER TABLE pain_points        ADD CONSTRAINT pain_points_user_id_fkey        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_user_id_fkey') THEN
    ALTER TABLE news               ADD CONSTRAINT news_user_id_fkey               FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'intent_signals_user_id_fkey') THEN
    ALTER TABLE intent_signals     ADD CONSTRAINT intent_signals_user_id_fkey     FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_user_id_fkey') THEN
    ALTER TABLE products           ADD CONSTRAINT products_user_id_fkey           FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_user_id_fkey') THEN
    ALTER TABLE campaigns          ADD CONSTRAINT campaigns_user_id_fkey          FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_emails_user_id_fkey') THEN
    ALTER TABLE campaign_emails    ADD CONSTRAINT campaign_emails_user_id_fkey    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matching_results_user_id_fkey') THEN
    ALTER TABLE matching_results   ADD CONSTRAINT matching_results_user_id_fkey   FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_analytics_user_id_fkey') THEN
    ALTER TABLE campaign_analytics ADD CONSTRAINT campaign_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_analytics_user_id_fkey') THEN
    ALTER TABLE email_analytics    ADD CONSTRAINT email_analytics_user_id_fkey    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 4. Indexes (RLS performance) ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS companies_user_id_idx          ON companies(user_id);
CREATE INDEX IF NOT EXISTS contacts_user_id_idx           ON contacts(user_id);
CREATE INDEX IF NOT EXISTS pain_points_user_id_idx        ON pain_points(user_id);
CREATE INDEX IF NOT EXISTS news_user_id_idx               ON news(user_id);
CREATE INDEX IF NOT EXISTS intent_signals_user_id_idx     ON intent_signals(user_id);
CREATE INDEX IF NOT EXISTS products_user_id_idx           ON products(user_id);
CREATE INDEX IF NOT EXISTS campaigns_user_id_idx          ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS campaign_emails_user_id_idx    ON campaign_emails(user_id);
CREATE INDEX IF NOT EXISTS matching_results_user_id_idx   ON matching_results(user_id);
CREATE INDEX IF NOT EXISTS campaign_analytics_user_id_idx ON campaign_analytics(user_id);
CREATE INDEX IF NOT EXISTS email_analytics_user_id_idx    ON email_analytics(user_id);

-- ── 5. Drop legacy dev / open-access policies ────────────────────────────────

DROP POLICY IF EXISTS "dev_anon_all"            ON companies;
DROP POLICY IF EXISTS "dev_anon_all"            ON contacts;
DROP POLICY IF EXISTS "dev_anon_all"            ON pain_points;
DROP POLICY IF EXISTS "dev_anon_all"            ON news;
DROP POLICY IF EXISTS "dev_anon_all"            ON products;
DROP POLICY IF EXISTS "dev_anon_all"            ON campaigns;
DROP POLICY IF EXISTS "dev_anon_all"            ON campaign_emails;
DROP POLICY IF EXISTS "dev_anon_all"            ON matching_results;
DROP POLICY IF EXISTS "dev_anon_all"            ON campaign_analytics;
DROP POLICY IF EXISTS "dev_anon_all"            ON email_analytics;
DROP POLICY IF EXISTS "anon_read_companies"     ON companies;
DROP POLICY IF EXISTS "anon_read_contacts"      ON contacts;
DROP POLICY IF EXISTS "anon_read_pain_points"   ON pain_points;
DROP POLICY IF EXISTS "anon_read_news"          ON news;
DROP POLICY IF EXISTS "allow_all_intent_signals" ON intent_signals;

-- ── 6. Enable RLS where it's currently off ───────────────────────────────────

ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_emails    ENABLE ROW LEVEL SECURITY;
ALTER TABLE matching_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_analytics    ENABLE ROW LEVEL SECURITY;

-- ── 7. Production policies (auth.uid() = user_id) ────────────────────────────

DROP POLICY IF EXISTS "user_owns_row" ON companies;
DROP POLICY IF EXISTS "user_owns_row" ON contacts;
DROP POLICY IF EXISTS "user_owns_row" ON pain_points;
DROP POLICY IF EXISTS "user_owns_row" ON news;
DROP POLICY IF EXISTS "user_owns_row" ON intent_signals;
DROP POLICY IF EXISTS "user_owns_row" ON products;
DROP POLICY IF EXISTS "user_owns_row" ON campaigns;
DROP POLICY IF EXISTS "user_owns_row" ON campaign_emails;
DROP POLICY IF EXISTS "user_owns_row" ON matching_results;
DROP POLICY IF EXISTS "user_owns_row" ON campaign_analytics;
DROP POLICY IF EXISTS "user_owns_row" ON email_analytics;

CREATE POLICY "user_owns_row" ON companies          FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_owns_row" ON contacts           FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_owns_row" ON pain_points        FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_owns_row" ON news               FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_owns_row" ON intent_signals     FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_owns_row" ON products           FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_owns_row" ON campaigns          FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_owns_row" ON campaign_emails    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_owns_row" ON matching_results   FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_owns_row" ON campaign_analytics FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_owns_row" ON email_analytics    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 8. Update auto-analytics triggers to propagate user_id ───────────────────

CREATE OR REPLACE FUNCTION public.fn_auto_create_campaign_analytics()
  RETURNS trigger
  LANGUAGE plpgsql
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
