"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { OutOfCreditsModal } from "@/components/ui/OutOfCreditsModal"
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget"
import { EarlyAccessBanner } from "@/components/layout/EarlyAccessBanner"
import { OnboardingModal } from "@/components/onboarding/OnboardingModal"
import { supabase } from "@/lib/supabase/client"
import { getUserProfile } from "@/lib/api/profile"

const ONBOARDING_KEY = "campfire_onboarding_done"

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // Fix hydration error: always start ready=true on both server and client to match SSR HTML.
  const [ready, setReady] = useState(true)

  useEffect(() => {
    if (pathname === "/onboarding" || pathname?.startsWith("/settings")) {
      return
    }

    // Already confirmed via localStorage — skip DB check
    if (localStorage.getItem(ONBOARDING_KEY) === "true") {
      return
    }

    async function checkOnboarding() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { return }

      const profile = await getUserProfile()
      if (!profile || profile.onboarding_completed === false) {
        setReady(false)
        router.push("/onboarding")
        return
      }

      localStorage.setItem(ONBOARDING_KEY, "true")
    }

    checkOnboarding()
  }, [pathname, router])

  if (!ready) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto bg-background">
        <EarlyAccessBanner />
        {children}
      </main>
      <OutOfCreditsModal />
      <FeedbackWidget />
      <OnboardingModal />
    </div>
  )
}
