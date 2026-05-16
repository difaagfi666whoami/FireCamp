import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

const stripQ = (v: string) => v.replace(/^(['"])(.*)\1$/, "$2").trim()

function buildServiceClient() {
  const url = stripQ(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  const key = stripQ(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
  if (!url || !key) throw new Error("Missing Supabase env vars")
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 })
  }

  // 2. Fetch resend_domain_id from DB
  const sb = buildServiceClient()
  const { data: settings, error: fetchErr } = await sb
    .from("user_email_settings")
    .select("resend_domain_id, domain_status")
    .eq("user_id", user.id)
    .maybeSingle()

  if (fetchErr || !settings) {
    return NextResponse.json({ error: "Konfigurasi domain tidak ditemukan" }, { status: 404 })
  }

  if (!settings.resend_domain_id) {
    return NextResponse.json({ error: "Domain belum didaftarkan" }, { status: 400 })
  }

  if (settings.domain_status === "verified") {
    return NextResponse.json({ success: true, status: "verified" })
  }

  // 3. Check verification status at Resend
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return NextResponse.json({ error: "Resend API key tidak dikonfigurasi" }, { status: 500 })
  }

  let resendStatus: string
  try {
    const res = await fetch(`https://api.resend.com/domains/${settings.resend_domain_id}`, {
      headers: { "Authorization": `Bearer ${resendApiKey}` },
    })
    if (!res.ok) {
      const errData = await res.json()
      return NextResponse.json(
        { error: errData.message ?? "Gagal mengecek status domain" },
        { status: res.status }
      )
    }
    const domainData = await res.json()
    resendStatus = domainData.status ?? "pending"
  } catch (err) {
    console.error("[verify-domain] Resend fetch error:", err)
    return NextResponse.json({ error: "Gagal menghubungi Resend API" }, { status: 502 })
  }

  // Map Resend status → our domain_status
  const statusMap: Record<string, string> = {
    verified:    "verified",
    not_started: "pending",
    pending:     "pending",
    failure:     "failed",
  }
  const newStatus = statusMap[resendStatus] ?? "pending"

  // 4. Update DB
  const updatePayload: Record<string, unknown> = {
    domain_status: newStatus,
    updated_at:    new Date().toISOString(),
  }
  if (newStatus === "verified") {
    updatePayload.domain_verified_at = new Date().toISOString()
  }

  const { error: updateErr } = await sb
    .from("user_email_settings")
    .update(updatePayload)
    .eq("user_id", user.id)

  if (updateErr) {
    console.error("[verify-domain] DB update error:", updateErr.message)
  }

  return NextResponse.json({ success: true, status: newStatus })
}
