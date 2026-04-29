import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

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

function getTagValue(
  tags: Record<string, string> | undefined,
  name: string
): string | null {
  if (!tags) return null
  return tags[name] ?? null
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
    tags?: Record<string, string>
    bounce?: {
      type?: string
      message?: string
    }
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("[Webhook/resend] Missing RESEND_WEBHOOK_SECRET env var")
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  // Raw body preserves the exact bytes Svix signed — JSON.parse would rewrite
  // whitespace/ordering and break the HMAC.
  const payload = await req.text()

  const svixId = req.headers.get("svix-id")
  const svixTimestamp = req.headers.get("svix-timestamp")
  const svixSignature = req.headers.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 400 })
  }

  let event: ResendWebhookEvent
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret,
    }) as unknown as ResendWebhookEvent
  } catch (err) {
    console.error("[Webhook/resend] signature verification failed:", err)
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 })
  }

  const eventType = event.type
  const campaignEmailId = getTagValue(event.data?.tags, "campaign_email_id")

  if (!campaignEmailId) {
    // Not a tracked campaign email — acknowledge silently
    return NextResponse.json({ ok: true, skipped: true })
  }

  // --- Special handlers: bounced & complained ---
  if (eventType === "email.bounced") {
    try {
      const sb = buildSupabase()
      const bounceReason = event.data?.bounce?.message ?? null
      const { error } = await sb.rpc("handle_email_bounced", {
        p_campaign_email_id: campaignEmailId,
        p_bounce_reason: bounceReason,
      })
      if (error) {
        console.error("[Webhook/resend] handle_email_bounced error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      console.warn(`[Webhook/resend] BOUNCE detected for campaign_email_id: ${campaignEmailId}`)
      return NextResponse.json({ ok: true, event: eventType, action: "bounced" })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  if (eventType === "email.complained") {
    try {
      const sb = buildSupabase()
      const { error } = await sb.rpc("handle_email_complained", {
        p_campaign_email_id: campaignEmailId,
      })
      if (error) {
        console.error("[Webhook/resend] handle_email_complained error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      console.warn(`[Webhook/resend] SPAM COMPLAINT for campaign_email_id: ${campaignEmailId}`)
      return NextResponse.json({ ok: true, event: eventType, action: "complained" })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  if (eventType === "email.failed") {
    console.error(`[Webhook/resend] EMAIL FAILED for campaign_email_id: ${campaignEmailId}`, event.data)
    return NextResponse.json({ ok: true, event: eventType, action: "logged" })
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
