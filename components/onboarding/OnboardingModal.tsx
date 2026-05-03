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

const SEEN_CACHE_KEY = "campfire_eap_seen"

type Step = 1 | 2 | 3

export function OnboardingModal() {
  const router = useRouter()
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
    step === 1 ? "Selamat datang di Early Access!"
    : step === 2 ? "Cara kerja Campfire"
    : "Feedback kamu sangat berarti"

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
            {step === 1 && (
              <>
                Kamu salah satu pengguna pertama Campfire. Kamu punya{" "}
                <span className="font-bold text-brand">{balance} kredit</span>{" "}
                untuk memulai.
              </>
            )}
            {step === 2 && (
              <>
                Campfire bekerja dalam 6 langkah:{" "}
                <span className="font-semibold text-foreground">
                  Recon → Match → Craft → Polish → Launch → Pulse
                </span>
                . Mulai dari Recon — masukkan nama perusahaan yang ingin kamu
                jadikan prospek.
              </>
            )}
            {step === 3 && (
              <>
                Tombol{" "}
                <span className="font-semibold text-foreground">Feedback</span>{" "}
                selalu ada di pojok kanan bawah. Klik kapan saja untuk memberi
                masukan, lapor bug, atau minta fitur.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 pt-2">
          {step === 1 && (
            <Button
              onClick={() => setStep(2)}
              className="w-full rounded-full bg-brand hover:bg-brand/90 text-white font-semibold"
            >
              Mulai
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
                Nanti dulu
              </Button>
              <Button
                onClick={handleTryRecon}
                className="flex-1 rounded-full bg-brand hover:bg-brand/90 text-white font-semibold"
              >
                Coba Recon
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </>
          )}
          {step === 3 && (
            <Button
              onClick={dismiss}
              className="w-full rounded-full bg-brand hover:bg-brand/90 text-white font-semibold"
            >
              Tutup dan mulai
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
