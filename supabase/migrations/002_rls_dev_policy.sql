-- =============================================================================
-- Campfire — RLS Policy untuk Development / Testing
--
-- Jalankan ini di SQL Editor Supabase SETELAH 001_initial_schema.sql
-- agar tabel products bisa diakses dari browser (anon key).
--
-- PENTING: Policy ini membuka akses penuh ke tabel products.
-- Untuk production, ganti dengan policy berbasis auth.user_id.
-- =============================================================================

-- Izinkan semua operasi dari browser (anon key) untuk testing CRUD
CREATE POLICY "dev_anon_all"
  ON products
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Untuk nanti (production), hapus policy di atas dan gunakan ini:
-- CREATE POLICY "authenticated_users_only"
--   ON products
--   FOR ALL
--   TO authenticated
--   USING (auth.uid() IS NOT NULL)
--   WITH CHECK (auth.uid() IS NOT NULL);
