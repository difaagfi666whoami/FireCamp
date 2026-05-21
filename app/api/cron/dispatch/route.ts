import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import sanitizeHtml from "sanitize-html"
import { buildEmailHeaders, injectFooter } from "@/lib/email/footer"

// ---------------------------------------------------------------------------
// Dispatcher Cron — runs every 15 min via Vercel Cron
//
// Fetches scheduled emails whose send time has arrived (Asia/Jakarta), fires
// them through Resend, and marks them "sent" in Supabase. Adds compliance
// footer + List-Unsubscribe headers, sanitises body HTML, and respects the
// suppression list (v_pending_emails filters those out). On send failure
// retries up to MAX_RETRIES then marks the row 'dead_letter'.
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3

const stripQ = (v: string) => v.replace(/^(['"])(.*)\1$/, "$2").trim()
const supabaseUrl = stripQ(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
const supabaseServiceKey = stripQ(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
const resendApiKey = process.env.RESEND_API_KEY ?? ""

function buildSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing SUPABASE env vars for cron dispatcher")
  }
  return createClient(supabaseUrl, supabaseServiceKey)
}

function buildResend() {
  if (!resendApiKey) {
    throw new Error("Missing RESEND_API_KEY env var")
  }
  return new Resend(resendApiKey)
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "a",
    "ul", "ol", "li", "blockquote",
    "h1", "h2", "h3", "h4",
    "div", "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    "*": ["style"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // Force every anchor to be safe in inbox clients.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
  },
}

interface PendingEmailRow {
  email_id: string
  user_id: string
  target_email: string
  subject: string
  body: string
  scheduled_date: string
  scheduled_time: string
  unsubscribe_token: string
}

export async function GET(req: NextRequest) {
  // Auth: only Vercel Cron (or matching secret) may invoke.
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const sb = buildSupabase()
    const resend = buildResend()

    // View already filters status='scheduled' AND excludes addresses on the
    // suppression list. It also carries unsubscribe_token per row.
    const { data: viewEmails, error: fetchErr } = await sb
      .from("v_pending_emails")
      .select("email_id, user_id, target_email, subject, body, scheduled_date, scheduled_time, unsubscribe_token")
      .limit(100)

    if (fetchErr) {
      console.error("[Cron/dispatch] fetch error:", fetchErr)
      return NextResponse.json({ error: "internal" }, { status: 500 })
    }

    const nowMs = new Date().getTime()
    const emails: PendingEmailRow[] = ((viewEmails ?? []) as PendingEmailRow[]).filter(e => {
      if (!e.scheduled_date || !e.scheduled_time) return false
      const timeStr = e.scheduled_time.length === 5 ? `${e.scheduled_time}:00` : e.scheduled_time
      const mailDateMs = new Date(`${e.scheduled_date}T${timeStr}+07:00`).getTime()
      return mailDateMs <= nowMs
    })

    if (emails.length === 0) {
      return NextResponse.json({ dispatched: 0 })
    }

    // Batch-load verified user email settings (N+1 avoidance).
    const userIds = Array.from(new Set(emails.map(e => e.user_id).filter(Boolean)))
    let emailSettingsMap = new Map<string, { from_name: string; from_email: string; domain_status: string }>()
    if (userIds.length > 0) {
      const { data: userSettings } = await sb
        .from("user_email_settings")
        .select("user_id, from_name, from_email, domain_status")
        .in("user_id", userIds)
        .eq("domain_status", "verified")
      if (userSettings) {
        emailSettingsMap = new Map(
          (userSettings as Record<string, unknown>[]).map(s => [
            s.user_id as string,
            {
              from_name:     (s.from_name as string) ?? "",
              from_email:    (s.from_email as string) ?? "",
              domain_status: (s.domain_status as string) ?? "unverified",
            },
          ]),
        )
      }
    }

    let dispatched = 0
    const errors: Array<{ id: string; error: string }> = []

    for (const email of emails) {
      try {
        // Concurrency lock: scheduled → processing in one atomic update.
        const { data: lockData, error: lockErr } = await sb
          .from("campaign_emails")
          .update({ status: "processing" })
          .eq("id", email.email_id)
          .eq("status", "scheduled")
          .select("id")
          .maybeSingle()

        if (lockErr || !lockData) {
          console.log(`[Cron/dispatch] Skipping ${email.email_id} — already locked or sent.`)
          continue
        }

        // Compose sender. Default Campfire address if no verified custom domain.
        const userEmailSetting = emailSettingsMap.get(email.user_id ?? "")
        const fromEmail =
          userEmailSetting?.domain_status === "verified" && userEmailSetting.from_email
            ? `${userEmailSetting.from_name} <${userEmailSetting.from_email}>`
            : (process.env.RESEND_FROM_EMAIL ?? "Campfire <noreply@campfire.web.id>")

        const replyDomain = process.env.RESEND_INBOUND_DOMAIN ?? ""
        const replyTo = replyDomain
          ? `reply+${email.email_id}@${replyDomain}`
          : undefined

        // Sanitise → footer → headers.
        const sanitizedBody = sanitizeHtml(email.body, SANITIZE_OPTIONS)
        const bodyWithFooter = injectFooter(sanitizedBody, email.unsubscribe_token)
        const complianceHeaders = buildEmailHeaders(email.unsubscribe_token)

        const { data: resendData, error: resendErr } = await resend.emails.send({
          from: fromEmail,
          to: [email.target_email],
          subject: email.subject,
          html: bodyWithFooter,
          headers: complianceHeaders,
          ...(replyTo ? { replyTo: [replyTo] } : {}),
          tags: [{ name: "campaign_email_id", value: email.email_id }],
        })

        if (resendErr) {
          // Retry bookkeeping: increment counter, transition back to scheduled
          // OR to dead_letter once we've burned the retry budget.
          const { data: current } = await sb
            .from("campaign_emails")
            .select("retry_count")
            .eq("id", email.email_id)
            .single()

          const newRetryCount = (current?.retry_count ?? 0) + 1
          const isDeadLetter = newRetryCount >= MAX_RETRIES

          await sb
            .from("campaign_emails")
            .update({
              status:        isDeadLetter ? "dead_letter" : "scheduled",
              retry_count:   newRetryCount,
              last_error:    (resendErr.message ?? "Unknown send error").slice(0, 500),
              last_retry_at: new Date().toISOString(),
            })
            .eq("id", email.email_id)

          if (isDeadLetter) {
            console.error(
              `[Cron/dispatch] DEAD-LETTER ${email.email_id} after ${MAX_RETRIES} attempts: ${resendErr.message}`,
            )
          }
          throw new Error(resendErr.message)
        }

        // Success path: mark sent + persist Resend message id.
        const resendMessageId = resendData?.id ?? null
        const { error: updateErr } = await sb
          .from("campaign_emails")
          .update({
            status:  "sent",
            sent_at: new Date().toISOString(),
            ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
          })
          .eq("id", email.email_id)

        if (updateErr) {
          console.error(`[Cron/dispatch] update error for ${email.email_id}:`, updateErr)
          errors.push({ id: email.email_id, error: updateErr.message })
        } else {
          dispatched++
          try {
            const { data: cData } = await sb
              .from("campaign_emails")
              .select("campaign_id")
              .eq("id", email.email_id)
              .single()
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
