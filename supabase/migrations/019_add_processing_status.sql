-- =============================================================================
-- 019: Add 'processing' to email_status enum
--
-- This status is used by the Vercel Cron dispatcher to lock a row
-- (row-level locking) before sending the email via Resend, preventing
-- double-sends if multiple cron instances overlap.
-- =============================================================================

ALTER TYPE email_status ADD VALUE IF NOT EXISTS 'processing' AFTER 'scheduled';
