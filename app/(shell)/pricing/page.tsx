"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Check, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { getPackages, getBalance, createCheckout, formatRupiah, CreditPack } from "@/lib/api/credits"
import { PageHelp } from "@/components/ui/PageHelp"

export default function PricingPage() {
  const searchParams = useSearchParams()
  const wasCanceled  = searchParams.get("status") === "canceled"

  const [packs, setPacks]           = useState<CreditPack[]>([])
  const [balance, setBalance]       = useState<number>(0)
  const [isLoading, setIsLoading]   = useState(true)
  const [checkoutPackId, setCheckoutPackId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getPackages(), getBalance()])
      .then(([p, b]) => { setPacks(p); setBalance(b) })
      .catch((err) => toast.error(err?.message ?? "Gagal memuat data"))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (wasCanceled) toast("Checkout dibatalkan. Tidak ada credits dipotong.")
  }, [wasCanceled])

  const handleBuy = async (packId: string) => {
    setCheckoutPackId(packId)
    try {
      const url = await createCheckout(packId)
      window.location.href = url
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal membuat sesi checkout")
      setCheckoutPackId(null)
    }
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
              next: "Pilih paket di bawah, klik 'Beli', dan selesaikan pembayaran. Saldo akan otomatis bertambah.",
            }}
          />
        </div>

        {/* Current balance */}
        {!isLoading && (
          <div className="mt-8 flex items-baseline justify-between">
            <span className="text-[15px] font-semibold text-muted-foreground">
              Saldo kamu saat ini:
            </span>
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

              <Button
                onClick={() => handleBuy(p.id)}
                disabled={!!checkoutPackId}
                className={`w-full rounded-full font-semibold text-[13.5px] mt-2 ${
                  p.highlight
                    ? "bg-brand hover:bg-brand/90 text-white"
                    : "bg-foreground hover:bg-foreground/90 text-background"
                }`}
              >
                {checkoutPackId === p.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" strokeWidth={1.5} />
                    Mengarahkan ke Stripe...
                  </>
                ) : (
                  "Beli sekarang →"
                )}
              </Button>
            </div>
          ))}
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
    </div>
  )
}
