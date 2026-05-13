"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { flags } from "@/lib/config/feature-flags"
import { useLanguage } from "@/lib/i18n/LanguageContext"

export function OutOfCreditsModal() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    const handler = () => setIsOpen(true)
    window.addEventListener("campfire_out_of_credits", handler)
    return () => window.removeEventListener("campfire_out_of_credits", handler)
  }, [])

  if (!isOpen) return null

  // When billing is disabled (Early Access), there's no top-up path — bounce
  // the user to the feedback widget so they can tell us they need more credits.
  const billingActive = flags.BILLING_ACTIVE

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200 border border-border/40">
        <div className="w-12 h-12 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center mb-5">
          <AlertCircle className="w-6 h-6 text-danger" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-foreground mb-2">
          {t("Credits Depleted")}
        </h2>
        <p className="text-[14px] text-muted-foreground leading-relaxed mb-8">
          {billingActive
            ? t("This operation requires AI credits, but your account balance is insufficient. Please top up credits to continue.")
            : t("This operation requires AI credits, but your Early Access balance is depleted. Let us know if you need more credits.")}
        </p>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="flex-1 rounded-full font-semibold"
            onClick={() => setIsOpen(false)}
          >
            {t("Cancel")}
          </Button>
          <Button
            className="flex-1 rounded-full font-semibold bg-brand hover:bg-brand/90 text-white"
            onClick={() => {
              setIsOpen(false)
              if (billingActive) {
                router.push("/pricing")
              } else {
                window.dispatchEvent(new Event("campfire_open_feedback"))
              }
            }}
          >
            {billingActive ? t("Buy Credits →") : t("Send Feedback →")}
          </Button>
        </div>
      </div>
    </div>
  )
}
