import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// ---------------------------------------------------------------------------
// Resend Webhook Receiver
// Handles email event callbacks from Resend (e.g. email.opened).
// Updates email_analytics in Supabase via atomic SQL increment (RPC).
//
// Required Supabase RPC:
//   CREATE OR REPLACE FUNCTION increment_email_opens(p_campaign_email_id uuid)
//   RETURNS void AS $$
//     UPDATE email_analytics SET opens = opens + 1
//     WHERE campaign_email_id = p_campaign_email_id;
//   $$ LANGUAGE sql;
//
//   CREATE OR REPLACE FUNCTION increment_email_clicks(p_campaign_email_id uuid)
//   RETURNS void AS $$
//     UPDATE email_analytics SET clicks = clicks + 1
//     WHERE campaign_email_id = p_campaign_email_id;
//   $$ LANGUAGE sql;
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

function buildSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing SUPABASE env vars for webhook handler")
  }
  return createClient(supabaseUrl, supabaseServiceKey)
}

/** Extract a tag value from Resend's tags array */
function getTagValue(
  tags: Array<{ name: string; value: string }> | undefined,
  name: string
): string | null {
  if (!tags) return null
  const tag = tags.find((t) => t.name === name)
  return tag?.value ?? null
}

interface ResendWebhookEvent {
  type: string
  data: {
    email_id?: string
    tags?: Array<{ name: string; value: string }>
  }
}

export async function POST(req: NextRequest) {
  // ----- Optional: verify Svix webhook signature -----
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (webhookSecret) {
    const svixId = req.headers.get("svix-id")
    const svixSignature = req.headers.get("svix-signature")
    if (!svixId || !svixSignature) {
      return NextResponse.json({ error: "Missing signature headers" }, { status: 401 })
    }
  }

  let event: ResendWebhookEvent
  try {
    event = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const eventType = event.type
  const campaignEmailId = getTagValue(event.data?.tags, "campaign_email_id")

  if (!campaignEmailId) {
    // Not a tracked campaign email — acknowledge silently
    return NextResponse.json({ ok: true, skipped: true })
  }

  // Map Resend event types → Supabase RPC function names
  const rpcMap: Record<string, string> = {
    "email.opened": "increment_email_opens",
    "email.clicked": "increment_email_clicks",
  }

  const rpcName = rpcMap[eventType]
  if (!rpcName) {
    // Event type we don't track yet — ack without processing
    return NextResponse.json({ ok: true, event: eventType, action: "ignored" })
  }

  try {
    const sb = buildSupabase()
    const { error } = await sb.rpc(rpcName, {
      p_campaign_email_id: campaignEmailId,
    })

    if (error) {
      console.error(`[Webhook/resend] ${rpcName} error:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, event: eventType })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Webhook/resend] fatal:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
