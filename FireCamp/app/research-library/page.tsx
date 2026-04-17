"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, BookOpen, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProfileCard } from "@/components/research-library/ProfileCard"
import { getResearchLibrary, deleteCompanyProfile, LibraryEntry } from "@/lib/api/recon"
import { session } from "@/lib/session"
import { toast } from "sonner"

export default function ResearchLibraryPage() {
  const router = useRouter()
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
        toast.error("Gagal memuat Research Library.", { description: msg })
      })
      .finally(() => setIsLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    const targetToDelete = profiles.find(p => p.id === id)
    // Optimistic update — hapus dari UI dulu
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
      toast.success("Profil dihapus.")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      toast.error("Gagal menghapus profil.", { description: msg })
      // Rollback: re-fetch supaya state konsisten dengan DB
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
            Semua riset perusahaan tersimpan di satu tempat.
          </p>
        </div>
        <Button onClick={handleReconBaru} className="bg-brand hover:bg-brand/90 text-white shadow-sm font-semibold text-[13.5px]">
          <Plus className="w-4 h-4 mr-2" />
          Recon Baru
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground animate-in fade-in">
          <Loader2 className="w-7 h-7 animate-spin" />
          <p className="text-[14px] font-medium">Memuat research library...</p>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex flex-col items-center gap-3 max-w-sm text-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="font-bold text-[15px] text-red-800">Gagal memuat data</p>
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
                    toast.error("Gagal memuat Research Library.", { description: msg })
                  })
                  .finally(() => setIsLoading(false))
              }}
              variant="outline" size="sm" className="mt-1 rounded-xl"
            >
              Coba Lagi
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
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-[17px] text-foreground mb-2">Belum ada riset tersimpan</h3>
            <p className="text-muted-foreground text-[14px] max-w-xs mb-6">
              Mulai dengan melakukan Recon terhadap target perusahaan pertama kamu.
            </p>
            <Button onClick={handleReconBaru} className="bg-brand hover:bg-brand/90 text-white font-semibold">
              <Plus className="w-4 h-4 mr-2" />
              Recon Baru
            </Button>
          </div>
        )
      )}
    </div>
  )
}
