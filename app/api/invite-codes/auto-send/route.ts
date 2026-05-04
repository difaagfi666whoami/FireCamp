import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"
import { Resend } from "resend"
import { randomBytes } from "crypto"

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

function generateCode(): string {
  const bytes = randomBytes(4)
  let suffix = ""
  for (let i = 0; i < 4; i++) suffix += ALPHABET[bytes[i] % ALPHABET.length]
  return `CAMP-${suffix}`
}

function buildEmailHtml(code: string, email: string, credits: number): string {
  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EF;padding:40px 0">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden">
        <!-- Header -->
        <tr>
          <td style="background:#0D1A14;padding:28px 32px">
            <p style="margin:0;color:#F5F3EF;font-size:18px;font-weight:700;letter-spacing:-0.5px">🔥 campfire</p>
            <p style="margin:6px 0 0;color:#9ca3af;font-size:13px">Early Access</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 32px">
            <p style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Kode Undangan Kamu</p>
            <h1 style="margin:0 0 20px;color:#0D1A14;font-size:26px;font-weight:800;line-height:1.2">Selamat datang di Campfire Early Access</h1>
            <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.6">
              Hei <strong>${email.split("@")[0]}</strong> — akun kamu sudah siap. Gunakan kode di bawah untuk membuka akses dan mendapatkan <strong>${credits} kredit gratis</strong> untuk mencoba seluruh pipeline Campfire.
            </p>
            <!-- Code block -->
            <div style="background:#F0FDF4;border:2px dashed #0F6E56;border-radius:12px;padding:20px 24px;text-align:center;margin:0 0 28px">
              <p style="margin:0 0 6px;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px">Kode Undangan</p>
              <p style="margin:0;color:#0F6E56;font-size:32px;font-weight:900;letter-spacing:4px;font-family:'Courier New',monospace">${code}</p>
            </div>
            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 0 28px">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/redeem-invite"
                     style="display:inline-block;background:#0F6E56;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:100px">
                    Tukarkan Kode →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">
              Atau buka: <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/redeem-invite" style="color:#0F6E56">${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace("https://", "")}/auth/redeem-invite</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F9FAFB;border-top:1px solid #e5e7eb;padding:20px 32px">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6">
              Email ini dikirim ke ${email}. Jika kamu tidak mendaftar di Campfire, abaikan email ini.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const userClient = await createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  // `force` = true means the user explicitly clicked "Kirim ulang".
  // Without it, skip re-sending if this user already has an auto-generated code
  // (prevents duplicate emails when the auth redirect double-mounts the page).
  const body = await req.json().catch(() => ({}))
  const force = !!body?.force

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "config" }, { status: 500 })
  }
  const admin = createServiceClient(supabaseUrl, supabaseKey)
  const credits = parseInt(process.env.NEXT_PUBLIC_FREE_CREDITS_ON_SIGNUP ?? "50", 10)

  const systemCreatedBy = `system:auto:${user.id}`

  // Look for an existing auto-generated code for this user.
  const { data: existing } = await admin
    .from("invite_codes")
    .select("code")
    .eq("created_by", systemCreatedBy)
    .lt("use_count", 1)
    .maybeSingle()

  let code: string
  let isNew = false

  if (existing?.code) {
    code = existing.code
    // Don't send another email on the initial auto-send — the user already got one.
    // Only send again when the user explicitly clicks "Kirim ulang".
    if (!force) {
      return NextResponse.json({ sent: false, isNew: false })
    }
  } else {
    // Generate a unique code. The partial unique index on created_by means only
    // one concurrent request can win the INSERT; the loser gets a conflict error,
    // re-queries, and returns without sending a duplicate email.
    let inserted = false
    let candidate = ""
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      candidate = generateCode()
      const { error } = await admin.from("invite_codes").insert({
        code:        candidate,
        created_by:  systemCreatedBy,
        max_uses:    1,
        expires_at:  null,
      })
      if (!error) {
        inserted = true
      } else if (!/duplicate|unique/i.test(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    if (!inserted) {
      // Lost the race — another concurrent request already inserted a code.
      // Re-query and return without sending a duplicate email.
      const { data: raceWinner } = await admin
        .from("invite_codes")
        .select("code")
        .eq("created_by", systemCreatedBy)
        .lt("use_count", 1)
        .maybeSingle()

      if (!raceWinner?.code) {
        return NextResponse.json({ error: "Gagal membuat kode. Coba lagi." }, { status: 500 })
      }
      // Return success — the race winner already sent (or will send) the email.
      return NextResponse.json({ sent: false, isNew: false })
    }

    code = candidate
    isNew = true
  }

  // Send email via Resend.
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@campfire.web.id"
  if (!resendKey) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 })
  }

  const resend = new Resend(resendKey)
  const { error: emailError } = await resend.emails.send({
    from:    `Campfire <${fromEmail}>`,
    to:      user.email!,
    subject: `${code} — Kode Undangan Early Access Campfire`,
    html:    buildEmailHtml(code, user.email!, credits),
  })

  if (emailError) {
    console.error("[auto-send] Resend error:", emailError)
    return NextResponse.json({ error: "Gagal mengirim email. Coba lagi." }, { status: 500 })
  }

  return NextResponse.json({ sent: true, isNew })
}
