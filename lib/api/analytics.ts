import { supabase } from "@/lib/supabase/client"

// -----------------------------------------------------------------------------
// Shared return type — dipakai oleh getCampaignAnalytics & PulsePage
// -----------------------------------------------------------------------------

export interface AnalyticsData {
  summary: {
    emailsSent: number
    openRate: number
    clickRate: number
    replyRate: number
    industryBenchmarks: { openRate: number; clickRate: number; replyRate: number }
  }
  perEmail: Array<{
    emailNumber: number
    name: string
    opens: number
    clicks: number
    replies: number
    status: string
  }>
  timeline: Array<{ day: string; opens: number; clicks: number; replies: number }>
  tokenUsage: {
    recon: number
    match: number
    craft: number
    polish: number
    total: number
    estimatedCostIDR: number
  }
}

// -----------------------------------------------------------------------------
// GET analytics — fetch dari Supabase, return zeroed data jika belum ada
// Pulse dashboard bersifat read-only: tidak ada mock seeding
// -----------------------------------------------------------------------------

export async function getCampaignAnalytics(campaignId: string): Promise<AnalyticsData> {
  const { data: caData, error: caErr } = await supabase
    .from("campaign_analytics")
    .select(`
      emails_sent, open_rate, click_rate, reply_rate,
      benchmark_open_rate, benchmark_click_rate, benchmark_reply_rate,
      token_recon, token_match, token_craft, token_polish, estimated_cost_idr,
      timeline
    `)
    .eq("campaign_id", campaignId)
    .maybeSingle()

  const { data: emails } = await supabase
    .from("campaign_emails")
    .select(`
      sequence_number, status,
      email_analytics (opens, clicks, replies, engagement_status)
    `)
    .eq("campaign_id", campaignId)
    .order("sequence_number")

  const perEmail = (emails ?? []).map((e: any) => {
    const eaArray = e.email_analytics ?? []
    const ea = Array.isArray(eaArray) ? eaArray[0] : eaArray

    // STATUS RESOLUTION LOGIC (3-layer priority)
    //
    // Layer 0 — Engagement override: if there is ANY real activity (opens/clicks/replies),
    //   the email was clearly delivered. Trust email_analytics.engagement_status unconditionally.
    //   This guards against stale campaign_emails.status (e.g. dispatcher stored 'pending'
    //   even though the email was actually sent & tracked by Resend).
    //
    // Layer 1 — Hard lifecycle: failed/bounced/complained always win.
    //
    // Layer 2 — Sent: enrich with engagement_status if available (skip internal 'pending').
    //
    // Layer 3 — Pre-send: show campaign_emails.status as-is.

    let finalStatus: string
    const ceStatus = (e.status ?? "scheduled") as string
    const eaStatus = (ea?.engagement_status ?? "") as string
    const hasActivity = (ea?.opens ?? 0) > 0 || (ea?.clicks ?? 0) > 0 || (ea?.replies ?? 0) > 0

    if (hasActivity && eaStatus && eaStatus !== "pending") {
      // Layer 0: real engagement data is the ultimate truth
      finalStatus = eaStatus
    } else if (ceStatus === "failed" || ceStatus === "bounced" || ceStatus === "complained") {
      // Layer 1: hard failure states
      finalStatus = ceStatus
    } else if (ceStatus === "sent") {
      // Layer 2: sent — show richer engagement status if present
      finalStatus = (eaStatus && eaStatus !== "pending") ? eaStatus : "sent"
    } else {
      // Layer 3: draft / scheduled / pending — not sent yet
      finalStatus = ceStatus
    }

    return {
      emailNumber: e.sequence_number,
      name:        `Email ${e.sequence_number}`,
      opens:       ea?.opens   ?? 0,
      clicks:      ea?.clicks  ?? 0,
      replies:     ea?.replies ?? 0,
      status:      finalStatus,
    }
  })

  // Fallback if no campaign_emails exist yet
  if (perEmail.length === 0) {
    for (let i = 1; i <= 3; i++) {
      perEmail.push({ emailNumber: i, name: `Email ${i}`, opens: 0, clicks: 0, replies: 0, status: "scheduled" })
    }
  }

  if (caErr || !caData) {
    return {
      summary: { emailsSent: 0, openRate: 0, clickRate: 0, replyRate: 0, industryBenchmarks: { openRate: 22.0, clickRate: 3.5, replyRate: 8.0 } },
      perEmail,
      timeline: [],
      tokenUsage: { recon: 0, match: 0, craft: 0, polish: 0, total: 0, estimatedCostIDR: 0 },
    }
  }

  const recon  = caData.token_recon  ?? 0
  const match  = caData.token_match  ?? 0
  const craft  = caData.token_craft  ?? 0
  const polish = caData.token_polish ?? 0

  return {
    summary: {
      emailsSent: caData.emails_sent ?? 0,
      openRate:   caData.open_rate   ?? 0,
      clickRate:  caData.click_rate  ?? 0,
      replyRate:  caData.reply_rate  ?? 0,
      industryBenchmarks: {
        openRate:  caData.benchmark_open_rate  ?? 22.0,
        clickRate: caData.benchmark_click_rate ?? 3.5,
        replyRate: caData.benchmark_reply_rate ?? 8.0,
      },
    },
    perEmail,
    timeline: (caData.timeline ?? []) as Array<{ day: string; opens: number; clicks: number; replies: number }>,
    tokenUsage: {
      recon,
      match,
      craft,
      polish,
      total:            recon + match + craft + polish,
      estimatedCostIDR: caData.estimated_cost_idr ?? 0,
    },
  }
}
