import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { flags } from "@/lib/config/feature-flags"

// Whitelist `next` to same-origin relative paths only. Rejects:
//   - protocol-relative URLs ("//evil.com")
//   - absolute URLs ("https://evil.com")
//   - empty / non-string values
function sanitizeNext(raw: string | null): string {
  if (!raw) return "/research-library"
  if (!raw.startsWith("/")) return "/research-library"
  if (raw.startsWith("//")) return "/research-library"
  if (raw.startsWith("/\\")) return "/research-library"
  return raw
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = sanitizeNext(searchParams.get("next"))

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=AuthFailed`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("[Auth] exchangeCodeForSession gagal:", error.message)
    return NextResponse.redirect(`${origin}/login?error=AuthFailed`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    // Phase 5: invite gate. If INVITE_ONLY is on and the user hasn't redeemed
    // any invite, send them to /auth/redeem-invite before anything else.
    if (flags.INVITE_ONLY) {
      const { data: redemption } = await supabase
        .from("invite_codes")
        .select("id")
        .eq("used_by", user.id)
        .limit(1)
        .maybeSingle()
      if (!redemption) {
        return NextResponse.redirect(`${origin}/auth/redeem-invite`)
      }
    }

    // Redirect new users straight to /onboarding — avoids shell flash
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!profile || !profile.onboarding_completed) {
      return NextResponse.redirect(`${origin}/onboarding`)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
