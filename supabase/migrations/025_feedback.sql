-- =============================================================================
-- Migration 025 — Phase 5: Feedback widget storage
--
-- Captures Early Access user feedback with a self-classified sentiment so the
-- admin dashboard (Step 5) can break it down without an AI classifier.
--
-- RLS: authenticated users may INSERT their own row only. There is NO read
-- policy — feedback is read by the admin dashboard via the service role key.
-- =============================================================================

CREATE TABLE IF NOT EXISTS feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sentiment   TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  message     TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 4000),
  page_path   TEXT NOT NULL DEFAULT '',
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_user_id_idx    ON feedback(user_id);
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_sentiment_idx  ON feedback(sentiment);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_insert_own_feedback" ON feedback;
CREATE POLICY "users_insert_own_feedback"
  ON feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
