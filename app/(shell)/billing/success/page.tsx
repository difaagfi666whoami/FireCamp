"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getBalance } from "@/lib/api/credits"
import { useLanguage } from "@/lib/i18n/LanguageContext"

export default function BillingSuccessPage() {
  const { t } = useLanguage()
  const [balance, setBalance] = useState<number | null>(null)

  // The Stripe webhook may take a moment to fire. Poll a few times.
  useEffect(() => {
    let attempts = 0
    let cancelled = false

    async function poll() {
      while (!cancelled && attempts < 6) {
        const b = await getBalance()
        if (!cancelled) setBalance(b)
        attempts++
        await new Promise((r) => setTimeout(r, 1500))
      }
    }
    poll()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center bg-white border border-border/60 rounded-2xl p-10 shadow-sm">
        <div className="w-16 h-16 mx-auto rounded-full bg-success/10 border border-success/30 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-success" strokeWidth={1.6} />
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-2">{t("Payment Successful")}</h1>
        <p className="text-muted-foreground text-[14.5px] mb-8 leading-relaxed">
          {t("Thank you! Credits are being added to your account. This usually completes within a few seconds.")}
        </p>

        {balance === null ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-3">
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
            <span className="text-sm font-medium">{t("Checking balance...")}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand/5 border border-brand/20 mb-8">
            <Sparkles className="w-4 h-4 text-brand" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold text-brand">
              {t("Balance:")} <span className="font-bold">{balance} credits</span>
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2 mt-4">
          <Link
            href="/research-library"
            className="inline-flex items-center justify-center bg-brand hover:bg-brand/90 text-white rounded-full px-6 py-2.5 font-semibold text-[13.5px] transition-colors"
          >
            {t("Start Recon →")}
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-full px-6 py-2 text-muted-foreground hover:text-foreground text-[13px] font-medium transition-colors"
          >
            {t("← Back to pricing")}
          </Link>
        </div>
      </div>
    </div>
  )
}
