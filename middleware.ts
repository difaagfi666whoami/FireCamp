import { NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { flags } from "@/lib/config/feature-flags"

const PROTECTED_PREFIXES = [
  "/research-library",
  "/recon",
  "/match",
  "/craft",
  "/polish",
  "/launch",
  "/pulse",
  "/settings",
  "/pricing",
  "/billing",
  "/auth/redeem-invite",
  "/admin",
]

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

// Paths that require auth but are exempt from the Phase 5 invite gate —
// we don't want to redirect users *away* from the redemption page itself,
// and admin routes have their own gate (requireAdmin) so they shouldn't be
// blocked just because the admin doesn't have an invite redemption row.
function isInviteGateExempt(pathname: string): boolean {
  return pathname === "/auth/redeem-invite" || pathname.startsWith("/admin")
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS === "true") {
    return NextResponse.next()
  }

  // updateSession keeps the Supabase session alive by refreshing cookies
  const { supabase, user, response } = await updateSession(request)

  if (!isProtectedPath(pathname)) {
    return response
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Phase 5: invite gate. If INVITE_ONLY is on, every protected path except
  // the redemption page and /admin/* requires a row in invite_codes for this user.
  if (flags.INVITE_ONLY && !isInviteGateExempt(pathname)) {
    const { data: redemption } = await supabase
      .from("invite_codes")
      .select("id")
      .eq("used_by", user.id)
      .limit(1)
      .maybeSingle()
    if (!redemption) {
      return NextResponse.redirect(new URL("/auth/redeem-invite", request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
}
