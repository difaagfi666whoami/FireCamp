import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/research-library"

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=AuthFailed`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("[Auth] exchangeCodeForSession gagal:", error.message)
    return NextResponse.redirect(`${origin}/login?error=AuthFailed`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
