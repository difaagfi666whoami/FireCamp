"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Gift, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getBalance, getTransactions, formatRupiah, CreditTransaction } from "@/lib/api/credits"
import { flags } from "@/lib/config/feature-flags"
import { useLanguage } from "@/lib/i18n/LanguageContext"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function BillingHistoryPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [balance, setBalance] = useState<number | null>(null)

  const TX_META: Record<string, { label: string; color: string; icon: typeof ArrowUpRight }> = {
    purchase: { label: t("Top-Up"),   color: "text-brand",   icon: ArrowUpRight },
    grant:    { label: t("Bonus"),    color: "text-brand",   icon: Gift },
    debit:    { label: t("Usage"),    color: "text-danger",  icon: ArrowDownLeft },
    refund:   { label: t("Refund"),   color: "text-info",    icon: RotateCcw },
  }
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [b, txs] = await Promise.all([getBalance(), getTransactions()])
      setBalance(b)
      setTransactions(txs)
      setIsLoading(false)
    }
    load()
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("Transaction History")}</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">
            {t("Complete record of all credit activity in your account.")}
          </p>
        </div>
        {flags.BILLING_ACTIVE && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full font-semibold"
            onClick={() => router.push("/pricing")}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            {t("Back to Pricing")}
          </Button>
        )}
      </div>

      {/* Balance card — Top-Up button is billing-gated. */}
      <div className="rounded-2xl border border-brand/30 bg-brand/5 p-6 mb-8 flex items-center justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground font-medium uppercase tracking-wider">{t("Current Balance")}</p>
          <p className="text-3xl font-black text-brand mt-1">
            {balance !== null ? t("{balance} credits", { balance }) : "—"}
          </p>
        </div>
        {flags.BILLING_ACTIVE ? (
          <Button
            className="rounded-full font-semibold bg-brand hover:bg-brand/90 text-white"
            onClick={() => router.push("/pricing")}
          >
            {t("Top-Up Credits →")}
          </Button>
        ) : (
          <span className="text-[11.5px] font-bold uppercase tracking-widest text-brand/70 px-3 py-1.5 rounded-full bg-white/60 border border-brand/20">
            Early Access
          </span>
        )}
      </div>

      {/* Transaction list */}
      {isLoading ? (
        <div className="py-16 text-center">
          <div className="inline-block w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
          <p className="text-[13.5px] text-muted-foreground mt-3">{t("Loading transaction history...")}</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="py-16 text-center border border-border/40 rounded-2xl bg-white">
          <p className="text-muted-foreground text-[14px]">
            {flags.BILLING_ACTIVE
              ? t("No transactions yet. Start by purchasing a credit pack.")
              : t("No transactions yet. Early Access credits will appear here when you start using the pipeline.")}
          </p>
        </div>
      ) : (
        <div className="border border-border/40 rounded-2xl bg-white overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-3 border-b border-border/40 bg-surface text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>{t("Description")}</span>
            <span className="text-right w-24">{t("Credits")}</span>
            <span className="text-right w-40">{t("Time")}</span>
          </div>

          {/* Rows */}
          {transactions.map((tx) => {
            const meta = TX_META[tx.type] ?? TX_META.debit
            const Icon = meta.icon
            const isPositive = tx.amount > 0

            return (
              <div
                key={tx.id}
                className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-4 border-b border-border/20 last:border-0 items-center hover:bg-surface/50 transition-colors"
              >
                {/* Description */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isPositive ? "bg-brand/10" : "bg-danger/10"}`}>
                    <Icon className={`w-4 h-4 ${meta.color}`} />
                  </div>
                  <div className="min-w-0">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${meta.color}`}>
                      {meta.label}
                    </span>
                    <p className="text-[13px] text-foreground truncate">{tx.description || "—"}</p>
                  </div>
                </div>

                {/* Amount */}
                <span className={`text-right w-24 font-bold text-[14px] tabular-nums ${isPositive ? "text-brand" : "text-danger"}`}>
                  {isPositive ? "+" : ""}{tx.amount}
                </span>

                {/* Time */}
                <span className="text-right w-40 text-[12.5px] text-muted-foreground tabular-nums">
                  {formatDate(tx.created_at)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
