"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Gift, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getBalance, getTransactions, formatRupiah, CreditTransaction } from "@/lib/api/credits"
import { flags } from "@/lib/config/feature-flags"

// ─── Type config ────────────────────────────────────────────────────────────

const TX_META: Record<string, { label: string; color: string; icon: typeof ArrowUpRight }> = {
  purchase: { label: "Top-Up",    color: "text-brand",   icon: ArrowUpRight },
  grant:    { label: "Bonus",     color: "text-brand",   icon: Gift },
  debit:    { label: "Pemakaian", color: "text-danger",  icon: ArrowDownLeft },
  refund:   { label: "Refund",    color: "text-info",    icon: RotateCcw },
}

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
  const router = useRouter()
  const [balance, setBalance] = useState<number | null>(null)
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Riwayat Transaksi</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">
            Catatan lengkap semua aktivitas kredit di akunmu.
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
            Kembali ke Pricing
          </Button>
        )}
      </div>

      {/* Balance card — Top-Up button is billing-gated. */}
      <div className="rounded-2xl border border-brand/30 bg-brand/5 p-6 mb-8 flex items-center justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground font-medium uppercase tracking-wider">Saldo Saat Ini</p>
          <p className="text-3xl font-black text-brand mt-1">
            {balance !== null ? `${balance} kredit` : "—"}
          </p>
        </div>
        {flags.BILLING_ACTIVE ? (
          <Button
            className="rounded-full font-semibold bg-brand hover:bg-brand/90 text-white"
            onClick={() => router.push("/pricing")}
          >
            Top-Up Kredit →
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
          <p className="text-[13.5px] text-muted-foreground mt-3">Memuat riwayat transaksi...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="py-16 text-center border border-border/40 rounded-2xl bg-white">
          <p className="text-muted-foreground text-[14px]">
            {flags.BILLING_ACTIVE
              ? "Belum ada transaksi. Mulai dengan membeli paket kredit."
              : "Belum ada transaksi. Kredit Early Access akan muncul di sini ketika kamu mulai menggunakan pipeline."}
          </p>
        </div>
      ) : (
        <div className="border border-border/40 rounded-2xl bg-white overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-3 border-b border-border/40 bg-surface text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Deskripsi</span>
            <span className="text-right w-24">Kredit</span>
            <span className="text-right w-40">Waktu</span>
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
