"use client"

import { useEffect, useState } from "react"
import { X, MessageSquare } from "lucide-react"
import { flags } from "@/lib/config/feature-flags"
import { getBalance } from "@/lib/api/credits"

const DISMISSED_KEY = "campfire_eap_banner_dismissed"

export function EarlyAccessBanner() {
  // Start hidden so SSR/CSR markup matches; we flip to visible on mount only
  // after we've checked the per-session dismissal flag.
  const [hidden, setHidden] = useState(true)
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    if (!flags.EARLY_ACCESS_MODE) return
    const dismissed = sessionStorage.getItem(DISMISSED_KEY) === "1"
    if (!dismissed) setHidden(false)
  }, [])

  useEffect(() => {
    if (hidden) return
    let cancelled = false
    const load = async () => {
      try {
        const b = await getBalance()
        if (!cancelled) setBalance(b)
      } catch {
        /* banner without balance is acceptable */
      }
    }
    load()
    window.addEventListener("campfire_credits_changed", load)
    return () => {
      cancelled = true
      window.removeEventListener("campfire_credits_changed", load)
    }
  }, [hidden])

  if (!flags.EARLY_ACCESS_MODE || hidden) return null

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1")
    setHidden(true)
  }

  const handleOpenFeedback = () => {
    window.dispatchEvent(new Event("campfire_open_feedback"))
  }

  return (
    <div className="bg-brand/10 border-b border-brand/20 px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xl shrink-0" aria-hidden>🎉</span>
        <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-relaxed">
          <span className="font-semibold text-foreground">
            Kamu adalah bagian dari Early Access Campfire!
          </span>
          <span className="text-muted-foreground">
            Kamu punya{" "}
            <span className="font-bold text-brand tabular-nums">
              {balance ?? "—"} kredit
            </span>
            {" "}gratis untuk dijelajahi.
          </span>
          <span className="text-muted-foreground">Ada masukan?</span>
          <button
            type="button"
            onClick={handleOpenFeedback}
            className="font-semibold text-brand hover:underline inline-flex items-center gap-1"
          >
            <MessageSquare className="w-3 h-3" strokeWidth={2.5} />
            Klik di sini →
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-brand/20 transition-colors shrink-0"
        aria-label="Tutup banner Early Access"
      >
        <X className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}
