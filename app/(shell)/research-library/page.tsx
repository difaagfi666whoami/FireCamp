"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, BookOpen, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProfileCard } from "@/components/research-library/ProfileCard"
import { getResearchLibrary, deleteCompanyProfile, LibraryEntry } from "@/lib/api/recon"
import { session } from "@/lib/session"
import { toast } from "sonner"
import { PageHelp } from "@/components/ui/PageHelp"
import { useLanguage } from "@/lib/i18n/LanguageContext"

export default function ResearchLibraryPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [profiles, setProfiles]   = useState<LibraryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const handleReconBaru = () => {
    session.clearActiveTarget()
    router.push("/recon")
  }

  useEffect(() => {
    getResearchLibrary()
      .then(setProfiles)
      .catch(e => {
        const msg = e instanceof Error ? e.message : "Unknown error"
        setError(msg)
        toast.error(t("Failed to load Research Library."), { description: msg })
      })
      .finally(() => setIsLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    const targetToDelete = profiles.find(p => p.id === id)
    setProfiles(prev => prev.filter(p => p.id !== id))
    try {
      await deleteCompanyProfile(id)
      const activeSessionId = session.getCompanyId()
      const activeProfile   = session.getReconProfile()
      if (
        activeSessionId === id ||
        activeProfile?.id === id ||
        activeProfile?.name === targetToDelete?.name
      ) {
        session.clearActiveTarget()
      }
      toast.success(t("Profile deleted."))
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      toast.error(t("Failed to delete profile."), { description: msg })
      getResearchLibrary().then(setProfiles).catch(() => null)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between border-b pb-6 border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Research Library</h1>
          <p className="text-muted-foreground mt-1.5 text-[14.5px] font-medium">
            {t("All your company research, in one place.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PageHelp
            title="Research Library — Pusat Riset"
            content={{
              what: "Semua perusahaan target yang sudah kamu riset (Recon) tersimpan di sini, lengkap dengan progress pipeline tiap target.",
              tips: "Klik kartu untuk masuk ke profil; gunakan tombol hapus jika riset sudah tidak relevan. Jumlah pain points jadi indikator kasar 'kekayaan' data.",
              next: "Klik 'Recon Baru' untuk mulai riset target baru, atau buka kartu yang sudah ada untuk lanjut ke Match → Craft → Launch.",
            }}
          />
          <Button onClick={handleReconBaru} className="bg-brand hover:bg-brand/90 text-white shadow-sm font-semibold text-[13.5px]">
            <Plus className="w-4 h-4 mr-2"  strokeWidth={1.5} />
            {t("New Recon")}
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground animate-in fade-in">
          <Loader2 className="w-7 h-7 animate-spin"  strokeWidth={1.5} />
          <p className="text-[14px] font-medium">{t("Loading research library...")}</p>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex flex-col items-center gap-3 max-w-sm text-center">
            <AlertCircle className="w-8 h-8 text-red-500"  strokeWidth={1.5} />
            <p className="font-bold text-[15px] text-red-800">{t("Failed to load data")}</p>
            <p className="text-[13px] text-red-700">{error}</p>
            <Button
              onClick={() => {
                setError(null)
                setIsLoading(true)
                getResearchLibrary()
                  .then(setProfiles)
                  .catch(e => {
                    const msg = e instanceof Error ? e.message : "Unknown error"
                    setError(msg)
                    toast.error(t("Failed to load Research Library."), { description: msg })
                  })
                  .finally(() => setIsLoading(false))
              }}
              variant="outline" size="sm" className="mt-1 rounded-xl"
            >
              {t("Try Again")}
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && (
        profiles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {profiles.map(profile => (
              <ProfileCard key={profile.id} company={profile} onDelete={handleDelete} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-5 bg-muted rounded-full mb-5">
              <BookOpen className="w-8 h-8 text-muted-foreground"  strokeWidth={1.5} />
            </div>
            <h3 className="font-bold text-[17px] text-foreground mb-2">{t("No research saved yet")}</h3>
            <p className="text-muted-foreground text-[14px] max-w-xs mb-6">
              {t("Start by running Recon on your first target company.")}
            </p>
            <Button onClick={handleReconBaru} className="bg-brand hover:bg-brand/90 text-white font-semibold">
              <Plus className="w-4 h-4 mr-2"  strokeWidth={1.5} />
              {t("New Recon")}
            </Button>
          </div>
        )
      )}
    </div>
  )
}
