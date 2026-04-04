-- =============================================================================
-- Campfire — RLS Dev Policies untuk tabel Recon
-- Jalankan di SQL Editor Supabase SETELAH 001_initial_schema.sql
-- =============================================================================

CREATE POLICY "dev_anon_all" ON companies
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_all" ON contacts
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_all" ON pain_points
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_all" ON news
  FOR ALL TO anon USING (true) WITH CHECK (true);
