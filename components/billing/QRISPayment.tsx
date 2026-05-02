"use client"

import { useEffect, useState, useCallback } from "react"
import { Loader2, RefreshCw, CheckCircle2, Clock, AlertCircle } from "lucide-react"
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

export function QRISPayment({ payment, onSuccess, onExpired }: Props) {
  const expiresMs = payment.expires_at ? new Date(payment.expires_at).getTime() : Date.now() + 15 * 60 * 1000
  const totalSecs = Math.round((expiresMs - Date.now()) / 1000)

  const [secondsLeft, setSecondsLeft]   = useState(Math.max(0, Math.round((expiresMs - Date.now()) / 1000)))
  const [status, setStatus]             = useState<XenditPaymentStatus>("PENDING")
  const [checking, setChecking]         = useState(false)

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0")
    const sec = (s % 60).toString().padStart(2, "0")
    return `${m}:${sec}`
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
        toast("Pembayaran belum masuk. Coba beberapa saat lagi.")
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

  const progress = totalSecs > 0 ? (secondsLeft / totalSecs) * 100 : 0
  const isUrgent = secondsLeft < 120

  // Render QR code via qrserver.com (no npm package needed)
  const qrImageUrl = payment.qr_string
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payment.qr_string)}&margin=10`
    : null

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      {/* Amount */}
      <div className="text-center">
        <p className="text-[13px] text-muted-foreground font-medium">Total Pembayaran</p>
        <p className="text-2xl font-black tracking-tight">{formatRupiah(payment.amount_idr)}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">= {payment.credits} credits</p>
      </div>

      {/* QR code */}
      {qrImageUrl ? (
        <div className="relative">
          <div className="w-[220px] h-[220px] border-2 border-brand/30 rounded-xl overflow-hidden bg-white flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrImageUrl}
              alt="QRIS QR Code"
              width={220}
              height={220}
              className="object-contain"
            />
          </div>
          {status === "PAID" && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-xl">
              <CheckCircle2 className="w-16 h-16 text-success" strokeWidth={1.5} />
            </div>
          )}
        </div>
      ) : (
        <div className="w-[220px] h-[220px] border-2 border-dashed border-border rounded-xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" strokeWidth={1.5} />
        </div>
      )}

      {/* QRIS label */}
      <p className="text-[12px] text-muted-foreground text-center leading-snug max-w-[260px]">
        Scan dengan GoPay, OVO, DANA, ShopeePay, atau aplikasi bank apapun yang mendukung QRIS.
      </p>

      {/* Countdown */}
      <div className="w-full max-w-[280px]">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Kode berlaku:</span>
          </div>
          <span className={`text-[13px] font-bold tabular-nums ${isUrgent ? "text-danger" : "text-foreground"}`}>
            {formatTime(secondsLeft)}
          </span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? "bg-danger" : "bg-brand"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Action buttons */}
      {status === "PENDING" && (
        <div className="flex flex-col gap-2 w-full max-w-[280px]">
          <Button
            onClick={() => checkStatus(true)}
            disabled={checking}
            className="w-full rounded-full bg-brand hover:bg-brand/90 text-white font-semibold text-[13.5px]"
          >
            {checking ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" strokeWidth={1.5} />Memeriksa...</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" strokeWidth={1.5} />Sudah Bayar? Cek Status</>
            )}
          </Button>
        </div>
      )}

      {status === "PAID" && (
        <div className="flex items-center gap-2 text-success text-[14px] font-semibold">
          <CheckCircle2 className="w-5 h-5" strokeWidth={1.5} />
          Pembayaran berhasil! Credits ditambahkan.
        </div>
      )}

      {(status === "EXPIRED" || status === "FAILED") && (
        <div className="flex items-center gap-2 text-danger text-[13.5px] font-medium">
          <AlertCircle className="w-4 h-4" strokeWidth={1.5} />
          {status === "EXPIRED" ? "QR kode kadaluarsa." : "Pembayaran gagal."}
        </div>
      )}
    </div>
  )
}
