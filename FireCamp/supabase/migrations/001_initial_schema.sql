-- =============================================================================
-- Campfire — Initial Schema Migration
-- Supabase / PostgreSQL
-- =============================================================================
-- Copy-paste seluruh file ini ke SQL Editor di dashboard Supabase Anda,
-- lalu klik "Run". Eksekusi aman untuk dijalankan berulang (idempotent).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------

CREATE TYPE pain_category AS ENUM ('Marketing', 'Operations', 'Technology', 'Growth');
CREATE TYPE pain_severity  AS ENUM ('high', 'medium', 'low');
CREATE TYPE product_source AS ENUM ('manual', 'pdf');
CREATE TYPE campaign_status      AS ENUM ('draft', 'active', 'completed', 'paused');
CREATE TYPE automation_mode      AS ENUM ('ai', 'manual');
CREATE TYPE email_status         AS ENUM ('draft', 'scheduled', 'sent', 'failed');
CREATE TYPE email_engagement_status AS ENUM ('sent', 'opened', 'clicked', 'replied', 'bounced');


-- -----------------------------------------------------------------------------
-- HELPER: auto-update updated_at
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- 1. COMPANIES
--    Sumber: CompanyProfile (types/recon.types.ts)
-- =============================================================================

CREATE TABLE IF NOT EXISTS companies (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identitas
  url              TEXT        NOT NULL,
  name             TEXT        NOT NULL,
  industry         TEXT        NOT NULL,
  size             TEXT,                          -- "250–500 karyawan"
  founded          TEXT,                          -- "2015" (tahun sebagai text)
  hq               TEXT,
  description      TEXT,

  -- LinkedIn stats (string karena format "12.4K", "+23% YoY")
  linkedin_followers  TEXT,
  linkedin_employees  INTEGER,
  linkedin_growth     TEXT,

  -- Progress pipeline (boolean per stage)
  progress_recon   BOOLEAN     NOT NULL DEFAULT FALSE,
  progress_match   BOOLEAN     NOT NULL DEFAULT FALSE,
  progress_craft   BOOLEAN     NOT NULL DEFAULT FALSE,
  progress_polish  BOOLEAN     NOT NULL DEFAULT FALSE,
  progress_launch  BOOLEAN     NOT NULL DEFAULT FALSE,
  progress_pulse   BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Metadata
  cached_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Index untuk pencarian nama / industri
CREATE INDEX IF NOT EXISTS idx_companies_name     ON companies (name);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies (industry);


-- =============================================================================
-- 2. CONTACTS (PIC)
--    Sumber: PicContact (types/recon.types.ts)
--    Relasi: many-to-one → companies
-- =============================================================================

CREATE TABLE IF NOT EXISTS contacts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies (id) ON DELETE CASCADE,

  name            TEXT        NOT NULL,
  title           TEXT,
  email           TEXT,
  phone           TEXT,
  linkedin_url    TEXT,

  prospect_score  SMALLINT    CHECK (prospect_score BETWEEN 0 AND 100),
  reasoning       TEXT,                           -- "Mengapa kontak ini relevan"

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts (company_id);


-- =============================================================================
-- 3. PAIN POINTS
--    Sumber: PainPoint (types/recon.types.ts)
--    Relasi: many-to-one → companies
-- =============================================================================

CREATE TABLE IF NOT EXISTS pain_points (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID          NOT NULL REFERENCES companies (id) ON DELETE CASCADE,

  category    pain_category NOT NULL,
  issue       TEXT          NOT NULL,
  severity    pain_severity NOT NULL DEFAULT 'medium',

  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_pain_points_updated_at
  BEFORE UPDATE ON pain_points
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_pain_points_company_id ON pain_points (company_id);
CREATE INDEX IF NOT EXISTS idx_pain_points_severity   ON pain_points (severity);


-- =============================================================================
-- 4. NEWS
--    Sumber: NewsItem (types/recon.types.ts)
--    Relasi: many-to-one → companies
-- =============================================================================

CREATE TABLE IF NOT EXISTS news (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies (id) ON DELETE CASCADE,

  title       TEXT        NOT NULL,
  published_date TEXT,                            -- "15 Feb 2026" (format bebas dari sumber)
  source      TEXT,
  summary     TEXT,
  url         TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_news_updated_at
  BEFORE UPDATE ON news
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_news_company_id ON news (company_id);


-- =============================================================================
-- 5. PRODUCTS (Katalog Layanan)
--    Sumber: ProductCatalogItem (types/match.types.ts)
-- =============================================================================

CREATE TABLE IF NOT EXISTS products (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),

  name            TEXT           NOT NULL,
  tagline         TEXT,
  description     TEXT,
  price           TEXT,                          -- "Rp 8.500.000 / bulan"
  pain_categories pain_category[] NOT NULL DEFAULT '{}',
  usp             TEXT[]          NOT NULL DEFAULT '{}',
  source          product_source  NOT NULL DEFAULT 'manual',

  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);


-- =============================================================================
-- 6. CAMPAIGNS
--    Sumber: mockdata.campaign (orchestrator seluruh pipeline)
--    Relasi: many-to-one → companies, many-to-one → products (produk terpilih)
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID             NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  selected_product_id UUID          REFERENCES products (id) ON DELETE SET NULL,

  reasoning        TEXT,                          -- AI reasoning untuk sequence ini
  status           campaign_status  NOT NULL DEFAULT 'draft',
  automation_mode  automation_mode  NOT NULL DEFAULT 'ai',

  activated_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_campaigns_company_id ON campaigns (company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status     ON campaigns (status);


-- =============================================================================
-- 7. CAMPAIGN EMAILS
--    Sumber: CampaignEmail (types/craft.types.ts) + schedule (mockdata)
--    Relasi: many-to-one → campaigns
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaign_emails (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID         NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,

  sequence_number SMALLINT     NOT NULL CHECK (sequence_number > 0),
  day_label       TEXT,                          -- "Hari ke-1"
  scheduled_day   SMALLINT,                      -- offset hari dari start campaign

  subject         TEXT         NOT NULL,
  body            TEXT         NOT NULL,
  tone            TEXT         NOT NULL DEFAULT 'profesional',
  is_approved     BOOLEAN      NOT NULL DEFAULT FALSE,

  -- Jadwal pengiriman (diisi saat Launch)
  scheduled_date  DATE,
  scheduled_time  TIME,
  status          email_status NOT NULL DEFAULT 'draft',
  sent_at         TIMESTAMPTZ,

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (campaign_id, sequence_number)          -- tidak boleh ada dua email urutan sama di satu campaign
);

CREATE TRIGGER set_campaign_emails_updated_at
  BEFORE UPDATE ON campaign_emails
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_campaign_emails_campaign_id ON campaign_emails (campaign_id);


-- =============================================================================
-- 8. MATCHING RESULTS
--    Sumber: mockdata.matchingResults
--    Relasi: many-to-one → campaigns, many-to-one → products
-- =============================================================================

CREATE TABLE IF NOT EXISTS matching_results (
  id                    UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID      NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
  product_id            UUID      NOT NULL REFERENCES products (id) ON DELETE CASCADE,

  match_score           SMALLINT  NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  addressed_pain_indices INTEGER[] NOT NULL DEFAULT '{}',  -- index ke pain_points array
  reasoning             TEXT,
  is_recommended        BOOLEAN   NOT NULL DEFAULT FALSE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (campaign_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_matching_results_campaign_id ON matching_results (campaign_id);


-- =============================================================================
-- 9. CAMPAIGN ANALYTICS
--    Sumber: mockdata.analytics.summary + tokenUsage
--    Relasi: one-to-one → campaigns
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaign_analytics (
  id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID      NOT NULL UNIQUE REFERENCES campaigns (id) ON DELETE CASCADE,

  -- Summary metrics (%)
  emails_sent     INTEGER   NOT NULL DEFAULT 0,
  open_rate       NUMERIC(5,2),                  -- contoh: 66.70
  click_rate      NUMERIC(5,2),
  reply_rate      NUMERIC(5,2),

  -- Industry benchmarks (disimpan snapshot saat campaign, bukan global)
  benchmark_open_rate  NUMERIC(5,2),
  benchmark_click_rate NUMERIC(5,2),
  benchmark_reply_rate NUMERIC(5,2),

  -- Token usage per tahap
  token_recon     INTEGER   DEFAULT 0,
  token_match     INTEGER   DEFAULT 0,
  token_craft     INTEGER   DEFAULT 0,
  token_total     INTEGER   GENERATED ALWAYS AS (
                    COALESCE(token_recon, 0) + COALESCE(token_match, 0) + COALESCE(token_craft, 0)
                  ) STORED,
  estimated_cost_idr INTEGER DEFAULT 0,          -- dalam Rupiah

  -- Timeline harian (JSONB: [{day, opens, clicks}])
  timeline        JSONB     NOT NULL DEFAULT '[]',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_campaign_analytics_updated_at
  BEFORE UPDATE ON campaign_analytics
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- =============================================================================
-- 10. EMAIL ANALYTICS
--     Sumber: mockdata.analytics.perEmail
--     Relasi: many-to-one → campaign_analytics, many-to-one → campaign_emails
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_analytics (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_analytics_id UUID       NOT NULL REFERENCES campaign_analytics (id) ON DELETE CASCADE,
  campaign_email_id    UUID        NOT NULL REFERENCES campaign_emails (id) ON DELETE CASCADE,

  email_number         SMALLINT    NOT NULL,
  opens                INTEGER     NOT NULL DEFAULT 0,
  clicks               INTEGER     NOT NULL DEFAULT 0,
  replies              INTEGER     NOT NULL DEFAULT 0,
  engagement_status    email_engagement_status NOT NULL DEFAULT 'sent',

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (campaign_analytics_id, campaign_email_id)
);

CREATE TRIGGER set_email_analytics_updated_at
  BEFORE UPDATE ON email_analytics
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_email_analytics_campaign_analytics_id
  ON email_analytics (campaign_analytics_id);


-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Aktifkan di setiap tabel. Konfigurasi policy sesuai auth strategy Anda
-- (service role key bypass RLS secara otomatis dari backend).
-- =============================================================================

ALTER TABLE companies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pain_points        ENABLE ROW LEVEL SECURITY;
ALTER TABLE news               ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_emails    ENABLE ROW LEVEL SECURITY;
ALTER TABLE matching_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_analytics    ENABLE ROW LEVEL SECURITY;

-- Contoh policy (uncomment dan sesuaikan setelah setup auth):
-- CREATE POLICY "Authenticated users can read companies"
--   ON companies FOR SELECT
--   TO authenticated
--   USING (true);


-- =============================================================================
-- SELESAI
-- Tabel yang dibuat:
--   companies, contacts, pain_points, news,
--   products, campaigns, campaign_emails,
--   matching_results, campaign_analytics, email_analytics
-- =============================================================================
