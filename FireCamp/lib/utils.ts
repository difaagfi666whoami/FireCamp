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
