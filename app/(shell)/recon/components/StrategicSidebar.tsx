import { CompanyProfile } from "@/types/recon.types"
import { Globe, MapPin, Building2, Users, TrendingUp } from "lucide-react"

function isZeroValue(v: string | number | null | undefined): boolean {
  if (v === null || v === undefined || v === "") return true
  const s = String(v).trim()
  return s === "0" || s === "0%" || s === "0.0" || s === "0.0%"
}

interface Props {
  company: CompanyProfile
}

export function StrategicSidebar({ company }: Props) {
  const li = company.linkedin
  const hasFollowers = !isZeroValue(li?.followers)
  const hasEmployees = !isZeroValue(li?.employees)
  const hasGrowth    = !isZeroValue(li?.growth)
  const hasLinkedIn  = hasFollowers || hasEmployees || hasGrowth

  const identityItems = [
    { icon: <Building2 className="w-3 h-3"  strokeWidth={1.5} />, label: "Industri", value: company.industry },
    { icon: <MapPin className="w-3 h-3"  strokeWidth={1.5} />, label: "Kantor Pusat", value: company.hq },
    { icon: <Globe className="w-3 h-3"  strokeWidth={1.5} />, label: "Ukuran", value: company.size },
    { icon: null, label: "Berdiri", value: company.founded ? `Est. ${company.founded}` : "" },
  ].filter(i => i.value)

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      {hasLinkedIn && (
        <div className="bg-white border border-border/60 rounded-2xl p-5 shadow-sm">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Key Metrics
          </p>
          <div className="space-y-3">
            {hasFollowers && (
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-brand"  strokeWidth={1.5} />
                  Followers LinkedIn
                </span>
                <span className="text-[13px] font-black text-foreground">{li.followers}</span>
              </div>
            )}
            {hasEmployees && (
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-brand"  strokeWidth={1.5} />
                  Jumlah Karyawan
                </span>
                <span className="text-[13px] font-black text-foreground">{li.employees}</span>
              </div>
            )}
            {hasGrowth && (
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-success"  strokeWidth={1.5} />
                  YoY Growth
                </span>
                <span className="text-[13px] font-black text-emerald-600">{li.growth}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Core Identity */}
      {identityItems.length > 0 && (
        <div className="bg-white border border-border/60 rounded-2xl p-5 shadow-sm">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Core Identity
          </p>
          <div className="space-y-2.5">
            {identityItems.map(item => (
              <div key={item.label} className="flex items-start justify-between gap-3">
                <span className="text-[12px] text-muted-foreground flex items-center gap-1.5 shrink-0">
                  {item.icon}
                  {item.label}
                </span>
                <span className="text-[12px] font-semibold text-foreground text-right leading-snug">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
