import { NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

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

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS === "true") {
    return NextResponse.next()
  }

  // updateSession keeps the Supabase session alive by refreshing cookies
  const { user, response } = await updateSession(request)

  if (!isProtectedPath(pathname)) {
    return response
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
}
