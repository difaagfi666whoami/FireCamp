import { createBrowserClient } from "@supabase/ssr"

function stripQuotes(value: string): string {
  return value.replace(/^(['"])(.*)\1$/, "$2").trim()
}

// Lazy-init: defer client creation to runtime so `next build` can
// generate static pages without requiring Supabase env vars.
let _supabase: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseClient() {
  if (_supabase) return _supabase

  const url = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  const key = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "")

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Pastikan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY ada di .env.local"
    )
  }

  // createBrowserClient from @supabase/ssr handles cookie chunking natively —
  // preventing silent cookie drops when session.user exceeds 4KB
  _supabase = createBrowserClient(url, key)
  return _supabase
}

/** @deprecated Use getSupabaseClient() instead */
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop) {
    return (getSupabaseClient() as any)[prop]
  },
})

export async function getCurrentUserId(): Promise<string> {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) {
    throw new Error("Tidak terautentikasi. Silakan login ulang.")
  }
  return data.user.id
}

export async function getCurrentSessionToken(): Promise<string> {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.getSession()
  if (error || !data.session) {
    throw new Error("Sesi tidak valid. Silakan login ulang.")
  }
  return data.session.access_token
}
