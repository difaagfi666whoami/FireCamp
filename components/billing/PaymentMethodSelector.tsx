"use client"

import { useState } from "react"
import { Loader2, QrCode, Building2, CreditCard, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  type XenditPayment,
  type XenditPaymentMethod,
  type BankOption,
  VA_BANKS,
  createXenditPayment,
} from "@/lib/api/xendit"
import { type CreditPack, formatRupiah } from "@/lib/api/credits"
import { QRISPayment } from "./QRISPayment"
import { VAPayment } from "./VAPayment"

type Step = "select" | "qris" | "va" | "success"

interface Props {
  pack:        CreditPack
  onStripe:    () => void           // existing Stripe flow
  onSuccess:   (balance: number) => void
  onClose:     () => void
}

export function PaymentMethodSelector({ pack, onStripe, onSuccess, onClose }: Props) {
  const [step, setStep]           = useState<Step>("select")
  const [payment, setPayment]     = useState<XenditPayment | null>(null)
  const [creating, setCreating]   = useState<XenditPaymentMethod | null>(null)
  const [newBalance, setNewBalance] = useState<number | null>(null)

  const handleXendit = async (method: XenditPaymentMethod) => {
    setCreating(method)
    try {
      const p = await createXenditPayment(pack.id, method)
      setPayment(p)
      setStep(method === "QRIS" ? "qris" : "va")
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal membuat pembayaran. Coba lagi.")
    } finally {
      setCreating(null)
    }
  }

  const handleSuccess = (balance: number) => {
    setNewBalance(balance)
    setStep("success")
    onSuccess(balance)
  }

  const handleExpired = () => {
    toast("Pembayaran kadaluarsa. Buat pembayaran baru.")
    setStep("select")
    setPayment(null)
  }

  const back = () => {
    setStep("select")
    setPayment(null)
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="w-16 h-16 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold">Pembayaran Berhasil!</h3>
          <p className="text-[14px] text-muted-foreground mt-1">
            {pack.credits} credits telah ditambahkan ke akun kamu.
          </p>
          {newBalance !== null && (
            <p className="text-[15px] font-bold text-brand mt-2">
              Saldo sekarang: {newBalance} credits
            </p>
          )}
        </div>
        <Button
          onClick={onClose}
          className="rounded-full bg-brand hover:bg-brand/90 text-white font-semibold text-[13.5px] px-8 mt-2"
        >
          Tutup
        </Button>
      </div>
    )
  }

  // ── QRIS payment screen ─────────────────────────────────────────────────────
  if (step === "qris" && payment) {
    return (
      <div>
        <button onClick={back} className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          Ganti metode bayar
        </button>
        <QRISPayment payment={payment} onSuccess={handleSuccess} onExpired={handleExpired} />
      </div>
    )
  }

  // ── VA payment screen ───────────────────────────────────────────────────────
  if (step === "va" && payment) {
    return (
      <div>
        <button onClick={back} className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          Ganti metode bayar
        </button>
        <VAPayment payment={payment} onSuccess={handleSuccess} onExpired={handleExpired} />
      </div>
    )
  }

  // ── Method selection screen ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      {/* Pack summary */}
      <div className="bg-surface border border-border/60 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">Paket dipilih</p>
          <p className="font-bold text-[15px]">{pack.name} — {pack.credits} credits</p>
        </div>
        <p className="text-[18px] font-black text-brand">{formatRupiah(pack.price_idr)}</p>
      </div>

      {/* QRIS */}
      <div>
        <p className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Scan QRIS
        </p>
        <button
          onClick={() => handleXendit("QRIS")}
          disabled={creating !== null}
          className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-white hover:border-brand/40 hover:bg-brand/5 transition-all text-left disabled:opacity-50"
        >
          <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <QrCode className="w-5 h-5 text-brand" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[13.5px]">QRIS</p>
            <p className="text-[12px] text-muted-foreground">GoPay · OVO · DANA · ShopeePay · semua bank</p>
          </div>
          {creating === "QRIS" && (
            <Loader2 className="w-4 h-4 animate-spin text-brand shrink-0" strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* Virtual Account */}
      <div>
        <p className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Transfer Virtual Account
        </p>
        <div className="grid grid-cols-2 gap-2">
          {VA_BANKS.map((bank: BankOption) => (
            <button
              key={bank.code}
              onClick={() => handleXendit(bank.code)}
              disabled={creating !== null}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-white hover:border-brand/40 hover:bg-brand/5 transition-all text-left disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <span className="font-semibold text-[13px]">{bank.short}</span>
              {creating === bank.code && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand ml-auto shrink-0" strokeWidth={1.5} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stripe / card */}
      <div>
        <p className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Kartu Kredit / Debit
        </p>
        <button
          onClick={onStripe}
          disabled={creating !== null}
          className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-white hover:border-border hover:bg-muted/30 transition-all text-left disabled:opacity-50"
        >
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-semibold text-[13.5px]">Kartu Kredit / Debit</p>
            <p className="text-[12px] text-muted-foreground">Visa · Mastercard via Stripe</p>
          </div>
        </button>
      </div>
    </div>
  )
}
