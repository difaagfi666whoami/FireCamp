"use client"

import { SalesTriggers } from "@/types/recon.types"
import { Target, AlertTriangle, Zap, Sparkles } from "lucide-react"

interface SalesTriggersCardProps {
  triggers?: SalesTriggers
}

export function SalesTriggersCard({ triggers }: SalesTriggersCardProps) {
  if (!triggers || (!triggers.reality && !triggers.bottleneck && !triggers.entryHook)) {
    return null
  }

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-light border border-brand/20 flex items-center justify-center text-brand">
            <Sparkles className="w-4 h-4" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold tracking-tight text-foreground">
              The 3 Sales Triggers
            </h3>
            <p className="text-[12px] text-muted-foreground font-medium">
              3 Pemicu Penjualan Eksekutif Berbasis Fakta Terverifikasi
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-brand bg-brand-light px-2.5 py-0.5 rounded-full border border-brand/20">
          Executive Briefing
        </span>
      </div>

      {/* Grid 3 Triggers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {/* 1. The Reality */}
        <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-4 flex flex-col justify-between space-y-2">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                <Target className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
              <span className="text-[12px] font-bold uppercase tracking-wide text-emerald-900">
                1. The Reality
              </span>
            </div>
            <p className="text-[13px] text-emerald-950/80 leading-relaxed">
              {triggers.reality || "Model bisnis dan target pasar terverifikasi dari website resmi target."}
            </p>
          </div>
          <p className="text-[10.5px] font-semibold text-emerald-700/70 uppercase tracking-wider pt-2 border-t border-emerald-200/40">
            Fakta Model Bisnis
          </p>
        </div>

        {/* 2. The Bottleneck */}
        <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-4 flex flex-col justify-between space-y-2">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
              <span className="text-[12px] font-bold uppercase tracking-wide text-amber-900">
                2. The Bottleneck
              </span>
            </div>
            <p className="text-[13px] text-amber-950/80 leading-relaxed">
              {triggers.bottleneck || "Hambatan operasional atau gap teknologi yang teridentifikasi dari data target."}
            </p>
          </div>
          <p className="text-[10.5px] font-semibold text-amber-700/70 uppercase tracking-wider pt-2 border-t border-amber-200/40">
            Titik Masalah Konkret
          </p>
        </div>

        {/* 3. The Entry Hook */}
        <div className="bg-purple-50/50 border border-purple-200/60 rounded-xl p-4 flex flex-col justify-between space-y-2">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-purple-100 flex items-center justify-center text-purple-800 shrink-0">
                <Zap className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
              <span className="text-[12px] font-bold uppercase tracking-wide text-purple-900">
                3. The Entry Hook
              </span>
            </div>
            <p className="text-[13px] text-purple-950/80 leading-relaxed">
              {triggers.entryHook || "Sudut penawaran terbaik dan alasan mendesak untuk outreach sekarang."}
            </p>
          </div>
          <p className="text-[10.5px] font-semibold text-purple-700/70 uppercase tracking-wider pt-2 border-t border-purple-200/40">
            Sudut Penawaran (Why Now)
          </p>
        </div>
      </div>
    </div>
  )
}
