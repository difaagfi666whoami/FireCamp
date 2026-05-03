"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getPackages, getBalance, createCheckout, formatRupiah, type CreditPack } from "@/lib/api/credits"
import { PaymentMethodSelector } from "@/components/billing/PaymentMethodSelector"
import { PageHelp } from "@/components/ui/PageHelp"
import { flags } from "@/lib/config/feature-flags"

function BillingDisabledPlaceholder() {
  return (
    <div className="p-8 max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="rounded-2xl border border-brand/20 bg-brand/5 p-12 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Pembelian Kredit Segera Hadir
        </h1>
        <p className="text-muted-foreground mt-3 text-[14.5px] leading-relaxed">
          Kamu sedang dalam Early Access Campfire. Selama periode ini, kredit
          dibagikan gratis dan tidak ada pembelian. Kami akan beritahu kamu
          segera setelah opsi top-up tersedia.
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("campfire_open_feedback"))}
          className="mt-7 rounded-full bg-brand text-white px-5 py-2.5 text-[13.5px] font-semibold hover:bg-brand/90 transition-colors"
        >
          Kirim Masukan →
        </button>
      </div>
    </div>
  )
}

export default function PricingPage() {
  if (!flags.BILLING_ACTIVE) {
    return <BillingDisabledPlaceholder />
  }
  return <PricingPageInner />
}

