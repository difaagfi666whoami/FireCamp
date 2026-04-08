"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, BarChart2, Plus, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCompanyById } from "@/lib/api/recon"
import { session } from "@/lib/session"
import { CompanyProfile } from "@/types/recon.types"
import { CompanyHeader } from "../components/CompanyHeader"
import { StrategicMainContent } from "../components/StrategicMainContent"
import { StrategicSidebar } from "../components/StrategicSidebar"
import { PainPointList } from "../components/PainPointList"
import { NewsSection } from "../components/NewsSection"
import { KeyContacts } from "../components/KeyContacts"

export default function SavedReconPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Set company ID in session — dibutuhkan oleh Match & Craft downstream
    session.setCompanyId(params.id)

    getCompanyById(params.id)
      .then(data => {
        setProfile(data)
        // Simpan profile ke session agar Match & Craft bisa gunakan tanpa fetch ulang
        session.setReconProfile(data)
      })
      .catch(e => setError(e instanceof Error ? e.message : "Gagal memuat profil"))
      .finally(() => setIsLoading(false))
  }, [params.id])

  const isPulseDone = profile?.campaignProgress?.pulse  ?? false
  const isMatchDone = profile?.campaignProgress?.match  ?? false

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-muted-foreground">
        <Loader2 className="w-7 h-7 animate-spin" />
        <p className="text-[14px] font-medium">Memuat profil perusahaan...</p>
      </div>
    )
  }

  // ─── Error ────────────────────────────────────────────────────────────────────

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-8">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex flex-col items-center gap-3 max-w-sm text-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="font-bold text-[15px] text-red-800">Gagal memuat profil</p>
          <p className="text-[13px] text-red-700">{error}</p>
          <Button onClick={() => router.push("/research-library")} variant="outline" size="sm" className="mt-1 rounded-xl">
            Kembali ke Library
          </Button>
        </div>
      </div>
    )
  }

  // ─── Content ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between border-b pb-6 border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Detail Profil</h1>
          <p className="text-muted-foreground mt-1.5 text-[14.5px] font-medium">
            Hasil recon tersimpan untuk{" "}
            <span className="font-bold text-foreground">{profile.name}</span>.
          </p>
        </div>
        <div className="flex gap-3 items-start">
          <Button
            variant="outline"
            onClick={() => router.push("/research-library")}
            className="shadow-sm font-semibold text-[13.5px] rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Research Library
          </Button>
          {isPulseDone ? (
            <div className="flex flex-col items-center gap-1">
              <div className="flex gap-2">
                <Button
                  onClick={() => router.push("/pulse")}
                  className="bg-brand hover:bg-brand/90 text-white shadow-sm font-semibold text-[13.5px] rounded-xl"
                >
                  <BarChart2 className="w-4 h-4 mr-2" />
                  Lihat Analytics
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/match")}
                  className="shadow-sm font-semibold text-[13px] rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Buat Campaign Baru
                </Button>
              </div>
              <p className="text-[11px] text-center text-muted-foreground mt-1">
                Campaign baru akan ditambahkan untuk perusahaan ini.
              </p>
            </div>
          ) : isMatchDone ? (
            <Button
              onClick={() => router.push("/match")}
              className="bg-brand hover:bg-brand/90 text-white shadow-sm font-semibold text-[13.5px] rounded-xl"
            >
              Lanjutkan Campaign
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={() => router.push("/match")}
              className="bg-brand hover:bg-brand/90 text-white shadow-sm font-semibold text-[13.5px] rounded-xl"
            >
              Lanjutkan ke Match
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <CompanyHeader company={profile} />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mt-6">
        <div className="md:col-span-8 space-y-5">
          <StrategicMainContent report={profile.strategicReport} />
          <PainPointList painPoints={profile.painPoints} />
        </div>
        <div className="md:col-span-4 space-y-4">
          <StrategicSidebar company={profile} />
          <KeyContacts contacts={profile.contacts} />
          <NewsSection news={profile.news} />
        </div>
      </div>
    </div>
  )
}
