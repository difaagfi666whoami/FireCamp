import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

function stripQuotes(value: string): string {
  return value.replace(/^(['"])(.*)\1$/, "$2").trim()
}

function getCookieName(supabaseUrl: string): string {
  try {
    const hostname = new URL(supabaseUrl).hostname
    const projectRef = hostname.split(".")[0]
    return `sb-${projectRef}-auth-token`
  } catch {
    return "sb-unknown-auth-token"
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const url = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  const key = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "")

  if (!url || !key) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const supabase = createClient(url, key)
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    console.error("[Auth] exchangeCodeForSession gagal:", error?.message)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const session = data.session
  const response = NextResponse.redirect(`${origin}/research-library`)

  // Set session cookie so middleware can validate it on subsequent requests
  const cookieName = getCookieName(url)
  response.cookies.set(cookieName, JSON.stringify({
    access_token:  session.access_token,
    refresh_token: session.refresh_token,
    expires_at:    session.expires_at,
    expires_in:    session.expires_in,
    token_type:    session.token_type,
    user:          session.user,
  }), {
    httpOnly: false,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   session.expires_in,
    path:     "/",
  })

  return response
}
