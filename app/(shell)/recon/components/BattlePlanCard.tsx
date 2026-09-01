"use client"

import { BattlePlan } from "@/types/recon.types"
import { UserRound, MessageSquareText, Quote, Flame, Puzzle, ExternalLink, Swords } from "lucide-react"

interface BattlePlanCardProps {
  plan?: BattlePlan
}

/**
 * BattlePlanCard — "Rencana Serangan" 5 langkah.
 * Aset paling berharga untuk sales: jawaban langsung yang bisa dipakai bertindak.
 * Render pertama (sebelum laporan strategis) karena ini yang dilihat sales duluan.
 */
export function BattlePlanCard({ plan }: BattlePlanCardProps) {
  if (!plan) return null

  const hasAny = plan.whoToContact || plan.whatToSay || plan.openingLine || plan.whyNow || plan.fit
  if (!hasAny) return null

  const tiles = [
    {
      key: "whoToContact",
      icon: UserRound,
      label: "Siapa yang Dihubungi",
      en: "Who to Contact",
      value: plan.whoToContact,
      color: "bg-brand-light border-brand/20 text-brand",
      iconBg: "bg-brand/10 text-brand",
      fallback: "Kontak belum ditemukan — lihat Key Contacts untuk daftar PIC.",
    },
    {
      key: "whatToSay",
      icon: MessageSquareText,
      label: "Apa yang Disampaikan",
      en: "What to Say",
      value: plan.whatToSay,
      color: "bg-emerald-50 border-emerald-200/60 text-emerald-900",
      iconBg: "bg-emerald-100 text-emerald-800",
      fallback: "Inti pesan belum tersedia dari data riset.",
    },
    {
      key: "openingLine",
      icon: Quote,
      label: "Kalimat Pembuka",
      en: "Opening Line",
      value: plan.openingLine,
      color: "bg-purple-50 border-purple-200/60 text-purple-900",
      iconBg: "bg-purple-100 text-purple-800",
      fallback: "Belum ada kalimat pembuka spesifik dari data.",
    },
    {
      key: "whyNow",
      icon: Flame,
      label: "Kenapa Sekarang",
      en: "Why Now",
      value: plan.whyNow,
      color: "bg-amber-50 border-amber-200/60 text-amber-900",
      iconBg: "bg-amber-100 text-amber-800",
      fallback: "Timing netral — tidak ada trigger terdeteksi.",
    },
    {
      key: "fit",
      icon: Puzzle,
      label: "Kecocokan",
      en: "Fit",
      value: plan.fit,
      color: "bg-blue-50 border-blue-200/60 text-blue-900",
      iconBg: "bg-blue-100 text-blue-800",
      fallback: "Belum ada sinyal kecocokan teknologi terdeteksi.",
    },
  ]

  const urls = (plan.evidenceUrls ?? []).filter(Boolean)

  return (
    <div className="bg-white border border-brand/30 rounded-2xl p-6 shadow-sm space-y-4 ring-1 ring-brand/5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center">
            <Swords className="w-4 h-4" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold tracking-tight text-foreground">
              Battle Plan
            </h3>
            <p className="text-[12px] text-muted-foreground font-medium">
              Rencana Serangan Outreach — 5 Jawaban yang Bisa Langsung Dipakai
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-brand bg-brand-light px-2.5 py-0.5 rounded-full border border-brand/20">
          Amunisi Sales
        </span>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {tiles.map(tile => {
          const Icon = tile.icon
          const isEmpty = !tile.value
          return (
            <div
              key={tile.key}
              className={`${tile.color} rounded-xl p-4 flex flex-col gap-2 border`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${tile.iconBg}`}>
                  <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                </div>
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[12px] font-bold uppercase tracking-wide">
                    {tile.label}
                  </span>
                  <span className="text-[10.5px] text-muted-foreground font-medium truncate">
                    {tile.en}
                  </span>
                </div>
              </div>
              <p className={`text-[13px] leading-relaxed ${isEmpty ? "italic opacity-60" : ""}`}>
                {tile.value || tile.fallback}
              </p>
            </div>
          )
        })}
      </div>

      {/* Evidence citations */}
      {urls.length > 0 && (
        <div className="border-t border-border/40 pt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Bukti
          </span>
          {urls.map((u, i) => (
            <a
              key={i}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11.5px] text-blue-600 hover:underline font-medium max-w-[280px] truncate"
            >
              <ExternalLink className="w-3 h-3 shrink-0" strokeWidth={1.5} />
              {u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 44)}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
