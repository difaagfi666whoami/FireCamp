"use client"

import { Cpu, Search, Tag, PenLine, DollarSign } from "lucide-react"
import { formatToken, formatRupiah } from "@/lib/utils"
import { TokenUsage } from "@/types/analytics.types"
import { cn } from "@/lib/utils"

interface TokenUsageCardProps {
  tokenUsage: TokenUsage
}

interface StageRow {
  key: keyof Pick<TokenUsage, "recon" | "match" | "craft">
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
}

const STAGES: StageRow[] = [
  {
    key: "recon",
    label: "Recon",
    icon: <Search className="w-3.5 h-3.5" />,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    key: "match",
    label: "Match",
    icon: <Tag className="w-3.5 h-3.5" />,
    color: "text-violet-600",
    bgColor: "bg-violet-100",
  },
  {
    key: "craft",
    label: "Craft",
    icon: <PenLine className="w-3.5 h-3.5" />,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
  },
]

export function TokenUsageCard({ tokenUsage }: TokenUsageCardProps) {
  return (
    <div className="bg-white border border-border/60 rounded-xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2.5 bg-muted rounded-lg shrink-0">
          <Cpu className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-bold text-[15px] text-foreground">Penggunaan Token AI</h3>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            Rincian konsumsi token per tahap pipeline
          </p>
        </div>
      </div>

      {/* Stage breakdown */}
      <div className="space-y-3 mb-5">
        {STAGES.map((stage) => {
          const count = tokenUsage[stage.key]
          const pct = Math.round((count / tokenUsage.total) * 100)

          return (
            <div key={stage.key}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={cn("p-1.5 rounded-md", stage.bgColor, stage.color)}>
                    {stage.icon}
                  </span>
                  <span className="text-[13px] font-semibold text-foreground">{stage.label}</span>
                </div>
                <span className="text-[13px] font-bold text-foreground">{formatToken(count)}</span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", stage.bgColor.replace("bg-", "bg-"))}
                  style={{ width: `${pct}%`, backgroundColor: stage.color.includes("blue") ? "#3b82f6" : stage.color.includes("violet") ? "#8b5cf6" : "#10b981" }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-border/50 pt-4 space-y-3">
        {/* Total tokens */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-muted-foreground">Total token digunakan</span>
          <span className="text-[14px] font-black text-foreground">{formatToken(tokenUsage.total)}</span>
        </div>

        {/* Estimated cost */}
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-[13px] font-bold text-amber-800">Estimasi Biaya</span>
          </div>
          <span className="text-[15px] font-black text-amber-900">
            {formatRupiah(tokenUsage.estimatedCostIDR)}
          </span>
        </div>
      </div>
    </div>
  )
}
