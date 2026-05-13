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
import { useLanguage } from "@/lib/i18n/LanguageContext"

const SESSION_KEY = "campfire_match_done"
const PRODUCT_KEY = "campfire_selected_product"

export function MatchingTab() {
  const router = useRouter()
  const { t } = useLanguage()

  const MATCHING_STEPS = [
    t("Analyzing company pain points..."),
    t("Scanning your service catalog..."),
    t("Evaluating solution fit..."),
    t("Building value proposition arguments..."),
  ]

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
        toast.error(t("Save profile in Recon first."), {
          description: t("Company ID is invalid. Click 'Save to Database' on the Recon page.")
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
      const msg = e instanceof Error ? e.message : t("Database connection failed.")
      console.error("[MatchingTab] saveCampaignAndMatching error:", e)
      toast.error(t("Failed to save campaign."), { description: msg })
      setIsProceeding(false)
      return
    }
    router.push("/craft")
  }

  // ─── Start Matching ───────────────────────────────────────────────────────

  const handleStartMatching = () => {
    if (!companyProfile) {
      toast.error(t("Company profile not found."), {
        description: t("Run Recon and save the profile first.")
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
      toast.error(t("AI Matching failed."), { description: e instanceof Error ? e.message : "Error" })
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
        <Loader2 className="w-5 h-5 animate-spin text-brand"  strokeWidth={1.5} />
        <p className="text-[14px] font-medium">{t("Loading session data...")}</p>
      </div>
    )
  }

  if (isProfileLoaded && !companyProfile) {
    return (
      <div className="flex justify-center py-16 animate-in fade-in duration-500">
        <div className="bg-white flex flex-col items-center justify-center p-8 border border-dashed border-border/80 rounded-2xl max-w-sm w-full shadow-sm text-center">
          <div className="bg-brand/10 p-5 rounded-full mb-6">
            <Search className="w-8 h-8 text-brand" strokeWidth={1.5} />
          </div>
          <h3 className="text-[17px] font-bold mb-1 tracking-tight">
            {t("No company profile found")}
          </h3>
          <p className="text-center text-muted-foreground mb-8 text-[13px] leading-relaxed">
            {t("No profile found. Please go back to Recon to start research.")}
          </p>
          <Button onClick={() => router.push("/recon")} className="w-full bg-brand hover:bg-brand/90 text-white rounded-xl font-semibold">
            {t("Start Recon")}
          </Button>
        </div>
      </div>
    )
  }

  // ─── Render: belum mulai ──────────────────────────────────────────────────

  if (!isMatching && !hasMatched) {
    return (
      <div className="flex justify-center py-16 animate-in fade-in duration-500">
        <div className="bg-white flex flex-col items-center justify-center p-8 border border-dashed border-border/80 rounded-2xl max-w-sm w-full shadow-sm">
          <div className="bg-brand/10 p-5 rounded-full mb-6">
            <Play className="w-8 h-8 text-brand ml-1" strokeWidth={1.5} />
          </div>
          <h3 className="text-[17px] font-bold mb-1 text-center tracking-tight">{t("Run AI Matching")}</h3>
          <p className="text-[13px] text-muted-foreground font-medium mb-3 text-center">
            Target: <span className="font-bold text-foreground">{companyName}</span>
          </p>
          <p className="text-center text-muted-foreground mb-8 text-[13px] leading-relaxed">
            {t("The system will find the most relevant product in the Catalog to solve the Pain Points of this company.")}
          </p>
          <Button onClick={handleStartMatching} className="w-full bg-brand hover:bg-brand/90 text-white rounded-xl font-semibold">
            {t("Start Matching")}
          </Button>
        </div>
      </div>
    )
  }

  // ─── Render: sedang matching ──────────────────────────────────────────────

  if (isMatching) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <h3 className="text-lg font-semibold mb-6 text-center">{t("Running AI Matching...")}</h3>
        <LoadingSteps steps={MATCHING_STEPS} currentStep={currentStep} />
      </div>
    )
  }

  // ─── Render: hasil matching ───────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[19px] font-bold tracking-tight">{t("Matching Results")}</h3>
          <p className="text-[13px] text-muted-foreground mt-1">
            {t("Analysis for {name}", { name: companyName })}
          </p>
          <p className="text-[13px] text-muted-foreground mt-1">{t("Select one product before continuing to Craft.")}</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl font-semibold text-[12.5px]" onClick={handleStartMatching}>
          {t("Re-run")}
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
                <span className="truncate">{t("Selected for Campaign — {name}", { name: match.name })}</span>
              ) : t("Select this product")}
              {match.isRecommended && selectedId !== match.id && (
                <span className="ml-auto text-[11px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                  ★ {t("Recommended")}
                </span>
              )}
              {match.isRecommended && selectedId === match.id && (
                <span className="ml-auto text-[11px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
                  ★ {t("Recommended")}
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
                <CheckCircle2 className="w-[18px] h-[18px] text-emerald-600"  strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-[11.5px] text-emerald-600 font-bold tracking-wide uppercase">{t("Product Selected")}</p>
                <p className="text-[14px] font-bold text-foreground truncate leading-tight">
                  {selected?.name ?? "—"}
                </p>
              </div>
              {selected?.matchScore != null && (
                <span className="shrink-0 ml-1 inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full bg-brand/10 text-brand border border-brand/20">
                  {t("{score}% match", { score: selected.matchScore })}
                </span>
              )}
            </div>
          )
        })() : (
          <p className="text-[13px] text-muted-foreground font-medium">{t("Select a product above to continue.")}</p>
        )}
        <Button
          onClick={handleProceedToCraft}
          disabled={!selectedId || isProceeding}
          className="bg-brand hover:bg-brand/90 text-white font-bold rounded-xl px-6 h-11 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {isProceeding ? t("Saving...") : t("Continue to Craft")}
          <ArrowRight className="w-4 h-4 ml-2"  strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  )
}
