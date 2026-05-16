import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"
import { checkRateLimit } from "@/lib/rateLimit"

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

  // 1a. Rate limit — calls Resend Domains API on every request. Cap at 5/hour.
  const rl = checkRateLimit(`add-domain:${user.id}`, 5, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfterSeconds} detik.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    )
  }

  // 2. Validate payload
  let body: { fromName?: string; fromEmail?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 })
  }

  const fromName  = body.fromName?.trim() ?? ""
  const fromEmail = body.fromEmail?.trim().toLowerCase() ?? ""

  if (!fromName || !fromEmail) {
    return NextResponse.json({ error: "Nama pengirim dan alamat email wajib diisi" }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(fromEmail)) {
    return NextResponse.json({ error: "Format alamat email tidak valid" }, { status: 400 })
  }

  const domain = fromEmail.split("@")[1]

  // 3. Call Resend Domains API
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return NextResponse.json({ error: "Resend API key tidak dikonfigurasi" }, { status: 500 })
  }

  let resendDomainId: string
  let dnsRecords: Array<{ type: string; name: string; value: string; ttl?: number; priority?: number }>

  try {
    const resendRes = await fetch("https://api.resend.com/domains", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      if (resendData.name === "domain_already_exists" || resendRes.status === 422) {
        return NextResponse.json(
          { error: `Domain ${domain} sudah terdaftar di akun Resend. Hapus domain lama dulu atau gunakan domain lain.` },
          { status: 422 }
        )
      }
      console.error("[add-domain] Resend API error:", resendData)
      return NextResponse.json(
        { error: "Gagal mendaftarkan domain ke Resend. Coba lagi." },
        { status: resendRes.status }
      )
    }

    resendDomainId = resendData.id
    dnsRecords = (resendData.records ?? []).map((r: Record<string, unknown>) => ({
      type:     r.type as string,
      name:     r.name as string,
      value:    r.value as string,
      ttl:      r.ttl as number | undefined,
      priority: r.priority as number | undefined,
    }))
  } catch (err) {
    console.error("[add-domain] Resend fetch error:", err)
    return NextResponse.json({ error: "Gagal menghubungi Resend API" }, { status: 502 })
  }

  // 4. Upsert to DB via service role
  const sb = buildServiceClient()
  const { error: dbError } = await sb
    .from("user_email_settings")
    .upsert({
      user_id:          user.id,
      from_name:        fromName,
      from_email:       fromEmail,
      resend_domain_id: resendDomainId,
      domain_status:    "pending",
      dns_records:      dnsRecords,
      updated_at:       new Date().toISOString(),
    }, { onConflict: "user_id" })

  if (dbError) {
    console.error("[add-domain] DB upsert error:", dbError.message)
    return NextResponse.json({ error: "Gagal menyimpan konfigurasi domain" }, { status: 500 })
  }

  return NextResponse.json({ success: true, domain, dnsRecords })
}
