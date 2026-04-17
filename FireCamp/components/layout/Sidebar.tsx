"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BookOpen, Search, Crosshair, Wand2, CheckSquare,
  Rocket, BarChart2, Flame, Building2, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { session } from "@/lib/session"
import { useEffect, useState } from "react"

const PIPELINE_STEPS = [
  { href: "/recon",   label: "Recon",   icon: Search,      step: 1 },
  { href: "/match",   label: "Match",   icon: Crosshair,   step: 2 },
  { href: "/craft",   label: "Craft",   icon: Wand2,       step: 3 },
  { href: "/polish",  label: "Polish",  icon: CheckSquare, step: 4 },
  { href: "/launch",  label: "Launch",  icon: Rocket,      step: 5 },
  { href: "/pulse",   label: "Pulse",   icon: BarChart2,   step: 6 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [activeCompany, setActiveCompany] = useState<string | null>(null)
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)

  const syncSession = () => {
    const profile = session.getReconProfile()
    setActiveCompany(profile?.name ?? null)
    setActiveCompanyId(session.getCompanyId() ?? null)
  }

  useEffect(() => { syncSession() }, [pathname])

  useEffect(() => {
    window.addEventListener("campfire_session_changed", syncSession)
    return () => window.removeEventListener("campfire_session_changed", syncSession)
  }, [])

  const reconHref = activeCompanyId ? `/recon/${activeCompanyId}` : "/recon"

  const resolvedSteps = PIPELINE_STEPS.map(s =>
    s.href === "/recon" ? { ...s, href: reconHref } : s
  )

  const isActive = (href: string) =>
    href.startsWith("/recon")
      ? pathname.startsWith("/recon")
      : pathname === href

  return (
    <aside className="w-56 shrink-0 border-r border-border/60 bg-white min-h-screen flex flex-col py-5 px-3 gap-1">

      {/* Logo */}
      <Link
        href="/research-library"
        className="flex items-center gap-2.5 px-3 py-2 mb-3 rounded-xl hover:bg-muted/60 transition-colors"
      >
        <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center shrink-0">
          <Flame className="w-4 h-4 text-white" strokeWidth={2} />
        </div>
        <span className="font-bold text-[15px] tracking-tight text-foreground">Campfire</span>
      </Link>

      {/* Target Aktif */}
      {activeCompany && (
        <div className="mx-1 mb-2 rounded-xl bg-brand/5 border border-brand/20 overflow-hidden">
          <button
            onClick={() => activeCompanyId && router.push(`/recon/${activeCompanyId}`)}
            className="px-3 pt-2 pb-1.5 text-left w-full hover:bg-brand/10 transition-colors cursor-pointer"
          >
            <p className="text-[10px] font-bold text-brand/70 uppercase tracking-widest mb-0.5">
              Target Aktif
            </p>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3 h-3 text-brand shrink-0" />
              <p className="text-[12px] font-semibold text-brand truncate">{activeCompany}</p>
            </div>
          </button>
          <button
            onClick={() => { session.clearActiveTarget(); router.push("/recon") }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-brand/60 hover:text-brand hover:bg-brand/10 transition-colors border-t border-brand/10"
          >
            <X className="w-3 h-3" />
            Ganti Target
          </button>
        </div>
      )}

      {/* Perpustakaan */}
      <p className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-1">
        Perpustakaan
      </p>
      <Link
        href="/research-library"
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-medium transition-colors",
          pathname === "/research-library"
            ? "bg-brand text-white font-semibold shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <BookOpen className="w-4 h-4 shrink-0" />
        Research Library
      </Link>

      {/* Divider */}
      <div className="border-t border-border/50 my-3 mx-1" />

      {/* Pipeline */}
      <p className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-1">
        Pipeline
      </p>

      {resolvedSteps.map(({ href, label, icon: Icon, step }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-medium transition-colors",
              active
                ? "bg-brand text-white font-semibold shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <div className={cn(
              "w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0",
              active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
            )}>
              {step}
            </div>
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {label}
          </Link>
        )
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="px-3 pt-3 border-t border-border/50 mx-1">
        <p className="text-[10px] text-muted-foreground/60">v0.1.0 · Live</p>
      </div>
    </aside>
  )
}
