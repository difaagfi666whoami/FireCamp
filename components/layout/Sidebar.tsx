"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BookOpen, Search, Crosshair, Wand2, CheckSquare,
  Rocket, BarChart2, Flame, Building2, X, LogOut, Settings, FlaskConical,
  Sparkles,
} from "lucide-react"
import { isMockMode, setDemoMode } from "@/lib/demoMode"
import { cn } from "@/lib/utils"
import { session } from "@/lib/session"
import { supabase } from "@/lib/supabase/client"
import { getUserProfile } from "@/lib/api/profile"
import { getBalance } from "@/lib/api/credits"
import { flags } from "@/lib/config/feature-flags"
import { useEffect, useState } from "react"

const PIPELINE_STEPS = [
  { href: "/recon",   label: "Recon",   icon: Search,      step: 1 },
  { href: "/match",   label: "Match",   icon: Crosshair,   step: 2 },
  { href: "/craft",   label: "Craft",   icon: Wand2,       step: 3 },
  { href: "/polish",  label: "Polish",  icon: CheckSquare, step: 4 },
  { href: "/launch",  label: "Launch",  icon: Rocket,      step: 5 },
  { href: "/pulse",   label: "Pulse",   icon: BarChart2,   step: 6 },
]

type StageProgress = {
  recon:  boolean
  match:  boolean
  craft:  boolean
  polish: boolean
  launch: boolean
  pulse:  boolean
}

