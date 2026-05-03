import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const VALID_SENTIMENTS = new Set(["positive", "neutral", "negative"])

export async function POST(req: NextRequest) {
  let body: { sentiment?: string; message?: string; path?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const sentiment = VALID_SENTIMENTS.has(String(body.sentiment))
    ? (body.sentiment as string)
    : "neutral"
  const message = String(body.message ?? "").trim().slice(0, 4000)
  const pagePath = String(body.path ?? "").slice(0, 500)

  if (!message) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null

  // Insert through the user-scoped client so RLS verifies user_id = auth.uid().
  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    sentiment,
    message,
    page_path: pagePath,
    user_agent: userAgent,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
