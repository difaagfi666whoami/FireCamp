import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "crypto"
import { requireAdmin } from "@/lib/auth/admin"

// 32-char alphabet excluding ambiguous 0/O and 1/I. 256 % 32 == 0 → no modulo
// bias when reducing a random byte into the alphabet.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

function generateCode(): string {
  const bytes = randomBytes(4)
  let suffix = ""
  for (let i = 0; i < 4; i++) {
    suffix += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return `CAMP-${suffix}`
}

export async function POST(req: NextRequest) {
  const result = await requireAdmin(req)
  if (result instanceof Response) return result
  const adminId = result

  let body: { count?: number; maxUses?: number; expiresAt?: string | null } = {}
  try {
    body = await req.json()
  } catch {
    /* empty body is allowed */
  }

  const count    = Math.max(1, Math.min(1000, body.count ?? 1))
  const maxUses  = Math.max(1, Math.min(1000, body.maxUses ?? 1))
  const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null

  const stripQ = (v: string) => v.replace(/^(['"])(.*)\1$/, "$2").trim()
  const url = stripQ(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  const key = stripQ(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase env vars missing" }, { status: 500 })
  }
  const supabase = createClient(url, key)

  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    let inserted = false
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const code = generateCode()
      const { error } = await supabase.from("invite_codes").insert({
        code,
        created_by: adminId,
        max_uses: maxUses,
        expires_at: expiresAt,
      })
      if (!error) {
        codes.push(code)
        inserted = true
      } else if (!/duplicate|unique/i.test(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }
    if (!inserted) {
      return NextResponse.json(
        { error: "Failed to generate unique code after 5 attempts", codes },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ codes })
}
