"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { OutOfCreditsModal } from "@/components/ui/OutOfCreditsModal"
import { supabase } from "@/lib/supabase/client"
import { getUserProfile } from "@/lib/api/profile"

const ONBOARDING_KEY = "campfire_onboarding_done"

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // Synchronous fast-path: if localStorage already confirms onboarding done,
  // show content immediately without waiting for a DB round-trip.
  const [ready, setReady] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(ONBOARDING_KEY) === "true"
  })

  useEffect(() => {
    if (pathname === "/onboarding" || pathname?.startsWith("/settings")) {
      setReady(true)
      return
    }

    // Already confirmed via localStorage — skip DB check
    if (localStorage.getItem(ONBOARDING_KEY) === "true") {
      setReady(true)
      return
    }

    async function checkOnboarding() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { setReady(true); return }

      const profile = await getUserProfile()
      if (!profile || profile.onboarding_completed === false) {
        router.push("/onboarding")
        return
      }

      localStorage.setItem(ONBOARDING_KEY, "true")
      setReady(true)
    }

    checkOnboarding()
  }, [pathname, router])

  if (!ready) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto bg-background">{children}</main>
      <OutOfCreditsModal />
    </div>
  )
}
