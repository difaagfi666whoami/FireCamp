import { NextRequest, NextResponse } from "next/server"
import { createClient, SupabaseClient } from "@supabase/supabase-js"

// ---------------------------------------------------------------------------
// Inbound Reply Webhook — Resend Inbound Routing
//
// Handles incoming email replies and attributes them to campaigns using a
// 3-Layer Defense Mechanism:
//
//   Layer 1 (Plus-Address): Parse +{campaign_email_id} from the To header.
//   Layer 2 (Header Trace): Match In-Reply-To header against stored message IDs.
//   Layer 3 (DB Fallback):  Look up sender email in contacts table heuristically.
//
// On successful match, increments reply metrics via RPC and updates timeline.
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

interface ResendInboundEvent {
  type?: string
  data?: InboundEmailPayload
  // Resend may deliver the payload flat (no wrapper) or wrapped
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

/** Extract a header value from the headers array (case-insensitive) */
function getHeader(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string
): string | null {
  if (!headers) return null
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
  return header?.value ?? null
}

/** UUID v4 regex — used to validate plus-address extraction */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Extract campaign_email_id from +addressing in the To field.
 * e.g. "reply+550e8400-e29b-41d4-a716-446655440000@domain.com" → UUID
 */
function extractPlusAddress(toField: string | string[]): string | null {
  const addresses = Array.isArray(toField) ? toField : [toField]
  for (const addr of addresses) {
    // Strip display name: "Name <email>" → "email"
    const emailMatch = addr.match(/<([^>]+)>/)
    const email = emailMatch ? emailMatch[1] : addr.trim()

    // Match plus-addressing: local+{uuid}@domain
    const plusMatch = email.match(/\+([^@]+)@/)
    if (plusMatch) {
      const candidate = plusMatch[1]
      if (UUID_RE.test(candidate)) {
        return candidate
      }
    }
  }
  return null
}

/**
 * Extract the sender's bare email address from the From field.
 * e.g. "John Doe <john@example.com>" → "john@example.com"
 */
function extractSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1].toLowerCase() : from.trim().toLowerCase()
}

/**
 * Extract Message-ID reference from In-Reply-To header.
 * Strips angle brackets: "<msg-id>" → "msg-id"
 */
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
  const timeline: TimelineEntry[] = Array.isArray(caRow.timeline)
    ? caRow.timeline
    : []

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
    console.error("[Webhook/inbound] timeline update error:", updateErr)
  }
}

// ---------------------------------------------------------------------------
// 3-Layer Defense: resolve campaign_email_id from inbound email
// ---------------------------------------------------------------------------

/** Layer 1: Plus-Address — instant resolution via To header */
async function layer1PlusAddress(
  _sb: SupabaseClient,
  toField: string | string[]
): Promise<string | null> {
  const campaignEmailId = extractPlusAddress(toField)
  if (!campaignEmailId) return null

  console.log("[Webhook/inbound] Layer 1 HIT — plus-address:", campaignEmailId)
  return campaignEmailId
}

/** Layer 2: Header Trace — match In-Reply-To against stored resend_message_id */
async function layer2HeaderTrace(
  sb: SupabaseClient,
  headers: Array<{ name: string; value: string }> | undefined
): Promise<string | null> {
  const inReplyTo = getHeader(headers, "In-Reply-To")
  if (!inReplyTo) return null

  const messageId = extractMessageId(inReplyTo)
  if (!messageId) return null

  // Resend message IDs may or may not have angle brackets; try both forms
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

/** Layer 3: DB Fallback — match sender email against contacts table */
async function layer3DbFallback(
  sb: SupabaseClient,
  senderEmail: string
): Promise<string | null> {
  // Find the contact by email
  const { data: contact } = await sb
    .from("contacts")
    .select("company_id")
    .eq("email", senderEmail)
    .limit(1)
    .maybeSingle()

  if (!contact?.company_id) return null

  // Find active campaign for this company
  const { data: campaign } = await sb
    .from("campaigns")
    .select("id")
    .eq("company_id", contact.company_id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!campaign?.id) return null

  // Get the most recently sent email in this campaign
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
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let payload: ResendInboundEvent
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  // Resend inbound may wrap in { data: ... } or send flat
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

  try {
    const sb = buildSupabase()
    const senderEmail = extractSenderEmail(fromField)

    // --- Execute 3-Layer Defense sequentially ---
    let campaignEmailId: string | null = null
    let resolvedLayer = 0

    // Layer 1: Plus-Address
    campaignEmailId = await layer1PlusAddress(sb, toField)
    if (campaignEmailId) {
      resolvedLayer = 1
    }

    // Layer 2: In-Reply-To header trace
    if (!campaignEmailId) {
      campaignEmailId = await layer2HeaderTrace(sb, email.headers)
      if (campaignEmailId) {
        resolvedLayer = 2
      }
    }

    // Layer 3: DB fallback via sender email → contacts → active campaign
    if (!campaignEmailId) {
      campaignEmailId = await layer3DbFallback(sb, senderEmail)
      if (campaignEmailId) {
        resolvedLayer = 3
      }
    }

    // If no layer resolved, acknowledge but don't process
    if (!campaignEmailId) {
      console.log("[Webhook/inbound] No layer matched for sender:", senderEmail)
      return NextResponse.json({
        ok: true,
        matched: false,
        sender: senderEmail,
      })
    }

    // --- Record the reply ---
    // 1. Atomic increment via RPC
    const { error: rpcErr } = await sb.rpc("increment_email_replies", {
      p_campaign_email_id: campaignEmailId,
    })

    if (rpcErr) {
      console.error("[Webhook/inbound] increment_email_replies error:", rpcErr)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    // 2. Update JSONB timeline on campaign_analytics
    await updateTimelineReplies(sb, campaignEmailId)

    return NextResponse.json({
      ok: true,
      matched: true,
      layer: resolvedLayer,
      campaignEmailId,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Webhook/inbound] fatal:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
