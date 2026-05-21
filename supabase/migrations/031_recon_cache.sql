-- =============================================================================
-- Migration 031 — Recon result caching (7-day TTL)
--
-- Reduces external API cost. When a user re-runs Recon for the same
-- (normalized_url, mode) within 7 days, the backend returns the cached
-- CompanyProfile JSON without spending credits or hitting Tavily/Serper/
-- OpenAI again.
--
-- Cache is GLOBAL across users — the recon profile is a function of the
-- target URL only, not the requester. RLS is disabled because access is
-- service-role only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS recon_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash        TEXT NOT NULL,
  normalized_url  TEXT NOT NULL,
  mode            TEXT NOT NULL CHECK (mode IN ('free', 'pro')),
  profile_jsonb   JSONB NOT NULL,
  token_usage     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  hit_count       INTEGER NOT NULL DEFAULT 0,
  UNIQUE (url_hash, mode)
);

CREATE INDEX IF NOT EXISTS recon_cache_lookup_idx
  ON recon_cache (url_hash, mode, expires_at);

CREATE INDEX IF NOT EXISTS recon_cache_expires_idx
  ON recon_cache (expires_at);

CREATE OR REPLACE FUNCTION cleanup_expired_recon_cache() RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM recon_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

ALTER TABLE recon_cache DISABLE ROW LEVEL SECURITY;
