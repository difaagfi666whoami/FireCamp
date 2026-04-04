import { cn } from "@/lib/utils"

type Severity = "high" | "medium" | "low"

interface SeverityBadgeProps {
  severity: Severity
  className?: string
}

const SEVERITY_STYLES: Record<Severity, string> = {
  high:   "bg-[#D85A30]/10 text-[#D85A30] border border-[#D85A30]/20",
  medium: "bg-[#BA7517]/10 text-[#BA7517] border border-[#BA7517]/20",
  low:    "bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/20",
}

const SEVERITY_LABELS: Record<Severity, string> = {
  high:   "Tinggi",
  medium: "Sedang",
  low:    "Rendah",
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide",
        SEVERITY_STYLES[severity],
        className
      )}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  )
}
