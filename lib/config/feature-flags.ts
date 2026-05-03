// Phase 5 — Early Access feature flags.
//
// All flags use the NEXT_PUBLIC_ prefix because they gate client-rendered UI;
// Next.js does not inline non-prefixed env vars into the client bundle. None
// of these values are secrets, so public exposure is safe.
//
// Server-only knobs that *do* need to stay private (ADMIN_SECRET_KEY,
// ADMIN_EMAILS) are intentionally NOT in this module — they are read directly
// inside server-only routes.

export const flags = {
  BILLING_ACTIVE: process.env.NEXT_PUBLIC_BILLING_ACTIVE === "true",
  EARLY_ACCESS_MODE: process.env.NEXT_PUBLIC_EARLY_ACCESS_MODE === "true",
  FREE_CREDITS_ON_SIGNUP: parseInt(
    process.env.NEXT_PUBLIC_FREE_CREDITS_ON_SIGNUP || "0",
    10,
  ),
  INVITE_ONLY: process.env.NEXT_PUBLIC_INVITE_ONLY === "true",
  FEEDBACK_WIDGET_ENABLED:
    process.env.NEXT_PUBLIC_FEEDBACK_WIDGET_ENABLED !== "false",
} as const
