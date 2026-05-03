-- =============================================================================
-- Migration 026 — Phase 5: Early Access welcome-modal flag
--
-- Adds a per-user flag that marks whether the Early Access welcome modal has
-- been seen. This is independent of `onboarding_completed` (which gates the
-- existing business-identity flow) — both flags must be true before the user
-- has fully passed through the Phase 5 onboarding sequence.
-- =============================================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS early_access_seen BOOLEAN NOT NULL DEFAULT FALSE;
