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
    total: number
    estimatedCostIDR: number
  }
}

// -----------------------------------------------------------------------------
// GET analytics — fetch dari Supabase, return zeroed data jika belum ada
// Pulse dashboard bersifat read-only: tidak ada mock seeding
// -----------------------------------------------------------------------------

export async function getCampaignAnalytics(campaignId: string): Promise<AnalyticsData> {
  const { data, error } = await supabase
    .from("campaign_analytics")
    .select(`
      emails_sent, open_rate, click_rate, reply_rate,
      benchmark_open_rate, benchmark_click_rate, benchmark_reply_rate,
      token_recon, token_match, token_craft, estimated_cost_idr,
      timeline,
      email_analytics (email_number, opens, clicks, replies, engagement_status)
    `)
    .eq("campaign_id", campaignId)
    .maybeSingle()

  if (error || !data) {
    // Zeroed-out default — Pulse is read-only, no mock seeding
    const { data: emails } = await supabase
      .from("campaign_emails")
      .select("sequence_number, status")
      .eq("campaign_id", campaignId)
      .order("sequence_number")

    const perEmail = (emails ?? []).map((e: any) => ({
      emailNumber: e.sequence_number,
      name:        `Email ${e.sequence_number}`,
      opens:       0,
      clicks:      0,
      replies:     0,
      status:      e.status ?? "scheduled",
    }))

    // Fallback if no campaign_emails exist yet
    if (perEmail.length === 0) {
      for (let i = 1; i <= 3; i++) {
        perEmail.push({ emailNumber: i, name: `Email ${i}`, opens: 0, clicks: 0, replies: 0, status: "scheduled" })
      }
    }

    return {
      summary: { emailsSent: 0, openRate: 0, clickRate: 0, replyRate: 0, industryBenchmarks: { openRate: 22.0, clickRate: 3.5, replyRate: 8.0 } },
      perEmail,
      timeline: [],
      tokenUsage: { recon: 0, match: 0, craft: 0, total: 0, estimatedCostIDR: 0 },
    }
  }

  const recon = (data as any).token_recon ?? 0
  const match = (data as any).token_match ?? 0
  const craft = (data as any).token_craft ?? 0

  return {
    summary: {
      emailsSent: (data as any).emails_sent ?? 0,
      openRate:   (data as any).open_rate   ?? 0,
      clickRate:  (data as any).click_rate  ?? 0,
      replyRate:  (data as any).reply_rate  ?? 0,
      industryBenchmarks: {
        openRate:  (data as any).benchmark_open_rate  ?? 22.0,
        clickRate: (data as any).benchmark_click_rate ?? 3.5,
        replyRate: (data as any).benchmark_reply_rate ?? 8.0,
      },
    },
    perEmail: ((data as any).email_analytics ?? [] as any[])
      .sort((a: any, b: any) => a.email_number - b.email_number)
      .map((ea: any) => ({
        emailNumber: ea.email_number,
        name:        `Email ${ea.email_number}`,
        opens:       ea.opens   ?? 0,
        clicks:      ea.clicks  ?? 0,
        replies:     ea.replies ?? 0,
        status:      ea.engagement_status ?? "sent",
      })),
    timeline: ((data as any).timeline ?? []) as Array<{ day: string; opens: number; clicks: number; replies: number }>,
    tokenUsage: {
      recon,
      match,
      craft,
      total:            recon + match + craft,
      estimatedCostIDR: (data as any).estimated_cost_idr ?? 0,
    },
  }
}
