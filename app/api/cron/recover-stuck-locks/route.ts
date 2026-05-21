import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// ---------------------------------------------------------------------------
// recover-stuck-locks — runs every 30 min via Vercel Cron
//
// The main dispatcher locks rows by transitioning status='scheduled' →
// 'processing' before calling Resend. If the dispatcher crashes mid-send
// (timeout, OOM, etc.), the row stays in 'processing' forever and is never
// retried. This cron reverts any row stuck in 'processing' for more than
// STUCK_THRESHOLD_MINUTES back to 'scheduled' so the next dispatcher tick
// picks it up.
// ---------------------------------------------------------------------------

const STUCK_THRESHOLD_MINUTES = 10

const stripQ = (v: string) => v.replace(/^(['"])(.*)\1$/, "$2").trim()

function buildSupabase() {
  const url = stripQ(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  const key = stripQ(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
  if (!url || !key) throw new Error("Missing SUPABASE env vars")
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  // Same CRON_SECRET pattern as the dispatcher.
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const sb = buildSupabase()
    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60_000).toISOString()

    const { data, error } = await sb
      .from("campaign_emails")
      .update({ status: "scheduled" })
      .eq("status", "processing")
      .lt("updated_at", cutoff)
      .select("id")

    if (error) {
      console.error("[recover-stuck-locks] error:", error)
      return NextResponse.json({ error: "internal" }, { status: 500 })
    }

    const recovered = data?.length ?? 0
    if (recovered > 0) {
      console.warn(`[recover-stuck-locks] reverted ${recovered} stuck emails`)
    }
    return NextResponse.json({ recovered })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[recover-stuck-locks] fatal:", msg)
    return NextResponse.json({ error: "internal" }, { status: 500 })
  }
}
