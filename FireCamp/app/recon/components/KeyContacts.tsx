import { PicContact } from "@/types/recon.types"
import { Mail, Phone, Users } from "lucide-react"
import { cn } from "@/lib/utils"

function scoreConfig(score: number) {
  if (score >= 80) return { bg: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Decision Maker" }
  if (score >= 60) return { bg: "bg-amber-100 text-amber-700 border-amber-200", label: "Influencer" }
  return { bg: "bg-zinc-100 text-zinc-600 border-zinc-200", label: "Contact" }
}

export function KeyContacts({ contacts }: { contacts: PicContact[] }) {
  if (!contacts?.length) return null

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
      <h3 className="font-bold text-[15px] text-foreground mb-5 flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        Key Contacts (PIC)
      </h3>

      <div className="space-y-4">
        {contacts.map(contact => {
          const sc = scoreConfig(contact.prospectScore)
          const initials = contact.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
          return (
            <div key={contact.id} className="rounded-xl border border-border/60 bg-slate-50/50 p-4">
              {/* Header row */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-muted border border-border/60 flex items-center justify-center text-[12px] font-black text-muted-foreground shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[13.5px] text-foreground leading-tight">{contact.name}</p>
                  <p className="text-[12px] text-muted-foreground">{contact.title}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={cn("inline-flex items-center text-[11px] font-black px-2 py-0.5 rounded-full border", sc.bg)}>
                    {contact.prospectScore}
                  </span>
                  <span className="text-[10.5px] text-muted-foreground font-medium">{sc.label}</span>
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-1.5 mb-3">
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-[12px] text-blue-600 hover:underline font-medium">
                  <Mail className="w-3 h-3 shrink-0" />
                  {contact.email}
                </a>
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Phone className="w-3 h-3 shrink-0" />
                  {contact.phone}
                </div>
              </div>

              {/* Reasoning */}
              <p className="text-[12px] text-muted-foreground italic border-l-2 border-border pl-3 leading-relaxed">
                {contact.reasoning}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
