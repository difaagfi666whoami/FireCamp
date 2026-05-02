"use client"

import { useEffect, useState, useCallback } from "react"
import { Loader2, RefreshCw, CheckCircle2, Clock, AlertCircle, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { type XenditPayment, type XenditPaymentStatus, getXenditPaymentStatus } from "@/lib/api/xendit"
import { formatRupiah, getBalance, notifyCreditsChanged } from "@/lib/api/credits"

interface Props {
  payment:   XenditPayment
  onSuccess: (newBalance: number) => void
  onExpired: () => void
}

const POLL_INTERVAL_MS = 5_000

const TRANSFER_STEPS: Record<string, string[]> = {
  BCA:     ["Buka BCA Mobile / KlikBCA", "Pilih Transfer → ke Rekening BCA", "Masukkan nomor VA di atas", "Masukkan nominal yang tepat", "Konfirmasi & selesaikan transfer"],
  MANDIRI: ["Buka Livin' by Mandiri / ATM Mandiri", "Pilih Bayar → Multi Payment", "Masukkan kode perusahaan: 88908", "Masukkan nomor VA di atas", "Ikuti instruksi selanjutnya"],
  BNI:     ["Buka BNI Mobile Banking / ATM BNI", "Pilih Transfer → ke Rekening BNI", "Masukkan nomor VA di atas", "Masukkan nominal yang tepat", "Konfirmasi & selesaikan transfer"],
  BRI:     ["Buka BRImo / ATM BRI", "Pilih Pembayaran → BRIVA", "Masukkan nomor VA di atas", "Masukkan nominal yang tepat", "Konfirmasi & selesaikan transfer"],
  PERMATA: ["Buka PermataMobile X / ATM Permata", "Pilih Bayar → Virtual Account", "Masukkan nomor VA di atas", "Masukkan nominal yang tepat", "Konfirmasi & selesaikan transfer"],
}

export function VAPayment({ payment, onSuccess, onExpired }: Props) {
  const expiresMs = payment.expires_at ? new Date(payment.expires_at).getTime() : Date.now() + 24 * 60 * 60 * 1000
  const totalSecs = Math.round((expiresMs - Date.now()) / 1000)

  const [secondsLeft, setSecondsLeft] = useState(Math.max(0, Math.round((expiresMs - Date.now()) / 1000)))
  const [status, setStatus]           = useState<XenditPaymentStatus>("PENDING")
  const [checking, setChecking]       = useState(false)

  const bankCode  = payment.bank_code ?? ""
  const bankName  = payment.bank_name ?? bankCode
  const vaNumber  = payment.va_number ?? "—"
  const steps     = TRANSFER_STEPS[bankCode] ?? []

  const formatCountdown = (s: number) => {
    const h   = Math.floor(s / 3600)
    const m   = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}j ${m.toString().padStart(2, "0")}m`
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
  }

  const copyVA = () => {
    navigator.clipboard.writeText(vaNumber).then(() => toast("Nomor VA disalin!"))
  }

  const checkStatus = useCallback(async (showToast = false) => {
    if (status === "PAID") return
    setChecking(true)
    try {
      const result = await getXenditPaymentStatus(payment.payment_id)
      setStatus(result.status)
      if (result.status === "PAID") {
        notifyCreditsChanged()
        const balance = await getBalance()
        onSuccess(balance)
      } else if (result.status === "EXPIRED" || result.status === "FAILED") {
        onExpired()
      } else if (showToast) {
        toast("Transfer belum terdeteksi. Pastikan nominal tepat dan coba lagi.")
      }
    } catch {
      if (showToast) toast.error("Gagal cek status. Coba lagi.")
    } finally {
      setChecking(false)
    }
  }, [payment.payment_id, status, onSuccess, onExpired])

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) { onExpired(); return }
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(id); onExpired(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-poll every 5s while PENDING
  useEffect(() => {
    if (status !== "PENDING") return
    const id = setInterval(() => checkStatus(false), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [status, checkStatus])

  const isUrgent = secondsLeft < 600 // < 10 min

  return (
    <div className="flex flex-col gap-5 py-2">
      {/* Amount */}
      <div className="text-center">
        <p className="text-[13px] text-muted-foreground font-medium">Total Transfer</p>
        <p className="text-2xl font-black tracking-tight">{formatRupiah(payment.amount_idr)}</p>
        <p className="text-[12px] text-danger font-semibold mt-0.5">Nominal harus tepat sama persis</p>
      </div>

      {/* Bank + VA number */}
      <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide">Bank Tujuan</span>
          <span className="text-[14px] font-bold">{bankName}</span>
        </div>
        <div className="border-t border-brand/10 pt-3">
          <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Nomor Virtual Account</p>
          <div className="flex items-center gap-2">
            <span className="text-[22px] font-black tracking-widest text-foreground flex-1">
              {vaNumber}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={copyVA}
              className="shrink-0 h-8 px-3 rounded-lg text-[12px] border-brand/30 hover:bg-brand/5"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
              Salin
            </Button>
          </div>
        </div>
      </div>

      {/* Transfer steps */}
      {steps.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Cara Transfer
          </p>
          <ol className="space-y-1.5">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px]">
                <span className="shrink-0 w-5 h-5 rounded-full bg-brand/10 text-brand text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-foreground/80 leading-snug">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Countdown */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>VA berlaku hingga:</span>
        </div>
        <span className={`text-[13px] font-bold tabular-nums ${isUrgent ? "text-danger" : "text-foreground"}`}>
          {formatCountdown(secondsLeft)}
        </span>
      </div>

      {/* Status & actions */}
      {status === "PENDING" && (
        <Button
          onClick={() => checkStatus(true)}
          disabled={checking}
          className="w-full rounded-full bg-brand hover:bg-brand/90 text-white font-semibold text-[13.5px]"
        >
          {checking ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" strokeWidth={1.5} />Memeriksa...</>
          ) : (
            <><RefreshCw className="w-4 h-4 mr-2" strokeWidth={1.5} />Sudah Transfer? Cek Status</>
          )}
        </Button>
      )}

      {status === "PAID" && (
        <div className="flex items-center justify-center gap-2 text-success text-[14px] font-semibold">
          <CheckCircle2 className="w-5 h-5" strokeWidth={1.5} />
          Pembayaran diterima! Credits ditambahkan.
        </div>
      )}

      {(status === "EXPIRED" || status === "FAILED") && (
        <div className="flex items-center gap-2 text-danger text-[13.5px] font-medium">
          <AlertCircle className="w-4 h-4" strokeWidth={1.5} />
          {status === "EXPIRED" ? "VA sudah kadaluarsa." : "Pembayaran gagal."}
        </div>
      )}
    </div>
  )
}
