import { IntentSignal } from "@/types/recon.types"
import { CitationLink } from "@/components/shared/CitationLink"
import { Activity, Briefcase, Calendar, DollarSign } from "lucide-react"

export function IntentSignalsCard({ signals }: { signals: IntentSignal[] }) {
  if (!signals || signals.length === 0) return null

  // Function to determine icon and color based on signal type
  const getSignalMeta = (type: string, title: string) => {
    const t = type.toLowerCase()
    const isHiring = t === "hiring" || title.includes("[LOWONGAN]")
    const isMoney = t === "money" || t === "funding" || t === "acquisition"

    if (isHiring) {
      return {
        icon: <Briefcase className="w-4 h-4 text-emerald-600"  strokeWidth={1.5} />,
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        text: "text-emerald-700",
        label: "Hiring Signal"
      }
    }
    if (isMoney) {
      return {
        icon: <DollarSign className="w-4 h-4 text-blue-600"  strokeWidth={1.5} />,
        bg: "bg-blue-50",
        border: "border-blue-200",
        text: "text-blue-700",
        label: "Investment Signal"
      }
    }
    return {
      icon: <Activity className="w-4 h-4 text-purple-600"  strokeWidth={1.5} />,
      bg: "bg-purple-50",
      border: "border-purple-200",
      text: "text-purple-700",
      label: "Business Event"
    }
  }

  return (
    <div className="bg-gradient-to-br from-white to-orange-50/30 border border-orange-200/60 rounded-2xl p-6 shadow-sm relative overflow-hidden">
      {/* Decorative background blur */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-400/10 rounded-full blur-2xl pointer-events-none" />

      <h3 className="font-bold text-[15px] text-foreground mb-5 flex items-center gap-2">
        <Activity className="w-4 h-4 text-orange-500"  strokeWidth={1.5} />
        Sinyal Eksekusi (High Intent)
      </h3>

      <div className="space-y-4 relative z-10">
        {signals.map((item, idx) => {
          const meta = getSignalMeta(item.signalType, item.title)
          
          return (
            <div key={idx} className={`pb-4 ${idx < signals.length - 1 ? "border-b border-border/40" : ""}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${meta.bg} ${meta.border} border`}>
                  {meta.icon}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.text}`}>
                  {meta.label}
                </span>
              </div>
              
              <h4 className="font-bold text-[13.5px] text-foreground leading-snug mb-1.5">
                {item.title.replace("[LOWONGAN] ", "")} 
              </h4>
              
              <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground font-medium mb-2">
                <span className="bg-muted border border-border/50 px-2 py-0.5 rounded-full">{item.source}</span>
                <span>·</span>
                <span>{item.date}</span>
              </div>
              
              <p className="text-[13px] text-foreground/75 leading-relaxed mb-2">{item.summary}</p>
              {(item.verifiedAmount || item.verifiedDate) && (
                <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
                  {item.verifiedAmount && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                      <DollarSign className="w-3 h-3"  strokeWidth={1.5} />{item.verifiedAmount}
                    </span>
                  )}
                  {item.verifiedDate && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/50">
                      <Calendar className="w-3 h-3"  strokeWidth={1.5} />{item.verifiedDate}
                    </span>
                  )}
                </div>
              )}
              {item.url && <CitationLink href={item.url} label="Lihat Penuh" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
