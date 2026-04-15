"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Play, ArrowRight, CheckCircle2, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadingSteps } from "@/components/shared/LoadingSteps"
import { ProductMatchCard } from "./ProductMatchCard"
import { cn } from "@/lib/utils"
import { session } from "@/lib/session"
import { runMatching, saveCampaignAndMatching, getCampaignWithMatchResult } from "@/lib/api/match"
import { createProduct } from "@/lib/api/catalog"
import { updateCompanyProgress } from "@/lib/api/recon"
import { ProductMatch } from "@/types/match.types"
import { toast } from "sonner"

const MATCHING_STEPS = [
  "Menganalisis pain points perusahaan...",
  "Memindai katalog layanan anda...",
  "Mengevaluasi kecocokan solusi...",
  "Menyusun argumentasi value proposition..."
]

const SESSION_KEY = "campfire_match_done"
const PRODUCT_KEY = "campfire_selected_product"

export function MatchingTab() {
  const router = useRouter()

  const [isMatching, setIsMatching]     = useState(false)
  const [currentStep, setCurrentStep]   = useState(0)
  const [hasMatched, setHasMatched]     = useState(false)   // false = SSR-safe
  const [selectedId, setSelectedId]     = useState<string | null>(null)  // null = SSR-safe
  const [realMatches, setRealMatches]   = useState<ProductMatch[]>([])
  const [isProceeding, setIsProceeding] = useState(false)
  const [companyProfile, setCompanyProfile] = useState<any>(null)
  const [companyName, setCompanyName]   = useState<string>("")
  const [isProfileLoaded, setIsProfileLoaded] = useState(false)

  // ─── Mount: restore from sessionStorage, with DB hydration fallback ─────

  useEffect(() => {
    // 1. Session hit — restore directly from local storage
    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      setHasMatched(true)
      const saved = sessionStorage.getItem(PRODUCT_KEY)
      if (saved) setSelectedId(saved)
      const savedMatches = sessionStorage.getItem("campfire_match_results")
      if (savedMatches) {
        try { setRealMatches(JSON.parse(savedMatches)) } catch {}
      }
      return
    }

    // 2. Session cold — always attempt hydration from DB if profile has a
    //    real UUID. Do NOT gate on `campaignProgress.match` flag, it can lag.
    const profile = session.getReconProfile()
    if (!profile?.id || !session.isValidUuid(profile.id)) return

    getCampaignWithMatchResult(profile.id).then(dbData => {
      if (!dbData || !dbData.matches?.length) return
      setHasMatched(true)
      if (dbData.selectedProductId) setSelectedId(dbData.selectedProductId)
      setRealMatches(dbData.matches)
      // Mirror into session so Craft page isn't blank
      session.setCampaignId(dbData.campaignId)
      if (dbData.selectedProductId) session.setSelectedProductId(dbData.selectedProductId)
      sessionStorage.setItem("campfire_match_results", JSON.stringify(dbData.matches))
      sessionStorage.setItem(SESSION_KEY, "1")
    }).catch(console.error)
  }, [])

  useEffect(() => {
    const profile = session.getReconProfile()
    if (profile) {
      setCompanyProfile(profile)
      setCompanyName(profile.name ?? "")
    }
    setIsProfileLoaded(true)
  }, [])

  const handleSelectProduct = (id: string) => {
    setSelectedId(id)
    sessionStorage.setItem(PRODUCT_KEY, id)
    session.setSelectedProductId(id)
  }

  // ─── Compute display matches ──────────────────────────────────────────────

  const matches = useMemo(() => {
    if (!hasMatched || !realMatches.length) return []
    return realMatches.map((m: ProductMatch) => ({
      ...m,
      id: m.id,
      painPointTargeted: m.addressedPainIndices
        .map(idx => companyProfile?.painPoints?.[idx]?.issue ?? "")
        .filter(Boolean)
        .join(" & "),
    }))
  }, [hasMatched, realMatches, companyProfile])

  // ─── Proceed to Craft ─────────────────────────────────────────────────────

  const handleProceedToCraft = async () => {
    if (!selectedId || isProceeding) return
    setIsProceeding(true)
    try {
      let companyId = session.getCompanyId()
      console.log("[Debug] Current Company ID:", companyId)

      if (!session.isValidUuid(companyId ?? "")) {
        toast.error("Simpan profil di Recon terlebih dahulu.", {
          description: "Company ID tidak valid. Klik 'Simpan ke Database' di halaman Recon."
        })
        setIsProceeding(false)
        router.push("/recon")
        return
      }

      // Update progress di Supabase (non-blocking)
      updateCompanyProgress(companyId!, "match").catch(console.error)

      // Upsert mock product to Supabase to get a real UUID
      let realSelectedId = selectedId
      if (!session.isValidUuid(selectedId)) {
        // AI matched a non-UUID product (still using legacy backend JSON logic)
        const productFromMatch = matches.find(m => m.id === selectedId)
        
        if (productFromMatch) {
          const saved = await createProduct({
            name:           productFromMatch.name,
            tagline:        productFromMatch.tagline ?? "",
            description:    productFromMatch.description ?? "",
            price:          productFromMatch.price ?? "",
            painCategories: productFromMatch.painCategories ?? [],
            usp:            productFromMatch.usp ?? [],
            source:         "manual",
          })
          realSelectedId = saved.id
          session.setSelectedProductId(realSelectedId)
          setSelectedId(realSelectedId)

          // Update realMatches as well so caching survives with the new UUID
          const updatedMatches = realMatches.map(m => 
            m.id === selectedId ? { ...m, id: realSelectedId } : m
          )
          setRealMatches(updatedMatches)
          sessionStorage.setItem("campfire_match_results", JSON.stringify(updatedMatches))
        }
      }

      const selectedMatch = matches.find(m => m.id === selectedId)
      const selectedName  = selectedMatch?.name ?? selectedId

      // Build match results list untuk Supabase
      const matchPayload = realMatches.map(m => ({
        productId:            m.id,
        productName:          m.name,
        matchScore:           m.matchScore,
        addressedPainIndices: m.addressedPainIndices,
        reasoning:            m.reasoning,
        isRecommended:        m.isRecommended,
      }))

      // Re-read sesaat sebelum save — background auto-save recon mungkin baru selesai
      companyId = session.getCompanyId() ?? companyId
      console.log("[Hybrid-Trace] Saving campaign for company:", companyId)

      const existingCampaignId = session.getCampaignId()

      const campaignId = await saveCampaignAndMatching(
        companyId!, realSelectedId, selectedName, matchPayload, existingCampaignId
      )
      session.setCampaignId(campaignId)
    } catch (e) {
      console.error("[MatchingTab] saveCampaignAndMatching error:", e)
      // Non-blocking — tetap lanjut ke Craft meski gagal simpan ke Supabase
    }
    router.push("/craft")
  }

  // ─── Start Matching ───────────────────────────────────────────────────────

  const handleStartMatching = () => {
    if (!companyProfile) {
      toast.error("Profil perusahaan tidak ditemukan.", {
        description: "Lakukan Recon dan simpan profil terlebih dahulu."
      })
      return
    }
    setIsMatching(true)
    setHasMatched(false)
    setCurrentStep(0)
  }

  // ─── Matching useEffect ───────────────────────────────────────────────────

  useEffect(() => {
    if (!isMatching || !companyProfile) return

    let resolvedResults: ProductMatch[] | null | undefined = undefined
    let animDone = false

    const settle = () => {
      if (!animDone || resolvedResults === undefined) return
      if (resolvedResults !== null) {
        setRealMatches(resolvedResults)
        sessionStorage.setItem("campfire_match_results", JSON.stringify(resolvedResults))
        sessionStorage.setItem(SESSION_KEY, "1")
        setHasMatched(true)
      }
      setIsMatching(false)
    }

    runMatching(companyProfile).then(results => {
      resolvedResults = results
      settle()
    }).catch(e => {
      toast.error("AI Matching gagal.", { description: e instanceof Error ? e.message : "Error" })
      resolvedResults = null
      settle()
    })

    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= MATCHING_STEPS.length - 1) {
          clearInterval(interval)
          animDone = true
          settle()
          return prev  // stay at last step while waiting for API
        }
        return prev + 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isMatching, companyProfile])

  // ─── Render: belum ada profil (masih loading dari sessionStorage / tidak ada) ─────────

  if (!isProfileLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground animate-in fade-in">
        <Loader2 className="w-5 h-5 animate-spin text-brand" />
        <p className="text-[14px] font-medium">Memuat data sesi...</p>
      </div>
    )
  }

  if (isProfileLoaded && !companyProfile) {
    return (
      <div className="flex justify-center py-16 animate-in fade-in duration-500">
        <div className="bg-white flex flex-col items-center justify-center p-8 border border-dashed border-border/80 rounded-2xl w-[340px] shadow-sm text-center">
          <div className="bg-brand/10 p-5 rounded-full mb-6">
            <Search className="w-8 h-8 text-brand" strokeWidth={1.5} />
          </div>
          <h3 className="text-[17px] font-bold mb-1 tracking-tight">
            Belum ada profil perusahaan
          </h3>
          <p className="text-center text-muted-foreground mb-8 text-[13px] leading-relaxed">
            Sistem tidak menemukan profil perusahaan target. Silakan kembali ke Recon untuk memulai riset.
          </p>
          <Button onClick={() => router.push("/recon")} className="w-full bg-brand hover:bg-brand/90 text-white rounded-xl font-semibold">
            Mulai Recon
          </Button>
        </div>
      </div>
    )
  }

  // ─── Render: belum mulai ──────────────────────────────────────────────────

  if (!isMatching && !hasMatched) {
    return (
      <div className="flex justify-center py-16 animate-in fade-in duration-500">
        <div className="bg-white flex flex-col items-center justify-center p-8 border border-dashed border-border/80 rounded-2xl w-[280px] shadow-sm">
          <div className="bg-brand/10 p-5 rounded-full mb-6">
            <Play className="w-8 h-8 text-brand ml-1" strokeWidth={1.5} />
          </div>
          <h3 className="text-[17px] font-bold mb-1 text-center tracking-tight">Jalankan AI Matching</h3>
          <p className="text-[13px] text-muted-foreground font-medium mb-3 text-center">
            Target: <span className="font-bold text-foreground">{companyName}</span>
          </p>
          <p className="text-center text-muted-foreground mb-8 text-[13px] leading-relaxed">
            Sistem akan mencari produk di Katalog yang paling tepat untuk menyelesaikan Pain Points perusahaan ini.
          </p>
          <Button onClick={handleStartMatching} className="w-full bg-brand hover:bg-brand/90 text-white rounded-xl font-semibold">
            Mulai Pencocokan
          </Button>
        </div>
      </div>
    )
  }

  // ─── Render: sedang matching ──────────────────────────────────────────────

  if (isMatching) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <h3 className="text-lg font-semibold mb-6 text-center">Menjalankan Agen AI Matching...</h3>
        <LoadingSteps steps={MATCHING_STEPS} currentStep={currentStep} />
      </div>
    )
  }

  // ─── Render: hasil matching ───────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[19px] font-bold tracking-tight">Hasil Pencocokan</h3>
          <p className="text-[13px] text-muted-foreground mt-1">
            Analisis untuk <span className="font-bold text-foreground">{companyName}</span>
          </p>
          <p className="text-[13px] text-muted-foreground mt-1">Pilih satu produk sebelum melanjutkan ke Craft.</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl font-semibold text-[12.5px]" onClick={handleStartMatching}>
          Jalankan Ulang
        </Button>
      </div>

      {/* Product cards */}
      <div className="space-y-4">
        {matches.map((match, idx) => (
          <div
            key={match.id || idx.toString()}
            onClick={() => handleSelectProduct(match.id)}
            className={cn(
              "rounded-2xl border-2 cursor-pointer transition-all duration-200 overflow-hidden",
              selectedId === match.id
                ? "border-brand shadow-md"
                : "border-border/60 hover:border-border hover:shadow-sm"
            )}
          >
            {/* Selection indicator bar */}
            <div className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-[12.5px] font-bold border-b transition-colors",
              selectedId === match.id
                ? "bg-brand text-white border-brand"
                : "bg-muted/30 text-muted-foreground border-border/40"
            )}>
              <div className={cn(
                "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                selectedId === match.id ? "border-white bg-white" : "border-muted-foreground/40"
              )}>
                {selectedId === match.id && <div className="w-2 h-2 rounded-full bg-brand" />}
              </div>
              {selectedId === match.id ? (
                <span className="truncate">Dipilih untuk Campaign — <span className="font-black">{match.name}</span></span>
              ) : "Pilih produk ini"}
              {match.isRecommended && selectedId !== match.id && (
                <span className="ml-auto text-[11px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                  ★ Direkomendasikan
                </span>
              )}
              {match.isRecommended && selectedId === match.id && (
                <span className="ml-auto text-[11px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
                  ★ Direkomendasikan
                </span>
              )}
            </div>
            <div className="bg-white">
              <ProductMatchCard match={match} />
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="pt-5 border-t border-border/40 flex items-center justify-between gap-4">
        {selectedId ? (() => {
          const selected = matches.find(m => m.id === selectedId)
          return (
            <div className="flex items-center gap-3 min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 shrink-0">
                <CheckCircle2 className="w-[18px] h-[18px] text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11.5px] text-emerald-600 font-bold tracking-wide uppercase">Produk Dipilih</p>
                <p className="text-[14px] font-bold text-foreground truncate leading-tight">
                  {selected?.name ?? "—"}
                </p>
              </div>
              {selected?.matchScore != null && (
                <span className="shrink-0 ml-1 inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full bg-brand/10 text-brand border border-brand/20">
                  {selected.matchScore}% cocok
                </span>
              )}
            </div>
          )
        })() : (
          <p className="text-[13px] text-muted-foreground font-medium">Pilih produk di atas untuk melanjutkan.</p>
        )}
        <Button
          onClick={handleProceedToCraft}
          disabled={!selectedId || isProceeding}
          className="bg-brand hover:bg-brand/90 text-white font-bold rounded-xl px-6 h-11 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {isProceeding ? "Menyimpan..." : "Lanjutkan ke Craft"}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
