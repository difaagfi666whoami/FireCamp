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

  const supabase = createClient(url, key)
  const { data, error } = await supabase
    .from("invite_codes")
    .select("id, code, created_by, used_by, used_at, max_uses, use_count, expires_at, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[admin/invite-codes] list failed:", error)
    return NextResponse.json({ error: "Gagal memuat invite codes." }, { status: 500 })
  }
  return NextResponse.json({ codes: data ?? [] })
}
