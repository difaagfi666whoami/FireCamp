import { NextRequest, NextResponse } from "next/server"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { Resend } from "resend"

// ---------------------------------------------------------------------------
// Unified Resend Webhook Receiver
//
// Single Svix-signed endpoint subscribed (in the Resend dashboard) to all
// event types. Verification uses RESEND_INBOUND_WEBHOOK_SECRET. Dispatches:
//
//   email.opened      → increment_email_opens     + timeline JSONB (opens)
//   email.clicked     → increment_email_clicks    + timeline JSONB (clicks)
//   email.bounced     → handle_email_bounced RPC
//   email.complained  → handle_email_complained RPC
//   email.failed      → log only (no DB write)
//   email.received    → 3-layer reply attribution
//                        Layer 1: plus-address in To header
//                        Layer 2: In-Reply-To header trace
//                        Layer 3: sender → contact → active campaign fallback
//   everything else   → 200 OK {skipped:true}
// ---------------------------------------------------------------------------

const stripQ = (v: string) => v.replace(/^(['"])(.*)\1$/, "$2").trim()
const supabaseUrl = stripQ(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
const supabaseServiceKey = stripQ(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")

function buildSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing SUPABASE env vars for inbound webhook")
  }
  return createClient(supabaseUrl, supabaseServiceKey)
}

function getResendClient() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error("RESEND_API_KEY is not set")
  return new Resend(key)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InboundEmailPayload {
  from: string
  to: string | string[]
  subject?: string
  text?: string
  html?: string
  headers?: Array<{ name: string; value: string }>
}

interface EngagementEventData {
  email_id?: string
  tags?: Record<string, string>
  bounce?: {
    type?: string
    message?: string
  }
}

interface ResendWebhookEvent {
  type?: string
  // email.received delivers the inbound email under `data`
  // email.opened/clicked/bounced/etc deliver engagement metadata under `data`
  data?: InboundEmailPayload & EngagementEventData
  // Legacy Inbound-Routing flat shape (kept for backwards compat)
  from?: string
  to?: string | string[]
  headers?: Array<{ name: string; value: string }>
}

interface TimelineEntry {
  day: string
  opens: number
  clicks: number
  replies: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format Date to "DD Mon" label matching EngagementLineChart (e.g. "13 Apr") */
function formatDayLabel(date: Date): string {
  const day = date.getDate()
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "Asia/Jakarta" })
  return `${day} ${month}`
}

function getHeader(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string
): string | null {
  if (!headers) return null
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
  return header?.value ?? null
}

function getTagValue(
  tags: Record<string, string> | undefined,
  name: string
): string | null {
  if (!tags) return null
  return tags[name] ?? null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function extractPlusAddress(toField: string | string[]): string | null {
  const addresses = Array.isArray(toField) ? toField : [toField]
  for (const addr of addresses) {
    const emailMatch = addr.match(/<([^>]+)>/)
    const email = emailMatch ? emailMatch[1] : addr.trim()
    const plusMatch = email.match(/\+([^@]+)@/)
    if (plusMatch && UUID_RE.test(plusMatch[1])) {
      return plusMatch[1]
    }
  }
  return null
}

function extractSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1].toLowerCase() : from.trim().toLowerCase()
}

function extractMessageId(inReplyTo: string): string {
  return inReplyTo.replace(/^</, "").replace(/>$/, "").trim()
}

// ---------------------------------------------------------------------------
// Timeline JSONB updater (replies)
// ---------------------------------------------------------------------------

async function updateTimelineReplies(
  sb: SupabaseClient,
  campaignEmailId: string
): Promise<void> {
  const { data: eaRow } = await sb
    .from("email_analytics")
    .select("campaign_analytics_id")
    .eq("campaign_email_id", campaignEmailId)
    .maybeSingle()

  if (!eaRow?.campaign_analytics_id) return

  const analyticsId: string = eaRow.campaign_analytics_id

  const { data: caRow } = await sb
    .from("campaign_analytics")
    .select("id, timeline")
    .eq("id", analyticsId)
    .single()

  if (!caRow) return

  const today = formatDayLabel(new Date())
  const timeline: TimelineEntry[] = Array.isArray(caRow.timeline) ? caRow.timeline : []

  const existing = timeline.find((t) => t.day === today)
  if (existing) {
    existing.opens = Number(existing.opens) || 0
    existing.clicks = Number(existing.clicks) || 0
    existing.replies = (Number(existing.replies) || 0) + 1
  } else {
    timeline.push({ day: today, opens: 0, clicks: 0, replies: 1 })
  }

  const { error: updateErr } = await sb
    .from("campaign_analytics")
    .update({ timeline })
    .eq("id", analyticsId)

  if (updateErr) {
    console.error("[Webhook/inbound] reply timeline update error:", updateErr)
  }
}

// ---------------------------------------------------------------------------
// Timeline JSONB updater (opens / clicks)
// ---------------------------------------------------------------------------

async function updateTimelineEngagement(
  sb: SupabaseClient,
  campaignEmailId: string,
  isOpen: boolean
): Promise<void> {
  const { data: eaRow } = await sb
    .from("email_analytics")
    .select("campaign_analytics_id")
    .eq("campaign_email_id", campaignEmailId)
    .maybeSingle()

  if (!eaRow?.campaign_analytics_id) return

  const analyticsId: string = eaRow.campaign_analytics_id

  const { data: caRow } = await sb
    .from("campaign_analytics")
    .select("id, timeline")
    .eq("id", analyticsId)
    .single()

  if (!caRow) return

  const today = formatDayLabel(new Date())
  const timeline: TimelineEntry[] = Array.isArray(caRow.timeline) ? caRow.timeline : []

  const existing = timeline.find((t) => t.day === today)
  if (existing) {
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
    console.error("[Webhook/inbound] engagement timeline update error:", updateErr)
  }
}

// ---------------------------------------------------------------------------
// 3-Layer Defense: resolve campaign_email_id from inbound email
// ---------------------------------------------------------------------------

async function layer1PlusAddress(
  _sb: SupabaseClient,
  toField: string | string[]
): Promise<string | null> {
  const campaignEmailId = extractPlusAddress(toField)
  if (!campaignEmailId) return null
  console.log("[Webhook/inbound] Layer 1 HIT — plus-address:", campaignEmailId)
  return campaignEmailId
}

async function layer2HeaderTrace(
  sb: SupabaseClient,
  headers: Array<{ name: string; value: string }> | undefined
): Promise<string | null> {
  const inReplyTo = getHeader(headers, "In-Reply-To")
  if (!inReplyTo) return null
  const messageId = extractMessageId(inReplyTo)
  if (!messageId) return null
  const { data: row } = await sb
    .from("campaign_emails")
    .select("id")
    .eq("resend_message_id", messageId)
    .maybeSingle()
  if (row?.id) {
    console.log("[Webhook/inbound] Layer 2 HIT — In-Reply-To:", messageId)
    return row.id
  }
  return null
}

async function layer3DbFallback(
  sb: SupabaseClient,
  senderEmail: string
): Promise<string | null> {
  const { data: contact } = await sb
    .from("contacts")
    .select("company_id")
    .eq("email", senderEmail)
    .limit(1)
    .maybeSingle()
  if (!contact?.company_id) return null

  const { data: campaign } = await sb
    .from("campaigns")
    .select("id")
    .eq("company_id", contact.company_id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!campaign?.id) return null

  const { data: latestEmail } = await sb
    .from("campaign_emails")
    .select("id")
    .eq("campaign_id", campaign.id)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestEmail?.id) {
    console.log(
      "[Webhook/inbound] Layer 3 HIT — heuristic match for sender:",
      senderEmail,
      "→ campaign_email_id:",
      latestEmail.id
    )
    return latestEmail.id
  }
  return null
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleEngagementEvent(
  eventType: string,
  data: EngagementEventData
): Promise<NextResponse> {
  const campaignEmailId = getTagValue(data?.tags, "campaign_email_id")
  if (!campaignEmailId) {
    // Not a tracked campaign email — acknowledge silently
    return NextResponse.json({ ok: true, skipped: true, event: eventType })
  }

  const sb = buildSupabase()

  if (eventType === "email.bounced") {
    const bounceReason = data?.bounce?.message ?? null
    const { error } = await sb.rpc("handle_email_bounced", {
      p_campaign_email_id: campaignEmailId,
      p_bounce_reason: bounceReason,
    })
    if (error) {
      console.error("[Webhook/inbound] handle_email_bounced error:", error)
      return NextResponse.json({ error: "internal" }, { status: 500 })
    }
    console.warn(`[Webhook/inbound] BOUNCE detected for ${campaignEmailId}`)
    return NextResponse.json({ ok: true, event: eventType, action: "bounced" })
  }

  if (eventType === "email.complained") {
    const { error } = await sb.rpc("handle_email_complained", {
      p_campaign_email_id: campaignEmailId,
    })
    if (error) {
      console.error("[Webhook/inbound] handle_email_complained error:", error)
      return NextResponse.json({ error: "internal" }, { status: 500 })
    }
    console.warn(`[Webhook/inbound] SPAM COMPLAINT for ${campaignEmailId}`)
    return NextResponse.json({ ok: true, event: eventType, action: "complained" })
  }

  if (eventType === "email.failed") {
    console.error(`[Webhook/inbound] EMAIL FAILED for ${campaignEmailId}`, data)
    return NextResponse.json({ ok: true, event: eventType, action: "logged" })
  }

  // email.opened or email.clicked
  const rpcMap: Record<string, string> = {
    "email.opened": "increment_email_opens",
    "email.clicked": "increment_email_clicks",
  }
  const rpcName = rpcMap[eventType]
  if (!rpcName) {
    return NextResponse.json({ ok: true, event: eventType, action: "ignored" })
  }

  const isOpen = eventType === "email.opened"

  const { error: rpcErr } = await sb.rpc(rpcName, {
    p_campaign_email_id: campaignEmailId,
  })
  if (rpcErr) {
    console.error(`[Webhook/inbound] ${rpcName} error:`, rpcErr)
    return NextResponse.json({ error: "internal" }, { status: 500 })
  }

  await updateTimelineEngagement(sb, campaignEmailId, isOpen)
  return NextResponse.json({ ok: true, event: eventType })
}

async function handleReceivedEvent(
  payload: ResendWebhookEvent
): Promise<NextResponse> {
  const email: InboundEmailPayload = payload.data ?? {
    from: payload.from ?? "",
    to: payload.to ?? "",
    headers: payload.headers,
  }

  const toField = email.to
  const fromField = email.from

  if (!fromField) {
    return NextResponse.json({ error: "Missing sender (from)" }, { status: 400 })
  }

  const sb = buildSupabase()
  const senderEmail = extractSenderEmail(fromField)

  let campaignEmailId: string | null = null
  let resolvedLayer = 0

  campaignEmailId = await layer1PlusAddress(sb, toField)
  if (campaignEmailId) resolvedLayer = 1

  if (!campaignEmailId) {
    campaignEmailId = await layer2HeaderTrace(sb, email.headers)
    if (campaignEmailId) resolvedLayer = 2
  }

  if (!campaignEmailId) {
    campaignEmailId = await layer3DbFallback(sb, senderEmail)
    if (campaignEmailId) resolvedLayer = 3
  }

  if (!campaignEmailId) {
    console.log("[Webhook/inbound] No layer matched for sender:", senderEmail)
    return NextResponse.json({ ok: true, matched: false, sender: senderEmail })
  }

  const { error: rpcErr } = await sb.rpc("increment_email_replies", {
    p_campaign_email_id: campaignEmailId,
  })
  if (rpcErr) {
    console.error("[Webhook/inbound] increment_email_replies error:", rpcErr)
    return NextResponse.json({ error: "internal" }, { status: 500 })
  }

  await updateTimelineReplies(sb, campaignEmailId)

  return NextResponse.json({
    ok: true,
    matched: true,
    layer: resolvedLayer,
    campaignEmailId,
  })
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // ── Auth guard: Svix signature verification ──────────────────────────────
  const webhookSecret = process.env.RESEND_INBOUND_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("[Webhook/inbound] Missing RESEND_INBOUND_WEBHOOK_SECRET env var")
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  const rawBody = await req.text()
  const svixId = req.headers.get("svix-id")
  const svixTimestamp = req.headers.get("svix-timestamp")
  const svixSignature = req.headers.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 400 })
  }

  let payload: ResendWebhookEvent
  try {
    const resend = getResendClient()
    payload = resend.webhooks.verify({
      payload: rawBody,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret,
    }) as unknown as ResendWebhookEvent
  } catch (err) {
    console.error("[Webhook/inbound] signature verification failed:", err)
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 })
  }

  const eventType = payload.type ?? ""

  try {
    // Engagement events: opens/clicks/bounces/complaints/failures
    if (
      eventType === "email.opened" ||
      eventType === "email.clicked" ||
      eventType === "email.bounced" ||
      eventType === "email.complained" ||
      eventType === "email.failed"
    ) {
      return await handleEngagementEvent(eventType, payload.data ?? {})
    }

    // Inbound reply
    if (eventType === "email.received" || !eventType) {
      return await handleReceivedEvent(payload)
    }

    // Any other event subscribed in the dashboard (contact.*, domain.*, etc.)
    return NextResponse.json({ ok: true, skipped: true, event: eventType })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Webhook/inbound] fatal:", msg)
    return NextResponse.json({ error: "internal" }, { status: 500 })
  }
}
