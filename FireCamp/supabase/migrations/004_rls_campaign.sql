-- =============================================================================
-- Campfire — RLS Dev Policies untuk tabel Campaign pipeline
-- Jalankan di Supabase SQL Editor SETELAH 001_initial_schema.sql
-- =============================================================================

CREATE POLICY "dev_anon_all" ON campaigns
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_all" ON campaign_emails
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_all" ON matching_results
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_all" ON campaign_analytics
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_all" ON email_analytics
  FOR ALL TO anon USING (true) WITH CHECK (true);
