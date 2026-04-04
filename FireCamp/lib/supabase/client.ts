import { createClient } from "@supabase/supabase-js"

// Strip surrounding quotes yang mungkin ikut terbaca di Windows
// Contoh: 'https://...' → https://...
function stripQuotes(value: string): string {
  return value.replace(/^(['"])(.*)\1$/, "$2").trim()
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

const url = stripQuotes(rawUrl)
const key = stripQuotes(rawKey)

if (!url || !key) {
  throw new Error(
    "Missing Supabase env vars. Pastikan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY ada di .env.local"
  )
}

if (!url.startsWith("https://")) {
  throw new Error(
    `NEXT_PUBLIC_SUPABASE_URL tidak valid: "${url}". Pastikan tidak ada tanda kutip di .env.local`
  )
}

// Singleton — aman untuk hot-reload Next.js
export const supabase = createClient(url, key)
