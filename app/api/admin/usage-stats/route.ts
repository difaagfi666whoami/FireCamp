import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/auth/admin"

// Free-tier monthly limits, hardcoded per spec. Adjust if a provider changes
// pricing — this is a heads-up dashboard, not a billing source-of-truth.
const API_LIMITS = {
  tavily: 1000,
  serper: 2500,
  jina: 1_000_000,
  resend: 3000,
} as const

type ApiName = keyof typeof API_LIMITS

// Approximate external API calls per credit-debiting operation. These are
// rough estimates — real call counts depend on Recon depth, retries, etc.
const OP_TO_API: Record<string, Partial<Record<ApiName, number>>> = {
  recon_free: { tavily: 1, serper: 2, jina: 5  },
  recon_pro:  { tavily: 3, serper: 5, jina: 15 },
  match:      {},
  craft:      {},
  polish:     {},
}

function classifyOp(description: string): string {
  const d = (description ?? "").toLowerCase()
  if (d.startsWith("recon free") || d.startsWith("recon free:")) return "recon_free"
  if (d.startsWith("recon pro")  || d.startsWith("recon pro:"))  return "recon_pro"
  if (d.startsWith("match"))   return "match"
  if (d.startsWith("craft"))   return "craft"
  if (d.startsWith("polish"))  return "polish"
  return "other"
}

export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if (result instanceof Response) return result

  const stripQ = (v: string) => v.replace(/^(['"])(.*)\1$/, "$2").trim()
  const url = stripQ(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  const key = stripQ(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase env vars missing" }, { status: 500 })
  }
  const sb = createClient(url, key)

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // ── Users ──────────────────────────────────────────────────────────
  const usersRes = await sb.auth.admin.listUsers({ perPage: 1000 })
  if (usersRes.error) {
    console.error("[admin/usage-stats] listUsers failed:", usersRes.error)
    return NextResponse.json({ error: "Gagal memuat data admin." }, { status: 500 })
  }
  const allUsers = usersRes.data.users
  const userEmailMap = new Map<string, string>(
    allUsers.map((u) => [u.id, u.email ?? ""]),
  )
  const totalUsers = allUsers.length

  const { data: companyUsers } = await sb.from("companies").select("user_id")
  const activeUserIds = new Set((companyUsers ?? []).map((r: any) => r.user_id))
  const activeUsers = activeUserIds.size
  const inactiveUsers = Math.max(0, totalUsers - activeUsers)

  const { data: txAll } = await sb.from("credit_transactions").select("type, amount")
  let creditsDistributed = 0
  let creditsConsumed = 0
  for (const tx of txAll ?? []) {
    if (tx.type === "grant" || tx.type === "purchase" || tx.type === "refund") {
      creditsDistributed += tx.amount ?? 0
    } else if (tx.type === "debit") {
      creditsConsumed += Math.abs(tx.amount ?? 0)
    }
  }

  // ── Pipeline activity, last 7 days ─────────────────────────────────
  const { data: tx7 } = await sb
    .from("credit_transactions")
    .select("description, amount")
    .eq("type", "debit")
    .gte("created_at", sevenDaysAgo)

  const last7Days: Record<string, number> = {}
  let creditsLast7 = 0
  for (const tx of tx7 ?? []) {
    const op = classifyOp(tx.description ?? "")
    last7Days[op] = (last7Days[op] ?? 0) + 1
    creditsLast7 += Math.abs(tx.amount ?? 0)
  }
  const avgCreditsPerActiveUserPerDay = activeUsers > 0
    ? Math.round((creditsLast7 / activeUsers / 7) * 10) / 10
    : 0

  // ── Feedback ───────────────────────────────────────────────────────
  const { data: fbAll } = await sb.from("feedback").select("sentiment")
  const feedbackCounts: Record<"positive" | "neutral" | "negative", number> = {
    positive: 0, neutral: 0, negative: 0,
  }
  for (const f of fbAll ?? []) {
    const s = f.sentiment as "positive" | "neutral" | "negative"
    if (s === "positive" || s === "neutral" || s === "negative") {
      feedbackCounts[s]++
    }
  }

  const { data: fbRecent } = await sb
    .from("feedback")
    .select("id, user_id, sentiment, message, page_path, created_at")
    .order("created_at", { ascending: false })
    .limit(10)
  const recentFeedback = (fbRecent ?? []).map((f: any) => ({
    ...f,
    user_email: userEmailMap.get(f.user_id) ?? "",
  }))

  // ── API burn (estimated, current calendar month) ───────────────────
  const { data: txMonth } = await sb
    .from("credit_transactions")
    .select("description")
    .eq("type", "debit")
    .gte("created_at", monthStart)

  const apiUsage: Record<ApiName, number> = { tavily: 0, serper: 0, jina: 0, resend: 0 }
  for (const tx of txMonth ?? []) {
    const op = classifyOp(tx.description ?? "")
    const calls = OP_TO_API[op] ?? {}
    for (const api of Object.keys(API_LIMITS) as ApiName[]) {
      apiUsage[api] += calls[api] ?? 0
    }
  }
  const dayOfMonth = Math.max(1, now.getDate())
  const apiBurn = (Object.keys(API_LIMITS) as ApiName[]).map((api) => {
    const limit = API_LIMITS[api]
    const used = apiUsage[api]
    const remaining = Math.max(0, limit - used)
    const percentRemaining = limit > 0 ? Math.round((remaining / limit) * 100) : 0
    const dailyRate = used / dayOfMonth
    const daysUntilExhaustion = dailyRate > 0
      ? Math.max(0, Math.round(remaining / dailyRate))
      : null
    return {
      name: api,
      monthlyLimit: limit,
      estimatedUsed: used,
      percentRemaining,
      daysUntilExhaustion,
      alert: percentRemaining < 20,
    }
  })

  return NextResponse.json({
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: inactiveUsers,
      creditsDistributed,
      creditsConsumed,
    },
    pipeline: {
      last7Days,
      avgCreditsPerActiveUserPerDay,
    },
    feedback: {
      counts: feedbackCounts,
      recent: recentFeedback,
    },
    apiBurn,
    generatedAt: now.toISOString(),
  })
}
