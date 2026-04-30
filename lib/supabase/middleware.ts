import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"

function stripQuotes(value: string): string {
  return value.replace(/^(['"])(.*)\1$/, "$2").trim()
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  const key = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "")

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // IMPORTANT: getUser() must be called to keep the session alive via cookie refresh
  const { data: { user } } = await supabase.auth.getUser()

  return { supabase, response, user }
}
