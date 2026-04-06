import { CompanyProfile } from "@/types/recon.types"
import { Globe, Building2 } from "lucide-react"

export function CompanyHeader({ company }: { company: CompanyProfile }) {
  const sr = company.strategicReport

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
      {/* Company identity bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-muted border border-border/60 flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-muted-foreground" />
        </div>
        <p className="text-[13px] font-semibold text-muted-foreground flex items-center gap-1.5">
          {company.name}
          <span className="text-border">·</span>
          <Globe className="w-3 h-3" />
          {company.url}
        </p>
      </div>

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
