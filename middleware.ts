import { NextRequest, NextResponse } from "next/server"

// Force Node.js runtime to avoid Edge Runtime limitations with @supabase/supabase-js
export const runtime = "nodejs"

// Protected path prefixes — require a valid Supabase session
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
]

// Derive the cookie name from the Supabase project URL at module load time.
// Format: sb-<project-ref>-auth-token
// e.g. NEXT_PUBLIC_SUPABASE_URL = https://zvjfdvdjpwfmitxrrips.supabase.co
//   → cookie name = sb-zvjfdvdjpwfmitxrrips-auth-token
function getAuthCookieName(): string {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  // Strip surrounding quotes that may appear on Windows
  const url = rawUrl.replace(/^(['"])(.*)\1$/, "$2").trim()
  if (!url) return "sb-unknown-auth-token"
  try {
    const hostname = new URL(url).hostname // e.g. zvjfdvdjpwfmitxrrips.supabase.co
    const projectRef = hostname.split(".")[0]  // e.g. zvjfdvdjpwfmitxrrips
    return `sb-${projectRef}-auth-token`
  } catch {
    return "sb-unknown-auth-token"
  }
}

// Check whether the path should be protected
function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

// Parse and validate the session stored in the Supabase auth cookie.
// supabase-js v2 stores the session as a JSON-stringified object in localStorage
// (and the browser sends it as a cookie with the same stringified value).
// The object shape: { access_token, refresh_token, expires_at, expires_in, token_type, user }
function hasValidSession(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false

  try {
    // The cookie value may be URL-encoded
    const decoded = decodeURIComponent(cookieValue)
    const session = JSON.parse(decoded) as {
      access_token?: string
      expires_at?: number
    }

    if (!session.access_token) return false

    // If expires_at is present, verify the session has not expired.
    // expires_at is a Unix timestamp in seconds.
    if (session.expires_at) {
      const nowInSeconds = Math.floor(Date.now() / 1000)
      // Allow a 60-second leeway to account for clock skew
      if (nowInSeconds > session.expires_at + 60) return false
    }

    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Optional dev bypass — only when NEXT_PUBLIC_AUTH_DEV_BYPASS is explicitly set.
  // Default is OFF so multi-tenant RLS is enforced even in `npm run dev`.
  if (process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS === "true") {
    return NextResponse.next()
  }

  // Only run logic on protected paths — public routes pass through unconditionally
  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  // Look up the Supabase auth cookie
  const cookieName = getAuthCookieName()
  const authCookie = request.cookies.get(cookieName)

  if (hasValidSession(authCookie?.value)) {
    // Valid session — allow the request through
    return NextResponse.next()
  }

  // No valid session — redirect to /login, preserving the intended URL as a
  // `next` query param so the login page can redirect back after authentication
  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("next", pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - /api/*        (API routes handle their own auth)
     * - /_next/*      (internal Next.js paths)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
}
