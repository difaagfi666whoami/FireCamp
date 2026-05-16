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

export async function DELETE(req: NextRequest) {
  // 1. Auth
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 })
  }

  const sb = buildServiceClient()

  // 2. Fetch resend_domain_id
  const { data: settings } = await sb
    .from("user_email_settings")
    .select("resend_domain_id")
    .eq("user_id", user.id)
    .maybeSingle()

  // 3. Delete from Resend (best-effort — continue even if it fails)
  if (settings?.resend_domain_id) {
    const resendApiKey = process.env.RESEND_API_KEY
    if (resendApiKey) {
      try {
        await fetch(`https://api.resend.com/domains/${settings.resend_domain_id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${resendApiKey}` },
        })
      } catch (err) {
        console.warn("[remove-domain] Resend delete failed (non-fatal):", err)
      }
    }
  }

  // 4. Reset row fields (don't delete the row — keep it for future upserts)
  const { error: updateErr } = await sb
    .from("user_email_settings")
    .update({
      from_name:          "",
      from_email:         "",
      resend_domain_id:   null,
      domain_status:      "unverified",
      dns_records:        null,
      domain_verified_at: null,
      updated_at:         new Date().toISOString(),
    })
    .eq("user_id", user.id)

  if (updateErr) {
    if (!updateErr.message.includes("no rows")) {
      console.error("[remove-domain] DB update error:", updateErr.message)
      return NextResponse.json({ error: "Gagal menghapus konfigurasi domain" }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
