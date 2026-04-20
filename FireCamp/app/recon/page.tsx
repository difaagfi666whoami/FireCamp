"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, AlertTriangle, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { generateReconProfile, saveCompanyProfile, runProRecon } from "@/lib/api/recon"
import { session } from "@/lib/session"
import { mockData } from "@/lib/mock/mockdata"
import { ReconForm } from "./components/ReconForm"
import { LoadingSteps } from "@/components/shared/LoadingSteps"
import { cn } from "@/lib/utils"

const LOADING_STEPS = [
  "Membaca halaman website perusahaan target...",
  "Mencari berita, lowongan, dan sinyal bisnis...",
  "Mengidentifikasi kontak PIC dari LinkedIn publik...",
  "Membaca artikel terpilih secara mendalam...",
  "Menganalisis Hunter metadata & tech stack...",
  "Menyusun laporan intelijen sales..."
]

const PRO_LOADING_STEPS = [
  "Mengirim permintaan ke Tavily Research...",
  "Tavily menganalisis target perusahaan...",
  "Mengumpulkan data dari berbagai sumber...",
  "Memverifikasi dan menyilangkan informasi...",
  "Menyusun laporan komprehensif...",
  "Laporan hampir selesai..."
]

const SESSION_KEY = "campfire_recon_profile"

function sq(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }
const IS_LIVE = sq(process.env.NEXT_PUBLIC_USE_MOCK ?? "true") !== "true"

