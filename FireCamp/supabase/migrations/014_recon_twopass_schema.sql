-- Tambah kolom baru ke tabel companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS tech_stack          TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS situational_summary TEXT,
  ADD COLUMN IF NOT EXISTS anomalies           JSONB   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS citations           JSONB   DEFAULT '[]'::jsonb;

-- Tambah match_angle ke tabel pain_points
ALTER TABLE pain_points
  ADD COLUMN IF NOT EXISTS match_angle TEXT;

-- Buat tabel intent_signals (Lane D + E data)
CREATE TABLE IF NOT EXISTS intent_signals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  date            TEXT,
  source          TEXT,
  summary         TEXT,
  url             TEXT,
  signal_type     TEXT        NOT NULL,
  verified_amount TEXT,
  verified_date   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intent_signals_company_id
  ON intent_signals (company_id);

ALTER TABLE intent_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_intent_signals" ON intent_signals
  FOR ALL USING (true) WITH CHECK (true);
