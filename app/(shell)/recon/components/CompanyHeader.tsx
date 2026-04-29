import { CompanyProfile } from "@/types/recon.types"
import { Globe, Building2 } from "lucide-react"

export function CompanyHeader({ company }: { company: CompanyProfile }) {
  const sr = company.strategicReport

  const painScore = Math.min((company.painPoints?.length ?? 0) * 8, 40)
  const maxContactScore = company.contacts?.length
    ? Math.min(Math.max(...company.contacts.map((c) => c.prospectScore ?? 0)) / 2, 30)
    : 0
  const hasRecentNews = (company.news ?? []).some((n) => {
    const days = (Date.now() - new Date(n.date).getTime()) / 86400000
    return days <= 30
  })
  const newsScore = hasRecentNews ? 30 : 10
  const readinessScore = Math.round(painScore + maxContactScore + newsScore)
  const scoreColor =
    readinessScore >= 70 ? "text-green-700 bg-green-50 border-green-200"
    : readinessScore >= 40 ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-red-700 bg-red-50 border-red-200"

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
      {/* Company identity bar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-muted border border-border/60 flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-muted-foreground"  strokeWidth={1.5} />
        </div>
        <p className="text-[13px] font-semibold text-muted-foreground flex items-center gap-1.5">
          {company.name}
          <span className="text-border">·</span>
          <Globe className="w-3 h-3"  strokeWidth={1.5} />
          {company.url}
        </p>
      </div>

      {(company.painPoints?.length ?? 0) > 0 && (
        <div className="mb-4">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${scoreColor}`}>
            Siap untuk outreach: {readinessScore}/100
          </span>
        </div>
      )}

      {/* Strategic title */}
      {sr?.strategicTitle ? (
        <>
          <h2 className="text-2xl font-bold tracking-tight text-foreground leading-snug mb-4">
            {sr.strategicTitle}
          </h2>

          {/* Executive insight blockquote */}
          {sr.executiveInsight && (
            <blockquote className="border-l-4 border-brand pl-5 py-1">
              <p className="text-[14.5px] italic text-foreground/80 leading-relaxed">
                {sr.executiveInsight}
              </p>
            </blockquote>
          )}

          {/* Situational brief for DM */}
          {sr?.situationalSummary && (
            <div className="mt-4 bg-muted/50 border border-border/50 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Situational Brief untuk DM
              </p>
              <p className="text-[13px] text-foreground/80 leading-relaxed">
                {sr.situationalSummary}
              </p>
            </div>
          )}
        </>
      ) : (
        /* Fallback: show company name + description if no strategic report */
        <>
          <h2 className="text-xl font-bold tracking-tight text-foreground mb-3">{company.name}</h2>
          {company.description && (
            <p className="text-[13.5px] text-foreground/75 leading-relaxed whitespace-pre-line max-h-32 overflow-y-auto">
              {company.description}
            </p>
          )}
        </>
      )}
    </div>
  )
}
