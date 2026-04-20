import { PainPoint } from "@/types/recon.types"
import { Flame, AlertCircle, Minus, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

const SEVERITY_CONFIG = {
  high: {
    label: "HIGH",
    icon: <Flame className="w-3 h-3"  strokeWidth={1.5} />,
    badge: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
    bar: "bg-red-500",
    card: "border-red-200/60 bg-red-50/30",
  },
  medium: {
    label: "MEDIUM",
    icon: <AlertCircle className="w-3 h-3"  strokeWidth={1.5} />,
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    bar: "bg-amber-400",
    card: "border-amber-200/60 bg-amber-50/20",
  },
  low: {
    label: "LOW",
    icon: <Minus className="w-3 h-3"  strokeWidth={1.5} />,
    badge: "bg-zinc-100 text-zinc-600 border-zinc-200",
    dot: "bg-zinc-400",
    bar: "bg-zinc-300",
    card: "border-border/60 bg-white",
  },
} as const

export function PainPointList({ painPoints }: { painPoints: PainPoint[] }) {
  if (!painPoints?.length) return null

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
      <h3 className="font-bold text-[15px] text-foreground mb-5">
        Pain Points Teridentifikasi
        <span className="ml-2 text-[12px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {painPoints.length} issue
        </span>
      </h3>

      <div className="space-y-3">
        {painPoints.map((pp, idx) => {
          const cfg = SEVERITY_CONFIG[pp.severity] ?? SEVERITY_CONFIG.low
          return (
            <div key={idx} className={cn("rounded-xl border p-4 flex gap-3", cfg.card)}>
              {/* Left accent bar */}
              <div className={cn("w-1 rounded-full shrink-0 self-stretch", cfg.bar)} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide">
                    {pp.category}
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full border shrink-0",
                    cfg.badge
                  )}>
                    {cfg.icon}
                    {cfg.label}
                  </span>
                </div>
                <p className="text-[13.5px] text-foreground/90 leading-snug">{pp.issue}</p>

                {/* Citation link */}
                {pp.sourceUrl && (
                  <a
                    href={pp.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-[11.5px] text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0"  strokeWidth={1.5} />
                    <span className="truncate max-w-[280px]">
                      {pp.sourceTitle || pp.sourceUrl}
                    </span>
                  </a>
                )}

                {/* Match angle — sales framing */}
                {pp.matchAngle && (
                  <div className="mt-3 flex items-start gap-2 bg-brand-light/60 border border-brand/20 rounded-lg px-3 py-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand mt-0.5 shrink-0 leading-none">
                      Approach
                    </span>
                    <p className="text-[12px] text-brand/80 leading-snug">{pp.matchAngle}</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
