import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"
import { flags } from "@/lib/config/feature-flags"
import { checkRateLimit } from "@/lib/rateLimit"

export async function POST(req: NextRequest) {
  let body: { code?: string } = {}
  try {
    body = await req.json()
  } catch {
    /* empty body OK — we'll reject below */
  }

  const code = String(body.code ?? "").trim().toUpperCase()
  if (!code) {
    return NextResponse.json({ success: false, error: "empty" }, { status: 400 })
  }

  const userClient = await createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ success: false, error: "unauthenticated" }, { status: 401 })
  }

  // Brute-force protection: a user can only try 10 codes per 10 minutes.
  const rl = checkRateLimit(`invite-redeem:${user.id}`, 10, 10 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "rate_limited", retry_after: rl.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    )
  }

  const stripQ = (v: string) => v.replace(/^(['"])(.*)\1$/, "$2").trim()
  const url = stripQ(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  const key = stripQ(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
  if (!url || !key) {
    return NextResponse.json({ success: false, error: "config" }, { status: 500 })
  }
  const admin = createServiceClient(url, key)

  const { data, error } = await admin.rpc("redeem_invite_code", {
    p_code: code,
    p_user_id: user.id,
    p_credits: flags.FREE_CREDITS_ON_SIGNUP,
  })

  if (error) {
    console.error("[invite-codes/redeem] rpc failed:", error)
    return NextResponse.json({ success: false, error: "internal" }, { status: 500 })
  }
  return NextResponse.json(data ?? { success: false, error: "unknown" })
}
