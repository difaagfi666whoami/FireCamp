"use client"

import { Zap, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

type Mode = "ai" | "manual"

interface ModeSelectorProps {
  mode: Mode
  onChange: (mode: Mode) => void
}

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <button
        onClick={() => onChange("ai")}
        className={cn(
          "flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all duration-200",
          mode === "ai"
            ? "border-brand bg-brand/5 shadow-sm"
            : "border-border/60 bg-white hover:border-brand/40 hover:bg-slate-50/80"
        )}
      >
        <div className={cn(
          "p-2.5 rounded-lg shrink-0 mt-0.5",
          mode === "ai" ? "bg-brand text-white" : "bg-muted text-muted-foreground"
        )}>
          <Zap className="w-4 h-4"  strokeWidth={1.5} />
        </div>
        <div>
          <p className={cn("font-bold text-[14.5px]", mode === "ai" ? "text-brand" : "text-foreground")}>
            One-click AI Automation
          </p>
          <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
            Biarkan AI menentukan jadwal optimal berdasarkan pola engagement target.
          </p>
        </div>
      </button>

      <button
        onClick={() => onChange("manual")}
        className={cn(
          "flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all duration-200",
          mode === "manual"
            ? "border-brand bg-brand/5 shadow-sm"
            : "border-border/60 bg-white hover:border-brand/40 hover:bg-slate-50/80"
        )}
      >
        <div className={cn(
          "p-2.5 rounded-lg shrink-0 mt-0.5",
          mode === "manual" ? "bg-brand text-white" : "bg-muted text-muted-foreground"
        )}>
          <CalendarDays className="w-4 h-4"  strokeWidth={1.5} />
        </div>
        <div>
          <p className={cn("font-bold text-[14.5px]", mode === "manual" ? "text-brand" : "text-foreground")}>
            Manual Scheduling
          </p>
          <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
            Tentukan sendiri tanggal dan jam pengiriman untuk setiap email.
          </p>
        </div>
      </button>
    </div>
  )
}
