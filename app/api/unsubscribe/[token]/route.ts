import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const stripQ = (v: string) => v.replace(/^(['"])(.*)\1$/, "$2").trim()

function buildSupabase() {
  const url = stripQ(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  const key = stripQ(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
  if (!url || !key) throw new Error("Missing Supabase env vars")
  return createClient(url, key)
}

// GET — browser/email-client opens the link.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  return processUnsubscribe(context)
}

// POST — Gmail/Yahoo one-click unsubscribe (List-Unsubscribe-Post).
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  return processUnsubscribe(context)
}

async function processUnsubscribe(
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params

  // UUID-v4 format check before hitting the DB.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return new NextResponse(htmlPage("Token tidak valid."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }

  try {
    const sb = buildSupabase()
    const { data, error } = await sb.rpc("add_to_suppression_list", {
      p_unsubscribe_token: token,
    })

    if (error || !data?.ok) {
      return new NextResponse(
        htmlPage("Tautan tidak ditemukan atau sudah kadaluarsa."),
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
      )
    }

    return new NextResponse(
      htmlPage(
        `Berhasil. Email <strong>${escapeHtml(String(data.email))}</strong> tidak akan menerima pesan dari pengirim ini lagi.`,
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    )
  } catch (err) {
    console.error("[unsubscribe] error:", err)
    return new NextResponse(
      htmlPage("Terjadi kesalahan. Coba lagi atau hubungi pengirim."),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
    )
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function htmlPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Berhenti Berlangganan — Campfire</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 32px; text-align: center; color: #0D1A14; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="icon">✉️</div>
  <h1>Berhenti Berlangganan</h1>
  <p>${message}</p>
</body>
</html>`
}
