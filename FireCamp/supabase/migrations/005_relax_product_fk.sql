-- =============================================================================
-- Campfire — Relax product FK constraints untuk mock pipeline
-- Masalah: mock product IDs ("prod-001") bukan valid UUID,
--          menyebabkan INSERT campaigns/matching_results gagal.
-- Fix: buat product_id nullable + tambah product_name TEXT untuk referensi.
-- =============================================================================

-- matching_results: buat product_id nullable
ALTER TABLE matching_results ALTER COLUMN product_id DROP NOT NULL;

-- Drop UNIQUE (campaign_id, product_id) — tidak bisa dipakai kalau product_id null
-- Ganti dengan unique per campaign + product_name
ALTER TABLE matching_results DROP CONSTRAINT IF EXISTS matching_results_campaign_id_product_id_key;
ALTER TABLE matching_results ADD CONSTRAINT matching_results_campaign_product_name_key
  UNIQUE (campaign_id, product_name)
  DEFERRABLE INITIALLY DEFERRED;

-- matching_results: tambah product_name untuk referensi tanpa UUID
ALTER TABLE matching_results ADD COLUMN IF NOT EXISTS product_name TEXT;

-- campaigns: tambah selected_product_name untuk referensi tanpa UUID
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS selected_product_name TEXT;
