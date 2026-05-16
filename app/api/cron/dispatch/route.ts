import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

// ---------------------------------------------------------------------------
// Dispatcher Cron — runs every 15 min via Vercel Cron
// Fetches scheduled emails whose send time has arrived (Asia/Jakarta),
// fires them through Resend, and marks them as "sent" in Supabase.
// ---------------------------------------------------------------------------

const stripQ = (v: string) => v.replace(/^(['"])(.*)\1$/, "$2").trim()
const supabaseUrl = stripQ(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
const supabaseServiceKey = stripQ(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
const resendApiKey = process.env.RESEND_API_KEY ?? ""

function buildSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing SUPABASE env vars for cron dispatcher")
  }
  // Use service-role key so we can bypass RLS in a server context
  return createClient(supabaseUrl, supabaseServiceKey)
}

function buildResend() {
  if (!resendApiKey) {
    throw new Error("Missing RESEND_API_KEY env var")
  }
  return new Resend(resendApiKey)
}

/** Current timestamp in Asia/Jakarta as ISO string (for Supabase comparison) */
function nowJakarta(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  ).toISOString()
}

export async function GET(req: NextRequest) {
  // ----- Auth guard: only allow Vercel Cron or matching secret -----
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const sb = buildSupabase()
    const resend = buildResend()
    const now = nowJakarta()

    // Fetch emails using the View which already handles joins to target contact
    const { data: viewEmails, error: fetchErr } = await sb
      .from("v_pending_emails")
      .select("email_id, user_id, target_email, subject, body, scheduled_date, scheduled_time")
      .limit(100)

    if (fetchErr) {
      console.error("[Cron/dispatch] fetch error:", fetchErr)
      return NextResponse.json({ error: "internal" }, { status: 500 })
    }

    // JS-side Evaluation to handle localized Jakarta comparison precisely
    const nowMs = new Date().getTime()
    const emails = (viewEmails || []).filter(e => {
      if (!e.scheduled_date || !e.scheduled_time) return false
      const timeStr = e.scheduled_time.length === 5 ? `${e.scheduled_time}:00` : e.scheduled_time
      const mailDateMs = new Date(`${e.scheduled_date}T${timeStr}+07:00`).getTime()
      return mailDateMs <= nowMs
    })

    if (!emails || emails.length === 0) {
      return NextResponse.json({ dispatched: 0 })
    }

    // Batch-fetch verified user email settings to avoid N+1 queries
    const userIds = Array.from(new Set(emails.map((e: Record<string, unknown>) => e.user_id as string).filter(Boolean)))
    let emailSettingsMap = new Map<string, { from_name: string; from_email: string; domain_status: string }>()
    if (userIds.length > 0) {
      const { data: userSettings } = await sb
        .from("user_email_settings")
        .select("user_id, from_name, from_email, domain_status")
        .in("user_id", userIds)
        .eq("domain_status", "verified")
      if (userSettings) {
        emailSettingsMap = new Map(
          (userSettings as Record<string, unknown>[]).map((s) => [
            s.user_id as string,
            {
              from_name:     (s.from_name as string) ?? "",
              from_email:    (s.from_email as string) ?? "",
              domain_status: (s.domain_status as string) ?? "unverified",
            }
          ])
        )
      }
    }

    let dispatched = 0
    const errors: Array<{ id: string; error: string }> = []

    for (const email of emails) {
      try {
        // --- CONCURRENCY LOCK (Double-send fix) ---
        // Try to transition status from "scheduled" to "processing".
        // If it fails (data is empty), another cron instance got it first.
        const { data: lockData, error: lockErr } = await sb
          .from("campaign_emails")
          .update({ status: "processing" })
          .eq("id", email.email_id)
          .eq("status", "scheduled")
          .select("id")
          .maybeSingle()

        if (lockErr || !lockData) {
          console.log(`[Cron/dispatch] Skipping ${email.email_id} - already locked or sent.`);
          continue;
        }

        // Build reply-to with +addressing so inbound replies carry campaign_email_id
        const userEmailSetting = emailSettingsMap.get((email as Record<string, unknown>).user_id as string ?? "")
        const fromEmail = (userEmailSetting?.domain_status === "verified" && userEmailSetting.from_email)
          ? `${userEmailSetting.from_name} <${userEmailSetting.from_email}>`
          : (process.env.RESEND_FROM_EMAIL ?? "Campfire <noreply@campfire.web.id>")
        const replyDomain = process.env.RESEND_INBOUND_DOMAIN ?? ""
        const replyTo = replyDomain
          ? `reply+${email.email_id}@${replyDomain}`
          : undefined

        const { data: resendData, error: resendErr } = await resend.emails.send({
          from: fromEmail,
          to: [email.target_email],
          subject: email.subject,
          html: email.body,
          ...(replyTo ? { replyTo: [replyTo] } : {}),
          tags: [{ name: "campaign_email_id", value: email.email_id }],
        })

        if (resendErr) {
          // If Resend fails, revert lock so it can be retried later
          await sb.from("campaign_emails").update({ status: "scheduled" }).eq("id", email.email_id)
          throw new Error(resendErr.message)
        }

        // Store Resend message ID for In-Reply-To header matching (Layer 2)
        const resendMessageId = resendData?.id ?? null

        const { error: updateErr } = await sb
          .from("campaign_emails")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
          })
          .eq("id", email.email_id)

        if (updateErr) {
          console.error(`[Cron/dispatch] update error for ${email.email_id}:`, updateErr)
          errors.push({ id: email.email_id, error: updateErr.message })
        } else {
          dispatched++
          // Increment tracking safely
          try {
            const { data: cData } = await sb.from("campaign_emails").select("campaign_id").eq("id", email.email_id).single()
            if (cData?.campaign_id) {
              await sb.rpc("increment_campaign_emails_sent", { p_campaign_id: cData.campaign_id })
            }
          } catch (e) {
            console.error("[Cron/dispatch] failed to increment sent metric:", e)
          }
        }
      } catch (sendErr: unknown) {
        const msg = sendErr instanceof Error ? sendErr.message : String(sendErr)
        console.error(`[Cron/dispatch] send error for ${email.email_id}:`, msg)
        errors.push({ id: email.email_id, error: msg })
      }
    }

    return NextResponse.json({ dispatched, errors: errors.length ? errors : undefined })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Cron/dispatch] fatal:", msg)
    return NextResponse.json({ error: "internal" }, { status: 500 })
  }
}
