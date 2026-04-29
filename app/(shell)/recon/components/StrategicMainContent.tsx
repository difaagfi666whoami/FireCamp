import { StrategicReport } from "@/types/recon.types"
import { MarkdownBlock } from "@/components/shared/MarkdownBlock"
import { Brain, TrendingUp, ListChecks } from "lucide-react"

interface Props {
  report?: StrategicReport | null
}

export function StrategicMainContent({ report }: Props) {
  if (!report) return null

  return (
    <div className="space-y-5">
      {/* Internal Capabilities */}
      {report.internalCapabilities && (
        <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-brand-light rounded-lg">
              <Brain className="w-4 h-4 text-brand"  strokeWidth={1.5} />
            </div>
            <h3 className="font-bold text-[15px] text-foreground">Kapabilitas Internal</h3>
          </div>
          <MarkdownBlock content={report.internalCapabilities} />
        </div>
      )}

      {/* Market Dynamics */}
      {report.marketDynamics && (
        <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <TrendingUp className="w-4 h-4 text-blue-600"  strokeWidth={1.5} />
            </div>
            <h3 className="font-bold text-[15px] text-foreground">Dinamika Pasar</h3>
          </div>
          <MarkdownBlock content={report.marketDynamics} />
        </div>
      )}

      {/* Strategic Roadmap */}
      {report.strategicRoadmap?.length > 0 && (
        <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-amber-50 rounded-lg">
              <ListChecks className="w-4 h-4 text-warning"  strokeWidth={1.5} />
            </div>
            <h3 className="font-bold text-[15px] text-foreground">Roadmap Strategis</h3>
          </div>
          <ol className="space-y-3">
            {report.strategicRoadmap.map((item, idx) => (
              <li key={idx} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand text-white text-[11px] font-black flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-[13.5px] text-foreground/85 leading-snug">{item}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Citations reference list */}
      {report?.citations && report.citations.length > 0 && (
        <div className="bg-slate-50 border border-border/50 rounded-2xl p-5 shadow-sm">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Sumber Referensi ({report.citations.length})
          </p>
          <ol className="space-y-2">
            {report.citations.map((c, idx) => (
              <li key={idx} className="flex gap-2 items-start text-[12px]">
                <span className="shrink-0 w-5 h-5 rounded-full bg-brand/10 text-brand text-[10px] font-black flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium line-clamp-1"
                  >
                    {c.title || c.url}
                  </a>
                  {(c.source || c.date) && (
                    <span className="text-muted-foreground ml-1">
                      {c.source && `— ${c.source}`}
                      {c.date && ` · ${c.date}`}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
