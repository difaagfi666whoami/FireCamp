"use client"

import { Sparkles, Mail, CheckCircle2, Clock, Zap, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ScheduleItem } from "../page"

interface AiScheduleViewProps {
  schedule: ScheduleItem[]
  isActive: boolean
  isActivating?: boolean
  onActivate: () => void
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function AiScheduleView({ schedule, isActive, isActivating, onActivate }: AiScheduleViewProps) {
  return (
    <div className="space-y-6">
      {/* AI Recommendation Card */}
      <div className="bg-slate-50 border border-border/60 rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-brand/10 rounded-lg shrink-0">
            <Sparkles className="w-4 h-4 text-brand" />
          </div>
          <div>
            <h3 className="font-bold text-[14px] text-foreground">Rekomendasi AI</h3>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">
              Berdasarkan profil target dan pola engagement optimal B2B
            </p>
          </div>
        </div>
        <p className="text-[13.5px] text-foreground/80 leading-relaxed border-t border-border/40 pt-4">
          Jadwal 3-email dengan interval <strong>Hari ke-1 → ke-4 → ke-10</strong> dipilih karena target berada di fase ekspansi aktif post-funding, di mana decision maker biasanya responsif di awal minggu.
          Email pertama dikirim Selasa pagi (09:00) untuk menghindari inbox Monday dump. Follow-up Hari ke-4 memanfaatkan window sebelum akhir pekan. Email terakhir di Hari ke-10 memberi jarak yang cukup untuk tidak terasa memaksa.
        </p>
      </div>

      {/* Schedule List */}
      <div className="space-y-3">
        <h3 className="font-bold text-[13px] text-muted-foreground uppercase tracking-wider">
          Jadwal Pengiriman
        </h3>
        {schedule.map((item) => (
          <div
            key={item.emailNumber}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl border bg-white transition-all duration-300",
              isActive ? "border-emerald-200 shadow-sm" : "border-border/60"
            )}
          >
            {/* Status dot */}
            <div className="shrink-0 w-3 h-3 relative flex items-center justify-center">
              {isActive ? (
                <>
                  <span className="absolute w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-60"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500 relative"></span>
                </>
              ) : (
                <span className="w-3 h-3 rounded-full bg-muted border border-border/60"></span>
              )}
            </div>

            {/* Email icon */}
            <div className={cn(
              "p-2 rounded-lg shrink-0",
              isActive ? "bg-emerald-50 text-emerald-600" : "bg-muted text-muted-foreground"
            )}>
              <Mail className="w-4 h-4" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[14px] text-foreground">
                Email {item.emailNumber}
                <span className="ml-2 text-[12px] font-medium text-muted-foreground">({item.dayLabel})</span>
              </p>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">
                {formatDate(item.date)}
              </p>
            </div>

            {/* Time */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className={cn(
                "font-bold text-[14px]",
                isActive ? "text-emerald-700" : "text-foreground"
              )}>
                {item.time}
              </span>
            </div>

            {/* Active badge */}
            {isActive && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
                <CheckCircle2 className="w-3 h-3" />
                Terjadwal
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Activate / Active State */}
      {!isActive ? (
        <Button
          onClick={onActivate}
          disabled={isActivating}
          className="w-full bg-brand hover:bg-brand/90 text-white font-bold h-12 rounded-xl text-[15px] shadow-md disabled:opacity-60"
        >
          {isActivating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
          {isActivating ? "Mengaktifkan..." : "Aktifkan Automation"}
        </Button>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-[14.5px] text-emerald-800">Automation aktif!</p>
            <p className="text-[12.5px] text-emerald-700 mt-0.5">
              Campaign akan dikirim otomatis sesuai jadwal di atas.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
