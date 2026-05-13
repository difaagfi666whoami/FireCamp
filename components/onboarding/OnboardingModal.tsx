"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Flame, MessageSquare, ArrowRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { flags } from "@/lib/config/feature-flags"
import { getUserProfile, markEarlyAccessSeen } from "@/lib/api/profile"
import { getBalance } from "@/lib/api/credits"
import { useLanguage } from "@/lib/i18n/LanguageContext"

const SEEN_CACHE_KEY = "campfire_eap_seen"

type Step = 1 | 2 | 3

export function OnboardingModal() {
  const router = useRouter()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [balance, setBalance] = useState<number>(flags.FREE_CREDITS_ON_SIGNUP)

  useEffect(() => {
    if (!flags.EARLY_ACCESS_MODE) return
    // Cache hit → never query the DB again on this device.
    if (localStorage.getItem(SEEN_CACHE_KEY) === "true") return

    let cancelled = false
    const check = async () => {
      const profile = await getUserProfile()
      if (cancelled || !profile) return

      if (profile.early_access_seen) {
        localStorage.setItem(SEEN_CACHE_KEY, "true")
        return
      }
      // Only show after the user has finished business-identity onboarding —
      // otherwise the shell layout would have bounced them to /onboarding.
      if (!profile.onboarding_completed) return

      setOpen(true)
      getBalance()
        .then((b) => { if (!cancelled) setBalance(b) })
        .catch(() => { /* keep default */ })
    }
    check()
    return () => { cancelled = true }
  }, [])

  if (!flags.EARLY_ACCESS_MODE) return null

  const dismiss = () => {
    setOpen(false)
    localStorage.setItem(SEEN_CACHE_KEY, "true")
    void markEarlyAccessSeen()
  }

  const handleTryRecon = () => {
    dismiss()
    router.push("/recon")
  }

  const stepIcon =
    step === 1 ? <Sparkles className="w-7 h-7 text-brand" />
    : step === 2 ? <Flame className="w-7 h-7 text-brand" />
    : <MessageSquare className="w-7 h-7 text-brand" />

  const stepTitle =
    step === 1 ? t("Welcome to Early Access!")
    : step === 2 ? t("How Campfire works")
    : t("Your feedback matters")

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss() }}>
      <DialogContent className="max-w-md">
        <div className="flex items-center justify-center gap-1.5 pb-1">
          {([1, 2, 3] as Step[]).map((n) => (
            <div
              key={n}
              className={cn(
                "h-1.5 rounded-full transition-all",
                n === step ? "w-6 bg-brand" : n < step ? "w-1.5 bg-brand/40" : "w-1.5 bg-muted",
              )}
            />
          ))}
        </div>

        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center mb-2">
            {stepIcon}
          </div>
          <DialogTitle className="text-[20px] font-bold tracking-tight">
            {stepTitle}
          </DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed text-muted-foreground pt-1">
            {step === 1 && t("You are one of the first users of Campfire. You have {balance} credits to get started.", { balance })}
            {step === 2 && t("Campfire works in 6 steps: Recon → Match → Craft → Polish → Launch → Pulse. Start from Recon — enter the name of the company you want to prospect.")}
            {step === 3 && t("The Feedback button is always at the bottom right corner. Click anytime to give feedback, report a bug, or request a feature.")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 pt-2">
          {step === 1 && (
            <Button
              onClick={() => setStep(2)}
              className="w-full rounded-full bg-brand hover:bg-brand/90 text-white font-semibold"
            >
              {t("Get Started")}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          )}
          {step === 2 && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(3)}
                className="flex-1 rounded-full font-semibold"
              >
                {t("Skip for now")}
              </Button>
              <Button
                onClick={handleTryRecon}
                className="flex-1 rounded-full bg-brand hover:bg-brand/90 text-white font-semibold"
              >
                {t("Try Recon")}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </>
          )}
          {step === 3 && (
            <Button
              onClick={dismiss}
              className="w-full rounded-full bg-brand hover:bg-brand/90 text-white font-semibold"
            >
              {t("Close and start")}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