export default function ReconPage() {
  const router = useRouter()

  const [profile, setProfile] = useState<any>(null)  // null = SSR-safe
  const [reconUrl, setReconUrl]   = useState("")
  const [reconMode, setReconMode] = useState<'free' | 'pro'>('free')
  const [proQuery, setProQuery]   = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [pendingUrl, setPendingUrl]   = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  // Restore profile from sessionStorage on client mount (after all useState)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (saved) setProfile(JSON.parse(saved))
    } catch {}
  }, [])

  const startGenerate = (url: string) => {
    setReconUrl(url)
    setProfile(null)
    session.clearActiveTarget()
    setIsLoading(true)
    setCurrentStep(0)
    setPendingUrl(null)
    setShowConfirm(false)
  }

  const handleGenerate = (url: string) => {
    if (profile) {
      setPendingUrl(url)
      setShowConfirm(true)
    } else {
      startGenerate(url)
    }
  }

  // Animasi loading + concurrent API call
  useEffect(() => {
    if (!isLoading || !reconUrl) return

    const activeSteps = reconMode === 'pro' ? PRO_LOADING_STEPS : LOADING_STEPS

    // undefined = belum selesai, null = error, object = sukses
    let resolvedProfile: any = undefined
    let animDone = false

    const settle = () => {
      if (!animDone || resolvedProfile === undefined) return
      if (resolvedProfile === null) { setIsLoading(false); return }
      setIsLoading(false)
      toast.success("Profil berhasil di-generate")

      if (reconMode === 'pro') {
        router.push(`/recon/${resolvedProfile.id}`)
        return
      }

      setProfile(resolvedProfile)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(resolvedProfile))
      session.setReconProfile(resolvedProfile)
      if (resolvedProfile?.tokens_used && resolvedProfile.tokens_used > 0) {
        session.setReconTokens(resolvedProfile.tokens_used)
      }
      if (!IS_LIVE) session.setCompanyId(mockData.company.id)
      setIsAutoSaving(true)
      saveCompanyProfile(resolvedProfile)
        .then(uuid => {
          session.setCompanyId(uuid)
          session.setReconProfile({ ...resolvedProfile, id: uuid })
          router.push(`/recon/${uuid}`)
        })
        .catch(e => {
          console.error("[ReconPage] auto-save error:", e instanceof Error ? e.message : e)
          setProfile((prev: any) => prev ? { ...prev } : prev)
        })
        .finally(() => setIsAutoSaving(false))
    }

    if (reconMode === 'pro') {
      runProRecon(proQuery || reconUrl)
        .then(({ id }) => { resolvedProfile = { id }; settle() })
        .catch(e => {
          toast.error("Tavily Research gagal.", { description: e instanceof Error ? e.message : "Error" })
          resolvedProfile = null; settle()
        })
    } else {
      generateReconProfile(reconUrl, reconMode).then(data => {
        resolvedProfile = data; settle()
      }).catch(e => {
        toast.error("Gagal generate profil.", { description: e instanceof Error ? e.message : "Error" })
        resolvedProfile = null; settle()
      })
    }

    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= activeSteps.length - 1) {
          clearInterval(interval); animDone = true; settle(); return prev
        }
        return prev + 1
      })
    }, 6000)

    return () => clearInterval(interval)
  }, [isLoading, reconUrl])

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Confirmation Dialog Overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-border/60 p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 border border-amber-500/30 bg-amber-50 shadow-sm rounded-lg shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600"  strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-bold text-[16px] text-foreground">Generate ulang profil?</h3>
                <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
                  Profil yang sudah ada akan <strong>ditimpa</strong>. Proses ini menggunakan token AI tambahan.
                </p>
              </div>
              <button onClick={() => setShowConfirm(false)} className="ml-auto p-1 rounded-lg hover:bg-muted text-muted-foreground shrink-0">
                <X className="w-4 h-4"  strokeWidth={1.5} />
              </button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-[12.5px] text-amber-800 font-medium">
              URL: <span className="font-bold break-all">{pendingUrl}</span>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl font-semibold" onClick={() => setShowConfirm(false)}>
                Batal
              </Button>
              <Button className="flex-1 bg-brand hover:bg-brand/90 text-white rounded-xl font-bold" onClick={() => startGenerate(pendingUrl!)}>
                Ya, Generate Baru
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between border-b pb-6 border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recon Baru</h1>
          <p className="text-muted-foreground mt-1.5 text-[14.5px] font-medium">
            Riset profil target perusahaan untuk menemukan pain points, kontak PIC, dan sinyal bisnis.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/research-library")} className="shadow-sm font-semibold text-[13.5px] rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2"  strokeWidth={1.5} />
          Research Library
        </Button>
      </div>

      {/* URL Input Section */}
      <div className="max-w-4xl mx-auto w-full">
        {/* URL Input Card */}
        <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
          {/* Mode Tabs */}
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1 mb-5 w-fit">
            <button
              onClick={() => setReconMode('free')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all",
                reconMode === 'free'
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Free
            </button>
            <button
              onClick={() => setReconMode('pro')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all",
                reconMode === 'pro'
                  ? "bg-brand text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Pro
            </button>
          </div>

          {reconMode === 'free' ? (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 border border-border/50 shadow-sm rounded-lg text-muted-foreground/80">
                  <Search className="w-4 h-4 text-muted-foreground"  strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="font-bold text-[14.5px] text-foreground">Target Company URL</h2>
                  <p className="text-[12.5px] text-muted-foreground">Masukkan URL website yang ditarget.</p>
                </div>
              </div>
              <ReconForm onGenerate={handleGenerate} isLoading={isLoading || isAutoSaving} />
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 border border-brand/30 bg-brand/5 shadow-sm rounded-lg text-brand/90">
                  <Search className="w-4 h-4 text-brand"  strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="font-bold text-[14.5px] text-foreground">Research Query</h2>
                  <p className="text-[12.5px] text-muted-foreground">Mendukung input URL saja, atau URL dengan arahan riset spesifik.</p>
                </div>
              </div>
              <textarea
                value={proQuery}
                onChange={e => setProQuery(e.target.value)}
                disabled={isLoading || isAutoSaving}
                rows={5}
                placeholder={"Contoh input:\nhttps://www.javaplas.com/\n\nAtau dengan arahan riset spesifik:\nhttps://www.javaplas.com/ cari tahu strategi pricing, target audiens, kompetitor utama, dan kontak eksekutif di bidang marketing."}
                className="w-full resize-y rounded-xl border border-border/60 bg-muted/30 px-4 py-4 text-[13.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50 min-h-[140px] leading-relaxed"
              />
              <Button
                className="mt-4 w-full bg-brand hover:bg-brand/90 text-white rounded-xl font-bold h-11"
                disabled={isLoading || isAutoSaving || !proQuery.trim()}
                onClick={() => {
                  const urlMatch = proQuery.match(/https?:\/\/[^\s]+/)
                  handleGenerate(urlMatch ? urlMatch[0] : proQuery.trim())
                }}
              >
                {(isLoading || isAutoSaving) ? <Loader2 className="w-4 h-4 animate-spin mr-2"  strokeWidth={1.5} /> : null}
                {(isLoading || isAutoSaving) ? "Menganalisis..." : "Mulai Pro Research"}
              </Button>
            </>
          )}

          {(isLoading || isAutoSaving) && (
            <div className="mt-8 border-t border-border/40 pt-6">
              <LoadingSteps
                steps={reconMode === 'pro' ? PRO_LOADING_STEPS : LOADING_STEPS}
                currentStep={currentStep}
              />
              {isAutoSaving && (
                <div className="mt-6 flex items-center justify-center gap-2 p-3.5 bg-brand/5 border border-brand/20 rounded-xl animate-in slide-in-from-bottom-2">
                  <Loader2 className="w-4 h-4 animate-spin text-brand" strokeWidth={1.5} />
                  <p className="text-[13.5px] font-semibold text-brand">Menyimpan profil & automasi redirect...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
