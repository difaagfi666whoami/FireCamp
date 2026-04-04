import { CompanyProfile } from "@/types/recon.types"
import { Globe, Users, TrendingUp, MapPin, Building2 } from "lucide-react"

export function CompanyHeader({ company }: { company: CompanyProfile }) {
  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
      {/* Top: name + badges */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-muted border border-border/60 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-[20px] font-bold tracking-tight text-foreground">{company.name}</h2>
            <p className="text-[13px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              {company.url}
              <span className="text-border">·</span>
              {company.industry}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { label: company.size },
                { label: `Est. ${company.founded}` },
                { label: company.hq, icon: <MapPin className="w-3 h-3" /> },
              ].map(b => (
                <span key={b.label} className="inline-flex items-center gap-1 text-[12px] font-medium bg-muted border border-border/60 text-muted-foreground px-2.5 py-1 rounded-full">
                  {b.icon}{b.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* LinkedIn stats */}
        <div className="flex gap-0 rounded-xl border border-border/60 overflow-hidden shrink-0 bg-slate-50 divide-x divide-border/60">
          <div className="px-5 py-3 text-center">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Followers</p>
            <p className="text-[16px] font-black text-foreground">{company.linkedin.followers}</p>
          </div>
          <div className="px-5 py-3 text-center">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Karyawan</p>
            <div className="flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[16px] font-black text-foreground">{company.linkedin.employees}</p>
            </div>
          </div>
          <div className="px-5 py-3 text-center">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">YoY Growth</p>
            <div className="flex items-center justify-center gap-1 text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
              <p className="text-[16px] font-black">{company.linkedin.growth}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {company.description && (
        <p className="text-[13.5px] text-foreground/75 leading-relaxed mt-5 pt-5 border-t border-border/40">
          {company.description}
        </p>
      )}
    </div>
  )
}
