import { PicContact } from "@/types/recon.types"
import { Mail, Phone, Users, MapPin, Clock, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Score badge config ────────────────────────────────────────────────────────

function scoreConfig(score: number) {
  if (score >= 80) return { bg: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Decision Maker" }
  if (score >= 60) return { bg: "bg-amber-100 text-amber-700 border-amber-200", label: "Influencer" }
  return { bg: "bg-zinc-100 text-zinc-600 border-zinc-200", label: "Contact" }
}

// ── Reasoning parser ──────────────────────────────────────────────────────────
// Splits "[MANDATE] ... [PAIN OWNERSHIP] ... [HOOK] ... [RECENCY] ..."
// into labeled dash-point items.

const REASONING_LABELS = ["MANDATE", "PAIN OWNERSHIP", "HOOK", "RECENCY"]

function parseReasoning(reasoning: string): { label: string; text: string }[] {
  if (!reasoning) return []

  const pattern = new RegExp(
    `\\[(${REASONING_LABELS.join("|")})\\]\\s*`,
    "gi"
  )

  const parts: { label: string; text: string }[] = []
  let match: RegExpExecArray | null
  let lastIndex = 0
  let lastLabel = ""

  while ((match = pattern.exec(reasoning)) !== null) {
    if (lastLabel && match.index > lastIndex) {
      parts.push({
        label: lastLabel,
        text: reasoning.slice(lastIndex, match.index).trim().replace(/\.$/, ""),
      })
    }
    lastLabel = match[1].toUpperCase()
    lastIndex = match.index + match[0].length
  }

  // capture final segment
  if (lastLabel && lastIndex < reasoning.length) {
    parts.push({
      label: lastLabel,
      text: reasoning.slice(lastIndex).trim().replace(/\.$/, ""),
    })
  }

  // Fallback: if no labels found, return raw as single item
  if (parts.length === 0 && reasoning.trim()) {
    return [{ label: "", text: reasoning.trim() }]
  }

  return parts
}

const LABEL_STYLE: Record<string, string> = {
  MANDATE:         "text-brand",
  "PAIN OWNERSHIP": "text-warning",
  HOOK:            "text-blue-600",
  RECENCY:         "text-zinc-500",
}

// ── Component ─────────────────────────────────────────────────────────────────

export function KeyContacts({ contacts }: { contacts: PicContact[] }) {
  if (!contacts?.length) return null

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-5 shadow-sm">
      <h3 className="font-bold text-[15px] text-foreground mb-4 flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        Key Contacts (PIC)
      </h3>

      {/* Scrollable contacts list */}
      <div className="space-y-4 max-h-[640px] overflow-y-auto pr-1">
        {contacts.map(contact => {
          const sc = scoreConfig(contact.prospectScore)
          const initials = contact.name
            .split(" ")
            .map(n => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
          const reasoningItems = parseReasoning(contact.reasoning)

          return (
            <div
              key={contact.id}
              className="rounded-xl border border-border/60 bg-slate-50/50 p-4 space-y-3"
            >
              {/* ── Header row ── */}
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-xl bg-muted border border-border/60 flex items-center justify-center text-[12px] font-black text-muted-foreground shrink-0">
                  {initials}
                </div>

                {/* Name + title */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[13.5px] text-foreground leading-tight truncate">
                    {contact.name}
                  </p>
                  <p className="text-[12px] text-muted-foreground leading-snug line-clamp-2">
                    {contact.title}
                  </p>
                </div>

                {/* Score badge */}
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className={cn(
                    "inline-flex items-center justify-center w-9 h-9 rounded-full border text-[13px] font-black",
                    sc.bg
                  )}>
                    {contact.prospectScore}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium text-right">
                    {sc.label}
                  </span>
                </div>
              </div>

              {/* ── Rich metadata ── */}
              {(contact.location || contact.connections || contact.roleDuration) && (
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {contact.location && (
                    <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                      <MapPin className="w-3 h-3 text-brand shrink-0" />
                      {contact.location}
                    </span>
                  )}
                  {contact.connections && (
                    <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                      <Users className="w-3 h-3 text-brand shrink-0" />
                      {contact.connections} koneksi
                    </span>
                  )}
                  {contact.roleDuration && (
                    <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                      <Clock className="w-3 h-3 text-brand shrink-0" />
                      {contact.roleDuration}
                    </span>
                  )}
                </div>
              )}

              {/* ── Contact info ── */}
              <div className="space-y-1.5">
                {contact.linkedinUrl && (
                  <a
                    href={contact.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[12px] text-blue-600 hover:underline font-medium"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    Lihat profil LinkedIn
                  </a>
                )}
                {contact.email && contact.email !== "-" && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-2 text-[12px] text-blue-600 hover:underline font-medium"
                  >
                    <Mail className="w-3 h-3 shrink-0" />
                    {contact.email}
                  </a>
                )}
                {contact.phone && contact.phone !== "-" && (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Phone className="w-3 h-3 shrink-0" />
                    {contact.phone}
                  </div>
                )}
              </div>

              {/* ── About ── */}
              {contact.about && (
                <p className="text-[11.5px] text-muted-foreground bg-slate-100 rounded-lg px-3 py-2 leading-relaxed">
                  {contact.about}
                </p>
              )}

              {/* ── Reasoning — parsed into labeled dash points ── */}
              {reasoningItems.length > 0 && (
                <div className="border-t border-border/40 pt-3 space-y-2">
                  <p className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                    Analisis Prospek
                  </p>
                  <ul className="space-y-1.5">
                    {reasoningItems.map((item, idx) => (
                      <li key={idx} className="flex gap-2 items-start">
                        <span className="mt-[4px] text-muted-foreground shrink-0 leading-none">—</span>
                        <p className="text-[12px] text-foreground/80 leading-snug">
                          {item.label && (
                            <span className={cn(
                              "font-bold mr-1",
                              LABEL_STYLE[item.label] ?? "text-foreground"
                            )}>
                              [{item.label}]
                            </span>
                          )}
                          {item.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
