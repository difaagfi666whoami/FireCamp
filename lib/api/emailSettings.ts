import { supabase } from "@/lib/supabase/client"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DnsRecord {
  type: "TXT" | "CNAME" | "MX"
  name: string
  value: string
  ttl?: number
  priority?: number
}

export interface UserEmailSettings {
  id: string
  userId: string
  fromName: string
  fromEmail: string
  resendDomainId: string | null
  domainStatus: "unverified" | "pending" | "verified" | "failed"
  dnsRecords: DnsRecord[] | null
  domainVerifiedAt: string | null
  createdAt: string
  updatedAt: string
}

function mapRow(row: Record<string, unknown>): UserEmailSettings {
  return {
    id:               row.id as string,
    userId:           row.user_id as string,
    fromName:         (row.from_name as string) ?? "",
    fromEmail:        (row.from_email as string) ?? "",
    resendDomainId:   (row.resend_domain_id as string) ?? null,
    domainStatus:     (row.domain_status as UserEmailSettings["domainStatus"]) ?? "unverified",
    dnsRecords:       (row.dns_records as DnsRecord[]) ?? null,
    domainVerifiedAt: (row.domain_verified_at as string) ?? null,
    createdAt:        row.created_at as string,
    updatedAt:        row.updated_at as string,
  }
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function getEmailSettings(): Promise<UserEmailSettings | null> {
  try {
    const { data, error } = await supabase
      .from("user_email_settings")
      .select("*")
      .maybeSingle()

    if (error) {
      console.error("[emailSettings] fetch error:", error.message)
      return null
    }
    return data ? mapRow(data) : null
  } catch (err) {
    console.error("[emailSettings] unexpected error:", err)
    return null
  }
}

// ─── Add Domain ───────────────────────────────────────────────────────────────

export interface AddDomainPayload {
  fromName: string
  fromEmail: string
}

export interface AddDomainResult {
  success: boolean
  dnsRecords?: DnsRecord[]
  error?: string
}

export async function addDomain(payload: AddDomainPayload): Promise<AddDomainResult> {
  try {
    const res = await fetch("/api/settings/email/add-domain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error ?? "Gagal mendaftarkan domain" }
    return { success: true, dnsRecords: data.dnsRecords }
  } catch {
    return { success: false, error: "Koneksi gagal. Coba lagi." }
  }
}

// ─── Verify Domain ────────────────────────────────────────────────────────────

export interface VerifyDomainResult {
  success: boolean
  status?: UserEmailSettings["domainStatus"]
  error?: string
}

export async function verifyDomain(): Promise<VerifyDomainResult> {
  try {
    const res = await fetch("/api/settings/email/verify-domain", { method: "POST" })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error ?? "Verifikasi gagal" }
    return { success: true, status: data.status }
  } catch {
    return { success: false, error: "Koneksi gagal. Coba lagi." }
  }
}

// ─── Remove Domain ────────────────────────────────────────────────────────────

export interface RemoveDomainResult {
  success: boolean
  error?: string
}

export async function removeDomain(): Promise<RemoveDomainResult> {
  try {
    const res = await fetch("/api/settings/email/remove-domain", { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error ?? "Gagal menghapus domain" }
    return { success: true }
  } catch {
    return { success: false, error: "Koneksi gagal. Coba lagi." }
  }
}