function PricingPageInner() {
  const searchParams = useSearchParams()
  const wasCanceled  = searchParams.get("status") === "canceled"

  const [packs, setPacks]         = useState<CreditPack[]>([])
  const [balance, setBalance]     = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  // Payment modal state
  const [selectedPack, setSelectedPack]       = useState<CreditPack | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [stripeLoading, setStripeLoading]       = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getPackages(), getBalance()])
      .then(([p, b]) => { setPacks(p); setBalance(b) })
      .catch((err) => toast.error(err?.message ?? "Gagal memuat data"))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (wasCanceled) toast("Checkout dibatalkan. Tidak ada credits dipotong.")
  }, [wasCanceled])

  const openPaymentModal = (pack: CreditPack) => {
    setSelectedPack(pack)
    setShowPaymentModal(true)
  }

  const handleStripe = async () => {
    if (!selectedPack) return
    setShowPaymentModal(false)
    setStripeLoading(selectedPack.id)
    try {
      const url = await createCheckout(selectedPack.id)
      window.location.href = url
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal membuat sesi checkout")
      setStripeLoading(null)
    }
  }

  const handleXenditSuccess = (newBalance: number) => {
    setBalance(newBalance)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="border-b pb-8 border-border/40">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Beli Kredit</h1>
            <p className="text-muted-foreground mt-1.5 text-[14.5px] font-medium">
              Pay-as-you-go. Tidak ada subscription bulanan.
            </p>
          </div>
          <PageHelp
            title="Cara kerja kredit"
            content={{
              what: "Setiap operasi memotong kredit: Recon Free 1, Recon Pro 5, Match 1, Craft 2, Polish 1.",
              tips: "Beli paket sesuai volume kerjamu. Tidak kadaluarsa — kredit tetap ada selama akun aktif.",
              next: "Pilih paket di bawah, klik 'Beli', pilih metode bayar (QRIS, Transfer, atau Kartu), lalu selesaikan pembayaran.",
            }}
          />
        </div>

        {/* Current balance */}
        {!isLoading && (
          <div className="mt-8 flex items-baseline justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold text-muted-foreground">
                Saldo kamu saat ini:
              </span>
              <a href="/billing" className="text-[12.5px] text-brand hover:underline font-medium">
                Lihat Riwayat Transaksi →
              </a>
            </div>
            <span className="text-6xl font-black tracking-tighter text-foreground leading-none">
              {balance}
            </span>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-3">
          <Loader2 className="w-6 h-6 animate-spin" strokeWidth={1.5} />
          <span className="text-sm font-medium">Memuat paket...</span>
        </div>
      )}

      {/* Packs grid */}
      {!isLoading && packs.length > 0 && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-5">
          {packs.map((p) => (
            <div
              key={p.id}
              className={`relative rounded-2xl border p-6 flex flex-col gap-4 transition-shadow hover:shadow-md bg-white ${
                p.highlight ? "border-brand shadow-md" : "border-border/60"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-6 bg-brand text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow">
                  Recommended
                </span>
              )}

              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground">{p.name}</h3>
                <p className="text-[12.5px] text-muted-foreground mt-1 leading-snug">{p.description}</p>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black tracking-tight">{p.credits}</span>
                <span className="text-sm font-semibold text-muted-foreground">credits</span>
              </div>

              <div>
                <p className="text-[22px] font-bold tracking-tight">{formatRupiah(p.price_idr)}</p>
                <p className="text-[11.5px] text-muted-foreground font-medium mt-0.5">
                  ~{formatRupiah(Math.round(p.price_idr / p.credits))} / credit
                </p>
              </div>

              <button
                onClick={() => openPaymentModal(p)}
                disabled={stripeLoading === p.id}
                className={`w-full rounded-full font-semibold text-[13.5px] mt-2 py-2.5 transition-colors disabled:opacity-60 ${
                  p.highlight
                    ? "bg-brand hover:bg-brand/90 text-white"
                    : "bg-foreground hover:bg-foreground/90 text-background"
                }`}
              >
                {stripeLoading === p.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                    Mengarahkan ke Stripe...
                  </span>
                ) : (
                  "Beli sekarang →"
                )}
              </button>
            </div>
          ))}
          </div>

          {/* Payment methods note */}
          <div className="flex items-center justify-center gap-2 text-[12.5px] text-muted-foreground">
            <Check className="w-3.5 h-3.5 text-success shrink-0" strokeWidth={2} />
            <span>QRIS · GoPay · OVO · DANA · Transfer BCA / Mandiri / BNI / BRI · Kartu Kredit</span>
          </div>

          <div className="text-center pt-2">
            <p className="text-[13.5px] text-muted-foreground">
              Butuh lebih dari 500 kredit per bulan untuk tim yang besar?{" "}
              <a href="mailto:sales@campfire.id" className="text-foreground font-semibold hover:underline cursor-pointer">
                Hubungi Kami
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Cost breakdown */}
      {!isLoading && (
        <div className="mt-12 pt-8 border-t border-border/40">
          <div className="mb-6">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Simulasi Biaya Campaign</h2>
            <p className="text-[13.5px] text-muted-foreground mt-1">Estimasi pengeluaran per satu siklus lengkap (End-to-End) ke satu perusahaan target.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Free Mode Simulation */}
            <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="bg-surface px-6 py-4 border-b border-border/60">
                <h3 className="font-bold text-foreground text-[15px]">Pipeline: Mode Free</h3>
              </div>
              <div className="p-6 pt-4 flex flex-col flex-grow">
                <div className="space-y-1 mb-6">
                  {[
                    { label: "Recon (Free)", desc: "Riset dasar via URL perusahaan", cost: 1 },
                    { label: "Match", desc: "Pencocokan masalah ke produk", cost: 1 },
                    { label: "Craft", desc: "Auto-generate 3 draft email", cost: 2 },
                    { label: "Polish", desc: "Rewrite & revisi manual AI", cost: 1 },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[13.5px] text-foreground">{row.label}</span>
                        <span className="text-[11.5px] text-muted-foreground">{row.desc}</span>
                      </div>
                      <span className="font-bold text-[13px] text-muted-foreground">{row.cost} kredit</span>
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-4 border-t-2 border-border/60 flex items-center justify-between">
                  <span className="font-bold text-[14px]">Total Estimasi</span>
                  <span className="font-black text-brand bg-brand/10 px-3 py-1.5 rounded-lg text-[13px]">5 kredit / target</span>
                </div>
              </div>
            </div>

            {/* Pro Mode Simulation */}
            <div className="rounded-2xl border border-brand/50 bg-white shadow-sm overflow-hidden flex flex-col relative">
              <div className="absolute top-0 right-0 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-xl uppercase tracking-wider z-10 border-b border-l border-white/20">
                High Impact
              </div>
              <div className="bg-brand px-6 py-4">
                <h3 className="font-bold text-white text-[15px]">Pipeline: Mode Pro</h3>
              </div>
              <div className="p-6 pt-4 flex flex-col flex-grow bg-brand/[0.02]">
                <div className="space-y-1 mb-6">
                  {[
                    { label: "Recon (Pro)", desc: "Deep web research & Validasi PIC", cost: 5 },
                    { label: "Match", desc: "Pencocokan masalah ke produk", cost: 1 },
                    { label: "Craft", desc: "Auto-generate 3 draft email", cost: 2 },
                    { label: "Polish", desc: "Rewrite & revisi manual AI", cost: 1 },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-brand/10 last:border-0">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[13.5px] text-foreground">{row.label}</span>
                        <span className="text-[11.5px] text-muted-foreground">{row.desc}</span>
                      </div>
                      <span className="font-bold text-[13px] text-brand">{row.cost} kredit</span>
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-4 border-t-2 border-brand/20 flex items-center justify-between">
                  <span className="font-bold text-[14px] text-brand">Total Estimasi</span>
                  <span className="font-black text-white bg-brand px-3 py-1.5 rounded-lg text-[13px]">9 kredit / target</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Section */}
      {!isLoading && (
        <div className="mt-12 pt-8 border-t border-border/40 pb-12 flex flex-col items-center">
          <div className="mb-6 text-center">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Pertanyaan yang Sering Diajukan</h2>
          </div>
          <div className="w-full max-w-2xl flex flex-col text-[13.5px]">
            <div className="py-5 border-b border-border/40 last:border-0 flex items-start gap-4">
              <span className="inline-block text-3xl tracking-tighter font-black bg-clip-text text-transparent bg-gradient-to-br from-foreground to-brand select-none shrink-0 mt-0.5">1</span>
              <div>
                <h4 className="font-bold text-foreground mb-1.5">Apakah kredit bisa hangus?</h4>
                <p className="text-muted-foreground leading-relaxed">Tidak. Kredit yang kamu beli tidak memiliki masa kedaluwarsa dan akan tetap ada di akunmu selama akun aktif.</p>
              </div>
            </div>
            <div className="py-5 border-b border-border/40 last:border-0 flex items-start gap-4">
              <span className="inline-block text-3xl tracking-tighter font-black bg-clip-text text-transparent bg-gradient-to-br from-foreground to-brand select-none shrink-0 mt-0.5">2</span>
              <div>
                <h4 className="font-bold text-foreground mb-1.5">Metode bayar yang didukung?</h4>
                <p className="text-muted-foreground leading-relaxed">QRIS (scan via GoPay, OVO, DANA, ShopeePay, atau aplikasi bank apapun), Transfer Virtual Account (BCA, Mandiri, BNI, BRI, Permata), dan Kartu Kredit/Debit Visa/Mastercard.</p>
              </div>
            </div>
            <div className="py-5 border-b border-border/40 last:border-0 flex items-start gap-4">
              <span className="inline-block text-3xl tracking-tighter font-black bg-clip-text text-transparent bg-gradient-to-br from-foreground to-brand select-none shrink-0 mt-0.5">3</span>
              <div>
                <h4 className="font-bold text-foreground mb-1.5">Apakah ada biaya tersembunyi?</h4>
                <p className="text-muted-foreground leading-relaxed">Tidak, harga paket yang tertera di atas sudah final. Tidak ada tambahan biaya tersembunyi seperti pajak tambahan saat checkout.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Dialog */}
      <Dialog open={showPaymentModal} onOpenChange={(open) => { if (!open) setShowPaymentModal(false) }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold">Pilih Metode Pembayaran</DialogTitle>
          </DialogHeader>
          {selectedPack && (
            <PaymentMethodSelector
              pack={selectedPack}
              onStripe={handleStripe}
              onSuccess={handleXenditSuccess}
              onClose={() => setShowPaymentModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
