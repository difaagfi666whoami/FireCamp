"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, ArrowRight, Search, AlertTriangle, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { generateReconProfile, saveCompanyProfile } from "@/lib/api/recon"
import { session } from "@/lib/session"
import { mockData } from "@/lib/mock/mockdata"
import { ReconForm } from "./components/ReconForm"
import { CompanyHeader } from "./components/CompanyHeader"
import { StrategicMainContent } from "./components/StrategicMainContent"
import { StrategicSidebar } from "./components/StrategicSidebar"
import { PainPointList } from "./components/PainPointList"
import { NewsSection } from "./components/NewsSection"
import { KeyContacts } from "./components/KeyContacts"
import { LoadingSteps } from "@/components/shared/LoadingSteps"
import { cn } from "@/lib/utils"

const LOADING_STEPS = [
  "Mengambil data profil dari LinkedIn...",
  "Menganalisis teknologi dan ukuran perusahaan...",
  "Mencari kontak PIC yang relevan...",
  "Menyusun pain points & sinyal bisnis..."
]

const SESSION_KEY = "campfire_recon_profile"

function sq(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }
const IS_LIVE = sq(process.env.NEXT_PUBLIC_USE_MOCK ?? "true") !== "true"

export default function ReconPage() {
  const router = useRouter()

  const [profile, setProfile] = useState<any>(null)  // null = SSR-safe
  const [reconUrl, setReconUrl]   = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving]   = useState(false)
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

    // undefined = belum selesai, null = error, object = sukses
    let resolvedProfile: any = undefined
    let animDone = false

    const settle = () => {
      if (!animDone || resolvedProfile === undefined) return
      if (resolvedProfile === null) {
        setIsLoading(false)
        return
      }
      setProfile(resolvedProfile)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(resolvedProfile))
      session.setReconProfile(resolvedProfile)  // untuk dipakai Match & Craft
      if (resolvedProfile?.tokens_used && resolvedProfile.tokens_used > 0) {
        session.setReconTokens(resolvedProfile.tokens_used)
      }
      if (!IS_LIVE) session.setCompanyId(mockData.company.id)
      setIsLoading(false)
      toast.success("Profil berhasil di-generate")
      // Auto-save silently di background — dapatkan UUID asli dari Supabase/mock
      setIsAutoSaving(true)
      saveCompanyProfile(resolvedProfile)
        .then(uuid => {
          session.setCompanyId(uuid)
          session.setReconProfile({ ...resolvedProfile, id: uuid })
          setProfile((prev: any) => prev ? { ...prev, id: uuid } : prev)
        })
        .catch(e => {
          console.error("[ReconPage] auto-save error:", e instanceof Error ? e.message : e)
        })
        .finally(() => {
          setIsAutoSaving(false)
        })
    }

    // Mulai API call bersamaan dengan animasi
    generateReconProfile(reconUrl).then(data => {
      resolvedProfile = data
      settle()
    }).catch(e => {
      toast.error("Gagal generate profil.", { description: e instanceof Error ? e.message : "Error" })
      resolvedProfile = null
      settle()
    })

    // Animasi step-by-step
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= LOADING_STEPS.length - 1) {
          clearInterval(interval)
          animDone = true
          settle()
          return prev  // stay at last step while waiting for API
        }
        return prev + 1
      })
    }, 1200)

    return () => clearInterval(interval)
  }, [isLoading, reconUrl])

  const handleSave = async () => {
    if (!profile || isSaving) return

    // Jika auto-save background sudah berhasil (profile.id sudah UUID asli),
    // jangan simpan ulang — cukup arahkan ke library untuk mencegah baris ganda di Supabase
    if (profile.id && session.isValidUuid(profile.id)) {
      session.setCompanyId(profile.id)
      session.setReconProfile(profile)
      toast.success("Profil disimpan ke Research Library")
      router.push("/research-library")
      return
    }

    setIsSaving(true)
    try {
      const companyId = await saveCompanyProfile(profile)
      session.setCompanyId(companyId)
      session.setReconProfile({ ...profile, id: companyId })
      toast.success("Profil disimpan ke Research Library")
      router.push("/research-library")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      console.error("[ReconPage] handleSave error:", msg)
      toast.error("Gagal menyimpan profil.", { description: msg })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Confirmation Dialog Overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-border/60 p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 bg-amber-100 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-[16px] text-foreground">Generate ulang profil?</h3>
                <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
                  Profil yang sudah ada akan <strong>ditimpa</strong>. Proses ini menggunakan token AI tambahan.
                </p>
              </div>
              <button onClick={() => setShowConfirm(false)} className="ml-auto p-1 rounded-lg hover:bg-muted text-muted-foreground shrink-0">
                <X className="w-4 h-4" />
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
          <ArrowLeft className="w-4 h-4 mr-2" />
          Research Library
        </Button>
      </div>

      {/* URL Input + Action Buttons side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
        {/* URL Input Card */}
        <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-muted rounded-xl">
              <Search className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-bold text-[14.5px] text-foreground">Target Company URL</h2>
              <p className="text-[12.5px] text-muted-foreground">Masukkan URL website atau LinkedIn perusahaan target.</p>
            </div>
          </div>
          <ReconForm onGenerate={handleGenerate} isLoading={isLoading} />

          {isLoading && (
            <div className="mt-8 border-t border-border/40 pt-6">
              <LoadingSteps steps={LOADING_STEPS} currentStep={currentStep} />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className={cn(
          "bg-white border border-border/60 rounded-2xl p-6 shadow-sm flex flex-col gap-3 justify-center transition-opacity duration-300",
          !profile && !isLoading ? "opacity-40 pointer-events-none" : "opacity-100"
        )}>
          <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Aksi</p>
          <Button
            className="w-full bg-brand hover:bg-brand/90 text-white font-bold h-11 rounded-xl shadow-sm"
            onClick={handleSave}
            disabled={!profile || isLoading || isSaving || isAutoSaving}
          >
            {isSaving || isAutoSaving
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menyimpan...</>
              : <><Save className="w-4 h-4 mr-2" />Simpan ke Database</>
            }
          </Button>
          <Button
            variant="outline"
            className="w-full font-semibold h-11 rounded-xl"
            onClick={() => router.push("/match")}
            disabled={!profile || isLoading}
          >
            Lanjut ke Match
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <p className="text-[11px] text-center text-muted-foreground leading-relaxed mt-1">
            {profile ? "Profil siap. Simpan atau lanjutkan ke Match." : "Generate profil terlebih dahulu."}
          </p>
        </div>
      </div>

      {/* Results — Strategic Intelligence Report */}
      {profile && !isLoading && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-700">
          {/* HEADER: Full-width strategic title + executive insight */}
          <CompanyHeader company={profile} />

          {/* SPLIT-VIEW: 8/12 main narrative + 4/12 sidebar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Main column: strategic narrative + pain points */}
            <div className="md:col-span-8 space-y-5">
              <StrategicMainContent report={profile.strategicReport} />
              <PainPointList painPoints={profile.painPoints} />
            </div>

            {/* Sidebar: metrics + contacts + news */}
            <div className="md:col-span-4 space-y-4">
              <StrategicSidebar company={profile} />
              <KeyContacts contacts={profile.contacts} />
              <NewsSection news={profile.news} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
