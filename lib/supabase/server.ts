import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

function stripQuotes(value: string): string {
  return value.replace(/^(['"])(.*)\1$/, "$2").trim()
}

export async function createClient() {
  const cookieStore = await cookies()
  const url = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  const key = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "")

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // setAll called from a Server Component — cookies will be set by middleware
        }
      },
    },
  })
}
