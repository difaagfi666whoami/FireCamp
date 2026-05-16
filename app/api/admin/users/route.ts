import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/auth/admin"

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

  // Auth users
  const usersRes = await sb.auth.admin.listUsers({ perPage: 1000 })
  if (usersRes.error) {
    return NextResponse.json({ error: "Gagal memuat data user." }, { status: 500 })
  }
  const allUsers = usersRes.data.users

  // Balances
  const { data: balances } = await sb.from("user_credits").select("user_id, balance")
  const balanceMap = new Map<string, number>((balances ?? []).map((b: any) => [b.user_id, b.balance ?? 0]))

  // Aggregate spent + last activity from credit_transactions
  const { data: txs } = await sb
    .from("credit_transactions")
    .select("user_id, type, amount, created_at")
  const spentMap = new Map<string, number>()
  const lastActMap = new Map<string, string>()
  for (const tx of txs ?? []) {
    const uid = tx.user_id as string
    if (tx.type === "debit") {
      spentMap.set(uid, (spentMap.get(uid) ?? 0) + Math.abs(tx.amount ?? 0))
    }
    const prev = lastActMap.get(uid)
    if (!prev || (tx.created_at && tx.created_at > prev)) {
      lastActMap.set(uid, tx.created_at as string)
    }
  }

  // Company counts
  const { data: companies } = await sb.from("companies").select("user_id")
  const compMap = new Map<string, number>()
  for (const c of companies ?? []) {
    const uid = c.user_id as string
    compMap.set(uid, (compMap.get(uid) ?? 0) + 1)
  }

  const rows = allUsers
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      balance: balanceMap.get(u.id) ?? 0,
      total_spent: spentMap.get(u.id) ?? 0,
      company_count: compMap.get(u.id) ?? 0,
      last_activity_at: lastActMap.get(u.id) ?? null,
    }))
    .sort((a, b) => {
      const la = a.last_activity_at ? Date.parse(a.last_activity_at) : 0
      const lb = b.last_activity_at ? Date.parse(b.last_activity_at) : 0
      if (lb !== la) return lb - la
      return Date.parse(b.created_at) - Date.parse(a.created_at)
    })

  return NextResponse.json({ users: rows, generatedAt: new Date().toISOString() })
}
