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
]

const ADMIN_UI_PREFIXES = ["/admin"]

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

// Paths that require auth but are exempt from the Phase 5 invite gate —
// we don't want to redirect users *away* from the redemption page itself.
function isInviteGateExempt(pathname: string): boolean {
  return pathname === "/auth/redeem-invite"
}

function isAdminUIPath(pathname: string): boolean {
  return ADMIN_UI_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS === "true") {
    return NextResponse.next()
  }

  // --- ADMIN UI BASIC AUTH ---
  // Independent from Supabase auth. Uses ADMIN_EMAILS as username and ADMIN_SECRET_KEY as password.
  if (isAdminUIPath(pathname)) {
    const authHeader = request.headers.get("authorization")
    const envSecret = process.env.ADMIN_SECRET_KEY
    const allowlist = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    let isAuthenticatedAdmin = false
    if (authHeader && envSecret) {
      const match = authHeader.match(/^Basic\s+(.*)$/)
      if (match) {
        try {
          const decoded = atob(match[1])
          const [user, ...passParts] = decoded.split(":")
          const pass = passParts.join(":")
          if (allowlist.includes(user.toLowerCase()) && pass === envSecret) {
            isAuthenticatedAdmin = true
          }
        } catch (e) {
          // ignore base64 errors
        }
      }
    }

    if (!isAuthenticatedAdmin) {
      return new NextResponse("Admin Authentication Required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Campfire Admin Panel"' },
      })
    }

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
