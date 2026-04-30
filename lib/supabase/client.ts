import { createBrowserClient } from "@supabase/ssr"

function stripQuotes(value: string): string {
  return value.replace(/^(['"])(.*)\1$/, "$2").trim()
}

const url = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
const key = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "")

if (!url || !key) {
  throw new Error(
    "Missing Supabase env vars. Pastikan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY ada di .env.local"
  )
}

// createBrowserClient from @supabase/ssr handles cookie chunking natively —
// preventing silent cookie drops when session.user exceeds 4KB
export const supabase = createBrowserClient(url, key)

export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new Error("Tidak terautentikasi. Silakan login ulang.")
  }
  return data.user.id
}

export async function getCurrentSessionToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) {
    throw new Error("Sesi tidak valid. Silakan login ulang.")
  }
  return data.session.access_token
}