const EMPTY_PROGRESS: StageProgress = {
  recon: false, match: false, craft: false, polish: false, launch: false, pulse: false,
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [activeCompany, setActiveCompany] = useState<string | null>(null)
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)
  const [demoMode, setDemoModeState] = useState(false)
  const [progress, setProgress] = useState<StageProgress>(EMPTY_PROGRESS)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)

  useEffect(() => {
    async function loadUserData() {
      const [{ data: authData }, profile, bal] = await Promise.all([
        supabase.auth.getUser(),
        getUserProfile(),
        getBalance().catch(() => 0),
      ])
      setUserEmail(authData?.user?.email ?? null)
      setWorkspaceName(profile?.workspace_name?.trim() || null)
      setCreditBalance(bal)
      setDemoModeState(isMockMode())
    }
    loadUserData()

    // Re-fetch when settings page saves a profile change OR credits change.
    window.addEventListener("campfire_profile_changed", loadUserData)
    window.addEventListener("campfire_credits_changed", loadUserData)
    // Refetch when user comes back to the tab (caught a webhook? finished a Recon?).
    window.addEventListener("focus", loadUserData)
    return () => {
      window.removeEventListener("campfire_profile_changed", loadUserData)
      window.removeEventListener("campfire_credits_changed", loadUserData)
      window.removeEventListener("focus", loadUserData)
    }
  }, [])

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

  // Refresh pipeline progress dots whenever active target changes or pathname flips.
  // RLS scopes the row to the current user automatically.
  useEffect(() => {
    if (!activeCompanyId) {
      setProgress(EMPTY_PROGRESS)
      return
    }
    let cancelled = false
    supabase
      .from("companies")
      .select("progress_recon, progress_match, progress_craft, progress_polish, progress_launch, progress_pulse")
      .eq("id", activeCompanyId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setProgress({
          recon:  !!data.progress_recon,
          match:  !!data.progress_match,
          craft:  !!data.progress_craft,
          polish: !!data.progress_polish,
          launch: !!data.progress_launch,
          pulse:  !!data.progress_pulse,
        })
      })
    return () => { cancelled = true }
  }, [activeCompanyId, pathname])

  const handleDemoToggle = () => {
    const next = !demoMode
    setDemoMode(next)
    setDemoModeState(next)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    session.clearActiveTarget()
    window.location.href = "/login"
  }

  const reconHref = activeCompanyId ? `/recon/${activeCompanyId}` : "/recon"

  const resolvedSteps = PIPELINE_STEPS.map(s => {
    const stageKey = s.label.toLowerCase() as keyof StageProgress
    const done = progress[stageKey] ?? false
    return s.href === "/recon" ? { ...s, href: reconHref, done } : { ...s, done }
  })

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
              <Building2 className="w-3 h-3 text-brand shrink-0"  strokeWidth={1.5} />
              <p className="text-[12px] font-semibold text-brand truncate">{activeCompany}</p>
            </div>
          </button>
          <button
            onClick={() => { session.clearActiveTarget(); router.push("/recon") }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-brand/60 hover:text-brand hover:bg-brand/10 transition-colors border-t border-brand/10"
          >
            <X className="w-3 h-3"  strokeWidth={1.5} />
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
        <BookOpen className="w-4 h-4 shrink-0"  strokeWidth={1.5} />
        Research Library
      </Link>

      {/* Divider */}
      <div className="border-t border-border/50 my-3 mx-1" />

      {/* Pipeline */}
      <p className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-1">
        Pipeline
      </p>

      {resolvedSteps.map(({ href, label, icon: Icon, step, done }) => {
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
            <span className="flex-1">{label}</span>
            {done && (
              <span
                title="Tahap ini sudah selesai"
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  active ? "bg-white" : "bg-success"
                )}
              />
            )}
          </Link>
        )
      })}

      {/* Divider */}
      <div className="border-t border-border/50 my-3 mx-1" />

      {/* Credit balance + Beli Credits — billing-gated.
          When BILLING_ACTIVE is false (Early Access), show a non-clickable
          badge with the current balance instead of a "Beli Kredit" CTA. */}
      {flags.BILLING_ACTIVE ? (
        <Link
          href="/pricing"
          className={cn(
            "mx-1 mb-1 px-3 py-2.5 rounded-xl border transition-colors flex items-center justify-between",
            pathname === "/pricing"
              ? "bg-brand text-white border-brand shadow-sm"
              : "bg-brand/5 border-brand/20 hover:bg-brand/10"
          )}
        >
          <p
            className={cn(
              "text-[11.5px] font-bold uppercase tracking-widest",
              pathname === "/pricing" ? "text-white" : "text-brand"
            )}
          >
            Beli Kredit
          </p>
          <span className={cn(
            "text-[14px] leading-none",
            pathname === "/pricing" ? "text-white/80" : "text-brand/60"
          )}>
            →
          </span>
        </Link>
      ) : (
        <div className="mx-1 mb-1 px-3 py-2.5 rounded-xl border border-brand/20 bg-brand/5 flex items-center justify-between">
          <p className="text-[11.5px] font-bold uppercase tracking-widest text-brand/80">
            Early Access
          </p>
          <span className="text-[12px] font-semibold tabular-nums text-brand">
            {creditBalance ?? 0} kredit
          </span>
        </div>
      )}

      {/* Demo Mode Toggle */}
      <button
        onClick={handleDemoToggle}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-medium transition-colors w-full text-left",
          demoMode
            ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <FlaskConical className="w-4 h-4 shrink-0" strokeWidth={1.5} />
        {demoMode ? "Mode Demo: Aktif" : "Mode Demo"}
      </button>

      {/* Guide */}
      <Link
        href="/guide"
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-medium transition-colors",
          pathname === "/guide"
            ? "bg-brand text-white font-semibold shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <BookOpen className="w-4 h-4 shrink-0" strokeWidth={1.5} />
        Panduan
      </Link>

      {/* Settings */}
      <Link
        href="/settings"
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-medium transition-colors",
          pathname === "/settings"
            ? "bg-brand text-white font-semibold shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Settings className="w-4 h-4 shrink-0" strokeWidth={1.5} />
        Pengaturan
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer: User + Logout */}
      <div className="px-3 pt-3 border-t border-border/50 mx-1">
        <div className="flex items-center gap-2">
          {/* Avatar */}
          {userEmail ? (
            <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-brand">
                {userEmail[0].toUpperCase()}
              </span>
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full bg-muted shrink-0" />
          )}

          {/* Name + Email */}
          <div className="flex-1 min-w-0">
            {workspaceName && (
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                {workspaceName}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground truncate">
              {userEmail ?? ""}
            </p>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Keluar"
            className="shrink-0 p-1 rounded-md text-muted-foreground/60 hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/40 mt-1">v0.1.0 · Live</p>
      </div>
    </aside>
  )
}
