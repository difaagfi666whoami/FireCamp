import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatRupiah = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0
  }).format(amount)

export const formatToken = (count: number): string =>
  count >= 1000 ? `~${Math.round(count / 1000)}K tokens` : `${count} tokens`

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

export const getProspectScoreColor = (score: number): string => {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'neutral'
}

export const getMilestoneLabel = (key: string): string => {
  const labels: Record<string, string> = {
    recon: 'Recon', match: 'Match', craft: 'Craft',
    polish: 'Polish', launch: 'Launch', pulse: 'Pulse'
  }
  return labels[key] ?? key
}

/**
 * guessEmailPattern — tebak kandidat email dari nama kontak + domain perusahaan.
 * HANYA string manipulation client-side (bukan email terverifikasi).
 * Dipakai sebagai tampilan bantu saat field email kosong.
 */
export const guessEmailPattern = (name: string, url: string): string[] => {
  if (!name || !url) return []
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const domain = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if (!domain || !domain.includes('.')) return []

    const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return []

    const clean = (s: string) => s.replace(/[^a-z]/g, '')
    const first = clean(parts[0])
    const last = clean(parts[parts.length - 1])
    if (!first && !last) return []

    const candidates: string[] = []
    if (first && last && last !== first) {
      candidates.push(`${first}.${last}@${domain}`)
      candidates.push(`${first[0]}${last}@${domain}`)
    }
    if (first) candidates.push(`${first}@${domain}`)
    if (first && last && last !== first) candidates.push(`${first}${last}@${domain}`)

    return Array.from(new Set(candidates)).slice(0, 3)
  } catch {
    return []
  }
}
