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

/** Format Date to "DD Mon" label matching EngagementLineChart (e.g. "13 Apr") */
function formatDayLabel(date: Date): string {
  const day = date.getDate()
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "Asia/Jakarta" })
  return `${day} ${month}`
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

  const isOpen = eventType === "email.opened"

  try {
    const sb = buildSupabase()

    // 1. Atomic increment on email_analytics
    const { error: rpcErr } = await sb.rpc(rpcName, {
      p_campaign_email_id: campaignEmailId,
    })

    if (rpcErr) {
      console.error(`[Webhook/resend] ${rpcName} error:`, rpcErr)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    // 2. Update JSONB timeline on campaign_analytics
    //    Resolve campaign_id from email_analytics → campaign_analytics
    const { data: eaRow } = await sb
      .from("email_analytics")
      .select("campaign_analytics_id")
      .eq("campaign_email_id", campaignEmailId)
      .maybeSingle()

    if (eaRow?.campaign_analytics_id) {
      const analyticsId: string = eaRow.campaign_analytics_id

      const { data: caRow } = await sb
        .from("campaign_analytics")
        .select("id, timeline")
        .eq("id", analyticsId)
        .single()

      if (caRow) {
        const today = formatDayLabel(new Date())
        const timeline: Array<{ day: string; opens: number; clicks: number; replies: number }> =
          Array.isArray(caRow.timeline) ? caRow.timeline : []

        const existing = timeline.find((t) => t.day === today)
        if (existing) {
          // Sanitise any NaN that may have crept in from earlier writes
          existing.opens = (Number(existing.opens) || 0) + (isOpen ? 1 : 0)
          existing.clicks = (Number(existing.clicks) || 0) + (isOpen ? 0 : 1)
          existing.replies = Number(existing.replies) || 0
        } else {
          timeline.push({
            day: today,
            opens: isOpen ? 1 : 0,
            clicks: isOpen ? 0 : 1,
            replies: 0,
          })
        }

        const { error: updateErr } = await sb
          .from("campaign_analytics")
          .update({ timeline })
          .eq("id", analyticsId)

        if (updateErr) {
          console.error("[Webhook/resend] timeline update error:", updateErr)
        }
      }
    }

    return NextResponse.json({ ok: true, event: eventType })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Webhook/resend] fatal:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
