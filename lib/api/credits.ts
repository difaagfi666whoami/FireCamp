// Frontend wrapper for backend /api/billing/* endpoints.
// Auth is via the Supabase access token, attached automatically below.

import { supabase } from "@/lib/supabase/client"

function sq(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }
const API_URL = sq(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")

export interface CreditPack {
  id:          string
  name:        string
  credits:     number
  price_idr:   number
  price_cents: number
  highlight:   boolean
  description: string
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" }
}

export async function getBalance(): Promise<number> {
  const headers = await authHeaders()
  const res = await fetch(`${API_URL}/api/billing/balance`, { headers })
  if (!res.ok) {
    console.error("[credits] getBalance failed:", res.status)
    return 0
  }
  const body = await res.json() as { balance: number }
  return body.balance ?? 0
}

export async function getPackages(): Promise<CreditPack[]> {
  const res = await fetch(`${API_URL}/api/billing/packages`)
  if (!res.ok) throw new Error("Gagal memuat paket credits.")
  const body = await res.json() as { packs: CreditPack[] }
  return body.packs ?? []
}

export async function createCheckout(packId: string): Promise<string> {
  const headers = await authHeaders()
  const res = await fetch(`${API_URL}/api/billing/checkout`, {
    method:  "POST",
    headers,
    body:    JSON.stringify({ pack_id: packId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Gagal membuat checkout." }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  const body = await res.json() as { url: string }
  return body.url
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
