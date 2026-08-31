"use client"

import { VerifiedCapabilities } from "@/types/recon.types"
import { CheckCircle2, Building, TrendingUp, ShieldCheck } from "lucide-react"

interface VerifiedCapabilitiesCardProps {
  capabilities?: VerifiedCapabilities
}

export function VerifiedCapabilitiesCard({ capabilities }: VerifiedCapabilitiesCardProps) {
  if (
    !capabilities ||
    ((capabilities.coreOfferings?.length ?? 0) === 0 &&
      (capabilities.verifiedClients?.length ?? 0) === 0 &&
      (capabilities.hiringSignals?.length ?? 0) === 0)
  ) {
    return null
  }

  const offerings = capabilities.coreOfferings ?? []
  const clients = capabilities.verifiedClients ?? []
  const hiring = capabilities.hiringSignals ?? []

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700">
            <ShieldCheck className="w-4 h-4" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold tracking-tight text-foreground">
              Bukti Digital & Kapabilitas Resmi
            </h3>
            <p className="text-[12px] text-muted-foreground font-medium">
              Data Nyata yang Diekstrak Langsung dari Sub-Halaman Website Target
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
          Official Ground Truth
        </span>
      </div>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {/* Core Offerings */}
        <div className="bg-muted/30 border border-border/40 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={2} />
            <span className="text-[12px] font-bold uppercase tracking-wide text-foreground">
              Layanan Inti
            </span>
          </div>
          {offerings.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {offerings.map((item, idx) => (
                <span
                  key={idx}
                  className="text-[12px] font-medium bg-white border border-border/60 text-foreground/90 px-2.5 py-1 rounded-lg shadow-2xs"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground italic">Tidak ada rincian spesifik.</p>
          )}
        </div>

        {/* Verified Clients / Portfolio */}
        <div className="bg-muted/30 border border-border/40 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-600" strokeWidth={2} />
            <span className="text-[12px] font-bold uppercase tracking-wide text-foreground">
              Klien & Portofolio
            </span>
          </div>
          {clients.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {clients.map((item, idx) => (
                <span
                  key={idx}
                  className="text-[12px] font-medium bg-white border border-border/60 text-foreground/90 px-2.5 py-1 rounded-lg shadow-2xs"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground italic">Portofolio tidak dipublikasikan.</p>
          )}
        </div>

        {/* Hiring Signals */}
        <div className="bg-muted/30 border border-border/40 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-600" strokeWidth={2} />
            <span className="text-[12px] font-bold uppercase tracking-wide text-foreground">
              Sinyal Rekrutmen Aktif
            </span>
          </div>
          {hiring.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {hiring.map((item, idx) => (
                <span
                  key={idx}
                  className="text-[12px] font-medium bg-purple-50 border border-purple-200/60 text-purple-900 px-2.5 py-1 rounded-lg"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground italic">Tidak ada lowongan aktif publik.</p>
          )}
        </div>
      </div>
    </div>
  )
}
