import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Phase 5 admin gate. Returns the admin's identifier (email or "system") on
// success, or a 401 Response on rejection. Caller pattern:
//
//   const result = await requireAdmin(req)
//   if (result instanceof Response) return result
//   const adminEmail = result // string, safe to use
//
// Two ways to authenticate, either is sufficient:
//   1. X-Admin-Secret header matching ADMIN_SECRET_KEY env var (curl/scripts).
//   2. Supabase session whose email is in the ADMIN_EMAILS allowlist (browser).
export async function requireAdmin(req: NextRequest): Promise<string | Response> {
  // 1. X-Admin-Secret header
  const headerSecret = req.headers.get("x-admin-secret")
  const envSecret = process.env.ADMIN_SECRET_KEY
  if (envSecret && headerSecret && headerSecret === envSecret) {
    return "system"
  }

  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  // 2. Basic Auth header (used by browser for /admin UI and subsequent fetch calls)
  const authHeader = req.headers.get("authorization")
  if (authHeader && envSecret) {
    const match = authHeader.match(/^Basic\s+(.*)$/)
    if (match) {
      try {
        const decoded = atob(match[1])
        const [user, ...passParts] = decoded.split(":")
        const pass = passParts.join(":")
        if (allowlist.includes(user.toLowerCase()) && pass === envSecret) {
          return user.toLowerCase()
        }
      } catch (e) {
        // ignore base64 errors
      }
    }
  }

  // 3. Supabase session (fallback for older browser sessions)
  if (allowlist.length > 0) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email && allowlist.includes(user.email.toLowerCase())) {
      return user.email
    }
  }

  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { 
      status: 401, 
      headers: { 
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Basic realm="Campfire Admin Panel"'
      } 
    },
  )
}
