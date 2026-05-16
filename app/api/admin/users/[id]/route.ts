import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/auth/admin"

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const result = await requireAdmin(req)
  if (result instanceof Response) return result

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: "User id missing" }, { status: 400 })

  const stripQ = (v: string) => v.replace(/^(['"])(.*)\1$/, "$2").trim()
  const url = stripQ(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  const key = stripQ(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase env vars missing" }, { status: 500 })
  }
  const sb = createClient(url, key)

  const userRes = await sb.auth.admin.getUserById(id)
  if (userRes.error || !userRes.data.user) {
    return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 })
  }
  const u = userRes.data.user

  const { data: profileRow } = await sb
    .from("user_profiles")
    .select("workspace_name, sender_name, sender_title")
    .eq("user_id", id)
    .maybeSingle()

  const { data: creditsRow } = await sb
    .from("user_credits")
    .select("balance")
    .eq("user_id", id)
    .maybeSingle()

  const { data: txs } = await sb
    .from("credit_transactions")
    .select("id, type, amount, description, created_at")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(100)

  let totalSpent = 0
  let totalEarned = 0
  for (const tx of txs ?? []) {
    if (tx.type === "debit") totalSpent += Math.abs(tx.amount ?? 0)
    else totalEarned += tx.amount ?? 0
  }

  const { data: comps } = await sb
    .from("companies")
    .select("id, name, url, industry, created_at, progress_recon, progress_match, progress_craft, progress_polish, progress_launch, progress_pulse")
    .eq("user_id", id)
    .order("created_at", { ascending: false })

  const { data: fbs } = await sb
    .from("feedback")
    .select("id, sentiment, message, page_path, created_at")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(50)

  return NextResponse.json({
    user: {
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      workspace_name: profileRow?.workspace_name ?? null,
      sender_name: profileRow?.sender_name ?? null,
      sender_title: profileRow?.sender_title ?? null,
      balance: creditsRow?.balance ?? 0,
      total_spent: totalSpent,
      total_earned: totalEarned,
    },
    transactions: txs ?? [],
    companies: comps ?? [],
    feedback: fbs ?? [],
    generatedAt: new Date().toISOString(),
  })
}
