// Frontend wrapper for /api/billing/xendit/* endpoints.
// All Xendit API calls happen in the FastAPI backend — this file only calls our own API.

import { supabase } from "@/lib/supabase/client"

function sq(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }
const API_URL = sq(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")

export type XenditPaymentMethod =
  | "QRIS"
  | "VA_BCA"
  | "VA_MANDIRI"
  | "VA_BNI"
  | "VA_BRI"
  | "VA_PERMATA"

export type XenditPaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "FAILED"

export interface XenditPayment {
  payment_id:     string
  payment_method: XenditPaymentMethod
  amount_idr:     number
  credits:        number
  expires_at:     string | null
  // QRIS
  qr_string?:     string | null
  // VA
  va_number?:     string | null
  bank_code?:     string | null
  bank_name?:     string | null
}

export interface XenditPaymentStatusResult {
  payment_id:     string
  status:         XenditPaymentStatus
  payment_method: string
  credits_added:  number | null
}

// Bank metadata for the VA selector UI
export interface BankOption {
  code:      XenditPaymentMethod
  bank_code: string
  name:      string
  short:     string
}

export const VA_BANKS: BankOption[] = [
  { code: "VA_BCA",     bank_code: "BCA",     name: "Bank Central Asia",          short: "BCA"     },
  { code: "VA_MANDIRI", bank_code: "MANDIRI", name: "Bank Mandiri",               short: "Mandiri" },
  { code: "VA_BNI",     bank_code: "BNI",     name: "Bank Negara Indonesia",      short: "BNI"     },
  { code: "VA_BRI",     bank_code: "BRI",     name: "Bank Rakyat Indonesia",      short: "BRI"     },
  { code: "VA_PERMATA", bank_code: "PERMATA", name: "Bank Permata",               short: "Permata" },
]

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" }
}

export async function createXenditPayment(
  packId:        string,
  paymentMethod: XenditPaymentMethod,
): Promise<XenditPayment> {
  const headers = await authHeaders()
  const res = await fetch(`${API_URL}/api/billing/xendit/create-payment`, {
    method:  "POST",
    headers,
    body:    JSON.stringify({ pack_id: packId, payment_method: paymentMethod }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Gagal membuat pembayaran." }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<XenditPayment>
}

export async function getXenditPaymentStatus(
  paymentId: string,
): Promise<XenditPaymentStatusResult> {
  const headers = await authHeaders()
  const res = await fetch(
    `${API_URL}/api/billing/xendit/payment-status/${encodeURIComponent(paymentId)}`,
    { headers },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Gagal cek status pembayaran." }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<XenditPaymentStatusResult>
}
