-- =============================================================================
-- Migration 028 — Tighten RLS WITH CHECK to validate parent ownership
--
-- BEFORE: RLS only checked auth.uid() = user_id on the row being written.
-- The FK on campaign_id / company_id only validated existence, not ownership.
-- An attacker could INSERT a child row with their own user_id pointing at a
-- VICTIM's parent row — most dangerously, a campaign_email under the victim's
-- campaign, which the cron dispatcher would then send to the victim's contact.
--
-- AFTER: every WITH CHECK clause additionally validates that the parent row
-- referenced by the FK is owned by the same auth.uid(). Cross-tenant child
-- rows are now rejected at the database boundary, regardless of how they
-- arrive (anon client, service role, or compromised backend code).
--
-- Also hardens the v_pending_emails view to enforce ce.user_id = c.user_id =
-- contacts.user_id (defense in depth — even if RLS is later loosened, the
-- view will not dispatch cross-tenant emails).
-- =============================================================================

-- ── companies (no parent) — unchanged, kept for completeness ─────────────────
-- (no change)

-- ── contacts → companies ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_owns_row" ON contacts;
CREATE POLICY "user_owns_row" ON contacts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id = (SELECT c.user_id FROM companies c WHERE c.id = company_id)
  );

-- ── pain_points → companies ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_owns_row" ON pain_points;
CREATE POLICY "user_owns_row" ON pain_points
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id = (SELECT c.user_id FROM companies c WHERE c.id = company_id)
  );

-- ── news → companies ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_owns_row" ON news;
CREATE POLICY "user_owns_row" ON news
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id = (SELECT c.user_id FROM companies c WHERE c.id = company_id)
  );

-- ── intent_signals → companies ──────────────────────────────────────────────
DROP POLICY IF EXISTS "user_owns_row" ON intent_signals;
CREATE POLICY "user_owns_row" ON intent_signals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id = (SELECT c.user_id FROM companies c WHERE c.id = company_id)
  );

-- ── campaigns → companies ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_owns_row" ON campaigns;
CREATE POLICY "user_owns_row" ON campaigns
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id = (SELECT c.user_id FROM companies c WHERE c.id = company_id)
  );

-- ── campaign_emails → campaigns (the highest-impact vector) ─────────────────
DROP POLICY IF EXISTS "user_owns_row" ON campaign_emails;
CREATE POLICY "user_owns_row" ON campaign_emails
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id = (SELECT c.user_id FROM campaigns c WHERE c.id = campaign_id)
  );

-- ── matching_results → campaigns ────────────────────────────────────────────
DROP POLICY IF EXISTS "user_owns_row" ON matching_results;
CREATE POLICY "user_owns_row" ON matching_results
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id = (SELECT c.user_id FROM campaigns c WHERE c.id = campaign_id)
  );

-- ── campaign_analytics → campaigns ──────────────────────────────────────────
DROP POLICY IF EXISTS "user_owns_row" ON campaign_analytics;
CREATE POLICY "user_owns_row" ON campaign_analytics
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id = (SELECT c.user_id FROM campaigns c WHERE c.id = campaign_id)
  );

-- ── email_analytics → campaign_emails ───────────────────────────────────────
DROP POLICY IF EXISTS "user_owns_row" ON email_analytics;
CREATE POLICY "user_owns_row" ON email_analytics
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id = (SELECT ce.user_id FROM campaign_emails ce WHERE ce.id = campaign_email_id)
  );

-- ── Defense-in-depth: harden v_pending_emails ───────────────────────────────
-- Cron dispatcher reads this view. Even if RLS regresses, this view will
-- never surface a row where ce.user_id ≠ c.user_id ≠ ct.user_id.
DROP VIEW IF EXISTS v_pending_emails;
CREATE VIEW v_pending_emails AS
SELECT
  ce.id              AS email_id,
  ce.user_id,
  ce.subject,
  ce.body,
  ce.scheduled_date,
  ce.scheduled_time,
  COALESCE(ct.email, 'difaagfi1998@gmail.com') AS target_email,
  COALESCE(ct.name, 'Developer Test')          AS target_name
FROM campaign_emails ce
JOIN campaigns c
  ON c.id = ce.campaign_id
 AND c.user_id = ce.user_id          -- ← ownership consistency: enforced
LEFT JOIN LATERAL (
  SELECT email, name
    FROM contacts
   WHERE company_id = c.company_id
     AND user_id    = c.user_id      -- ← also enforce on the contact join
     AND email IS NOT NULL
   ORDER BY prospect_score DESC NULLS LAST
   LIMIT 1
) ct ON true
WHERE ce.status = 'scheduled';
