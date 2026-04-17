"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, BarChart2, Loader2, AlertCircle, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCompanyById } from "@/lib/api/recon"
import { getCampaignWithMatchResult } from "@/lib/api/match"
import { getCraftedEmailsByCompany } from "@/lib/api/craft"
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

        // --- SILENT HYDRATION ---
        // Jika sudah melewati Match, langsung pasang CampaignId ke sesi 
        // sehingga user bisa meloncat ke Pulse atau Launch tanpa pesan "Belum ada campaign".
        if (data.campaignProgress?.match || data.campaignProgress?.craft) {
          getCampaignWithMatchResult(params.id).then(dbData => {
            if (dbData?.campaignId) {
              session.setCampaignId(dbData.campaignId)
              if (dbData.selectedProductId) session.setSelectedProductId(dbData.selectedProductId)
            }
          }).catch(e => console.error("[ReconPreview] Silent match hydration err:", e))

          if (data.campaignProgress?.craft) {
            getCraftedEmailsByCompany(params.id).then(craftDb => {
              if (craftDb) {
                session.setCraftCampaign(craftDb)
                sessionStorage.setItem("campfire_craft_done", "1")
              }
            }).catch(e => console.error("[ReconPreview] Silent craft hydration err:", e))
          }
        }
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

      {/* Pipeline breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground font-medium">
        <span
          className="hover:text-foreground cursor-pointer transition-colors"
          onClick={() => router.push("/research-library")}
        >
          Research Library
        </span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-semibold">Review Profil</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>Match</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>Craft</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>Polish</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>Launch</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between border-b pb-6 border-border/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11.5px] font-bold uppercase tracking-wider text-brand bg-brand-light px-2.5 py-1 rounded-full">
              Langkah 1 dari 6
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-2">Review Profil</h1>
          <p className="text-muted-foreground mt-1 text-[14.5px] font-medium">
            Tinjau hasil riset untuk{" "}
            <span className="font-bold text-foreground">{profile.name}</span> sebelum melanjutkan ke Match.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/research-library")}
          className="shadow-sm font-semibold text-[13.5px] rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Research Library
        </Button>
      </div>

      {/* Content */}
      <CompanyHeader company={profile} />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
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

      {/* Bottom CTA */}
      <div className="border-t border-border/40 pt-6">
        {isPulseDone ? (
          <div className="flex items-center justify-between bg-brand-light border border-brand/20 rounded-2xl px-6 py-4">
            <div>
              <p className="font-bold text-[15px] text-brand">Campaign sudah berjalan</p>
              <p className="text-[13px] text-brand/70 mt-0.5">Pantau performa pengiriman email campaign perusahaan ini.</p>
            </div>
            <Button onClick={() => router.push("/pulse")} className="bg-brand hover:bg-brand/90 text-white rounded-xl font-bold shadow-sm h-11 px-6">
              <BarChart2 className="w-4 h-4 mr-2" />
              Lihat Analytics
            </Button>
          </div>
        ) : isMatchDone ? (
          <div className="flex items-center justify-between bg-muted/50 border border-border/60 rounded-2xl px-6 py-4">
            <div>
              <p className="font-bold text-[15px] text-foreground">Campaign sudah dimulai</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">Lanjutkan campaign yang sedang berjalan.</p>
            </div>
            <Button onClick={() => router.push("/match")} className="bg-brand hover:bg-brand/90 text-white rounded-xl font-bold shadow-sm h-11 px-6">
              Lanjutkan Campaign
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-brand-light border border-brand/20 rounded-2xl px-6 py-4">
            <div>
              <p className="font-bold text-[15px] text-brand">Profil siap untuk di-match</p>
              <p className="text-[13px] text-brand/70 mt-0.5">Pilih produk yang paling relevan dengan pain points perusahaan ini.</p>
            </div>
            <Button onClick={() => router.push("/match")} className="bg-brand hover:bg-brand/90 text-white rounded-xl font-bold shadow-sm h-11 px-6">
              Lanjutkan ke Match
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
