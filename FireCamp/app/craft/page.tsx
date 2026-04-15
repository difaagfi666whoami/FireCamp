"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Bot, ArrowRight, ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { mockData } from "@/lib/mock/mockdata"
import { LoadingSteps } from "@/components/shared/LoadingSteps"
import { session } from "@/lib/session"
import { generateCampaign, saveCraftedEmails, getCraftedEmailsByCompany } from "@/lib/api/craft"
import { getProductById } from "@/lib/api/catalog"
import { getCampaignWithMatchResult } from "@/lib/api/match"
import { updateCompanyProgress } from "@/lib/api/recon"
import { ProductMatch } from "@/types/match.types"
import { CampaignReasoning } from "./components/CampaignReasoning"
import { EmailPreviewCard } from "./components/EmailPreviewCard"
import { Campaign } from "@/types/craft.types"
import { toast } from "sonner"

const CRAFTING_STEPS = [
  "Menganalisis profil perusahaan & pain points...",
  "Memuat produk yang matched dan reasoning...",
  "Menyusun Email 1 — Ice-breaker...",
  "Menyusun Email 2 — Pain-focused follow-up...",
  "Menyusun Email 3 — Urgency & close...",
  "Finalisasi campaign plan & reasoning..."
]

const SESSION_KEY = "campfire_craft_done"

function sq(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }
const IS_LIVE = sq(process.env.NEXT_PUBLIC_USE_MOCK ?? "true") !== "true"

export default function CraftPage() {
  const router = useRouter()

  const [hasStarted, setHasStarted] = useState(false)
  const [isCrafting, setIsCrafting] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [realCampaign, setRealCampaign] = useState<Campaign | null>(null)
  const [companyProfile, setCompanyProfile] = useState<any>(null)
  const [isProfileLoaded, setIsProfileLoaded] = useState(false)

  // ─── Mount: restore from sessionStorage (client-only) ───────────────────
  // Must be declared BEFORE crafting useEffect so it runs first.

  useEffect(() => {
    const profile = session.getReconProfile()
    if (profile) setCompanyProfile(profile)
    setIsProfileLoaded(true)

    const cached = session.getCraftCampaign()
    const cachedValid =
      cached && Array.isArray(cached.emails) && cached.emails.length > 0 &&
      typeof cached.reasoning === "string" && cached.reasoning.trim().length > 0

    if (sessionStorage.getItem(SESSION_KEY) === "1" && cachedValid) {
      // Session hit — restore from local storage. Jangan re-save ke DB:
      // itu membuat duplikasi baris campaign_emails setiap kali mount.
      setRealCampaign(cached)
      setHasStarted(true)
    } else if (profile?.id && session.isValidUuid(profile.id)) {
      // Purge stale/empty session biar hydration DB tidak di-bypass
      sessionStorage.removeItem(SESSION_KEY)
      // HYDRATION: User merevisit tab Craft! (cari lewat companyId dari Profile!)
      getCraftedEmailsByCompany(profile.id).then(dbData => {
        if (dbData) {
          dbData.targetCompany = profile.name
          setRealCampaign(dbData)
          setHasStarted(true)
          session.setCampaignId(dbData.campaignId)
          session.setCraftCampaign(dbData)
          sessionStorage.setItem(SESSION_KEY, "1")
        }
      }).catch(console.error)
    }
  }, [])

  // ─── Crafting useEffect ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isCrafting) return

    if (!IS_LIVE) {
      // Mock mode — animation only, data from mockData
      const interval = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= CRAFTING_STEPS.length - 1) {
            clearInterval(interval)
            setTimeout(() => {
              sessionStorage.setItem(SESSION_KEY, "1")
              session.setCraftCampaign(mockData.campaign)
              setIsCrafting(false)
              let campaignId = session.getCampaignId()
              if (!campaignId) {
                session.setCampaignId("mock-campaign-id")
                campaignId = "mock-campaign-id"
              }
              saveCraftedEmails(
                campaignId,
                mockData.campaign.emails.map((e: any) => ({
                  sequenceNumber: e.sequenceNumber,
                  dayLabel:       e.dayLabel,
                  scheduledDay:   e.scheduledDay,
                  subject:        e.subject,
                  body:           e.body,
                  tone:           e.tone,
                  isApproved:     e.isApproved,
                })),
                mockData.campaign.reasoning
              ).catch(e => console.error("[CraftPage] saveCraftedEmails:", e))
              const companyId = session.getCompanyId()
              if (companyId && session.isValidUuid(companyId)) {
                updateCompanyProgress(companyId, "craft").catch(console.error)
              }
            }, 800)
            return prev
          }
          return prev + 1
        })
      }, 700)
      return () => clearInterval(interval)
    }

    // Live mode — concurrent: animasi + API call
    let resolvedCampaign: Campaign | null | undefined = undefined
    let animDone = false

    const settle = () => {
      if (!animDone || resolvedCampaign === undefined) return

      // Guard: tolak campaign kosong/invalid agar session tidak ter-pollute
      const valid =
        !!resolvedCampaign &&
        Array.isArray(resolvedCampaign.emails) &&
        resolvedCampaign.emails.length >= 3 &&
        typeof resolvedCampaign.reasoning === "string" &&
        resolvedCampaign.reasoning.trim().length > 0 &&
        resolvedCampaign.emails.every(
          (e: any) => (e?.subject ?? "").trim() && (e?.body ?? "").trim()
        )

      if (resolvedCampaign !== null && !valid) {
        toast.error("AI mengembalikan campaign kosong.", {
          description: "Respons AI invalid / terpotong. Silakan coba generate ulang.",
        })
        resolvedCampaign = null
      }

      if (resolvedCampaign !== null) {
        setRealCampaign(resolvedCampaign)
        session.setCraftCampaign(resolvedCampaign)
        sessionStorage.setItem(SESSION_KEY, "1")

        const campaignId = session.getCampaignId()
        const companyId  = session.getCompanyId()

        if (campaignId) {
          saveCraftedEmails(
            campaignId,
            resolvedCampaign.emails.map(e => ({
              sequenceNumber: e.sequenceNumber,
              dayLabel:       e.dayLabel,
              scheduledDay:   e.scheduledDay,
              subject:        e.subject,
              body:           e.body,
              tone:           e.tone,
              isApproved:     e.isApproved,
            })),
            resolvedCampaign.reasoning
          ).catch(e => console.error("[CraftPage] saveCraftedEmails:", e))
        }
        if (companyId) {
          updateCompanyProgress(companyId, "craft").catch(console.error)
        }
      }
      setIsCrafting(false)
    }

    // Kick off API call concurrently with animation
    ;(async () => {
      try {
        const companyProfile  = session.getReconProfile() ?? mockData.company
        const selectedId      = session.getSelectedProductId()

        if (!selectedId) {
          toast.error("Produk tidak ditemukan.", { description: "Kembali ke Match dan pilih produk terlebih dahulu." })
          resolvedCampaign = null
          settle()
          return
        }

        // 1) Prefer session match results (rich ProductMatch w/ reasoning)
        let fullProductMatch: ProductMatch | null = null
        const cachedMatches = session.getMatchResults()
        if (cachedMatches && cachedMatches.length > 0) {
          const hit = cachedMatches.find((m: any) => m.id === selectedId)
          if (hit && hit.reasoning !== undefined) {
            // Hydration dari DB hanya mengembalikan baris sparse (tanpa
            // tagline/description/price/usp/painCategories/source). Selalu
            // enrich dari katalog kalau ada field ProductCatalogItem yang hilang.
            const needsEnrich =
              !hit.tagline || !hit.description || hit.price === undefined ||
              !Array.isArray(hit.usp) || !Array.isArray(hit.painCategories) ||
              !hit.source
            if (needsEnrich) {
              const catalog = await getProductById(selectedId).catch(() => null)
              fullProductMatch = {
                id:             hit.id,
                name:           hit.name ?? catalog?.name ?? "",
                tagline:        hit.tagline ?? catalog?.tagline ?? "",
                description:    hit.description ?? catalog?.description ?? "",
                price:          hit.price ?? catalog?.price ?? "",
                painCategories: Array.isArray(hit.painCategories)
                  ? hit.painCategories
                  : (catalog?.painCategories ?? []),
                usp:            Array.isArray(hit.usp) ? hit.usp : (catalog?.usp ?? []),
                source:         (hit.source ?? catalog?.source ?? "manual") as ProductMatch["source"],
                createdAt:      hit.createdAt ?? catalog?.createdAt ?? "",
                updatedAt:      hit.updatedAt ?? catalog?.updatedAt ?? "",
                matchScore:           hit.matchScore ?? 0,
                addressedPainIndices: hit.addressedPainIndices ?? [],
                reasoning:            hit.reasoning ?? "",
                isRecommended:        hit.isRecommended ?? false,
              }
            } else {
              fullProductMatch = hit as ProductMatch
            }
          }
        }

        // 2) Fallback: hydrate from Supabase matching_results
        if (!fullProductMatch && companyProfile?.id && session.isValidUuid(companyProfile.id)) {
          const dbMatch = await getCampaignWithMatchResult(companyProfile.id).catch(() => null)
          const dbHit   = dbMatch?.matches.find((m: any) => m.id === selectedId) ?? null
          if (dbHit) {
            // DB rows are sparse — enrich with catalog item for missing fields
            const catalog = await getProductById(selectedId).catch(() => null)
            fullProductMatch = {
              id:             selectedId,
              name:           dbHit.name ?? catalog?.name ?? "",
              tagline:        catalog?.tagline ?? "",
              description:    catalog?.description ?? "",
              price:          catalog?.price ?? "",
              painCategories: catalog?.painCategories ?? [],
              usp:            catalog?.usp ?? [],
              source:         (catalog?.source ?? "manual") as ProductMatch["source"],
              createdAt:      catalog?.createdAt ?? "",
              updatedAt:      catalog?.updatedAt ?? "",
              matchScore:           dbHit.matchScore ?? 0,
              addressedPainIndices: dbHit.addressedPainIndices ?? [],
              reasoning:            dbHit.reasoning ?? "",
              isRecommended:        dbHit.isRecommended ?? false,
            }
          }
        }

        // 3) Last-resort: catalog item only (no AI reasoning — degraded mode)
        if (!fullProductMatch) {
          const catalog = await getProductById(selectedId)
          if (!catalog) {
            toast.error("Produk tidak ditemukan.", { description: "Kembali ke Match dan pilih produk terlebih dahulu." })
            resolvedCampaign = null
            settle()
            return
          }
          fullProductMatch = {
            ...catalog,
            matchScore:           0,
            addressedPainIndices: [],
            reasoning:            "",
            isRecommended:        false,
          }
        }

        const campaign = await generateCampaign(companyProfile, fullProductMatch)
        resolvedCampaign = campaign
        settle()
      } catch (e) {
        toast.error("AI Campaign Craft gagal.", { description: e instanceof Error ? e.message : "Error" })
        resolvedCampaign = null
        settle()
      }
    })()

    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= CRAFTING_STEPS.length - 1) {
          clearInterval(interval)
          animDone = true
          settle()
          return prev  // stay at last step while waiting for API
        }
        return prev + 1
      })
    }, 700)

    return () => clearInterval(interval)
  }, [isCrafting])

  const handleStartCrafting = () => {
    setHasStarted(true)
    setIsCrafting(true)
  }

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
            <Bot className="w-8 h-8 text-brand" strokeWidth={1.5} />
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

  // ─── Render: idle ─────────────────────────────────────────────────────────

  if (!hasStarted && !isCrafting) {
    const companyName = companyProfile.name

    return (
      <div className="flex justify-center py-16 animate-in fade-in duration-500">
        <div className="bg-white flex flex-col items-center justify-center p-8
                        border border-dashed border-border/80 rounded-2xl
                        w-[320px] shadow-sm text-center">
          <div className="bg-brand/10 p-5 rounded-full mb-6">
            <Bot className="w-8 h-8 text-brand" strokeWidth={1.5} />
          </div>
          <h3 className="text-[17px] font-bold mb-1 tracking-tight">
            Generate Email Campaign
          </h3>
          <p className="text-[13px] text-muted-foreground font-medium mb-1">
            Target: <span className="font-bold text-foreground">{companyName}</span>
          </p>
          <p className="text-center text-muted-foreground mb-8 text-[13px] leading-relaxed">
            AI akan menyusun 3 email sequence yang dipersonalisasi berdasarkan
            pain points dan produk yang telah dipilih.
          </p>
          <Button
            onClick={handleStartCrafting}
            className="w-full bg-brand hover:bg-brand/90 text-white rounded-xl font-semibold"
          >
            Mulai Generate Campaign
          </Button>
        </div>
      </div>
    )
  }

  // ─── Render: loading ──────────────────────────────────────────────────────

  if (isCrafting) {
    return (
      <div className="p-8 max-w-2xl mx-auto py-20 animate-in fade-in duration-500">
        <div className="flex flex-col items-center mb-10">
          <div className="bg-brand/10 p-5 rounded-full mb-5 relative shadow-sm border border-brand/20">
            <Bot className="w-9 h-9 text-brand" strokeWidth={1.5} />
            <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-brand rounded-full animate-ping opacity-75"></div>
            <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-brand rounded-full border-2 border-white"></div>
          </div>
          <h2 className="text-[22px] font-bold tracking-tight mb-2">AI Campaign Crafter</h2>
          <p className="text-muted-foreground text-center text-[14.5px] max-w-sm">
            Menyusun sekuens email yang highly-personalized berdasarkan hasil analisis dan matching.
          </p>
        </div>
        <LoadingSteps steps={CRAFTING_STEPS} currentStep={currentStep} />
      </div>
    )
  }

  // ─── Render: hasil ────────────────────────────────────────────────────────

  const liveCandidate = IS_LIVE ? (realCampaign ?? session.getCraftCampaign()) : null
  const liveValid =
    !!liveCandidate &&
    Array.isArray(liveCandidate.emails) &&
    liveCandidate.emails.length > 0 &&
    typeof liveCandidate.reasoning === "string" &&
    liveCandidate.reasoning.trim().length > 0

  // LIVE mode: kalau belum ada campaign valid, JANGAN jatuh ke mockData —
  // kembalikan user ke idle agar bisa generate ulang dengan data bersih.
  if (IS_LIVE && !liveValid) {
    return (
      <div className="flex justify-center py-16 animate-in fade-in duration-500">
        <div className="bg-white flex flex-col items-center justify-center p-8
                        border border-dashed border-border/80 rounded-2xl
                        w-[340px] shadow-sm text-center">
          <div className="bg-brand/10 p-5 rounded-full mb-6">
            <Bot className="w-8 h-8 text-brand" strokeWidth={1.5} />
          </div>
          <h3 className="text-[17px] font-bold mb-1 tracking-tight">
            Belum ada campaign valid
          </h3>
          <p className="text-[13px] text-muted-foreground font-medium mb-4">
            Target: <span className="font-bold text-foreground">{companyProfile.name}</span>
          </p>
          <p className="text-center text-muted-foreground mb-8 text-[13px] leading-relaxed">
            Generate sebelumnya gagal atau kosong. Coba generate ulang sekarang.
          </p>
          <Button
            onClick={() => {
              sessionStorage.removeItem(SESSION_KEY)
              setRealCampaign(null)
              setHasStarted(true)
              setIsCrafting(true)
              setCurrentStep(0)
            }}
            className="w-full bg-brand hover:bg-brand/90 text-white rounded-xl font-semibold"
          >
            Generate Ulang Campaign
          </Button>
        </div>
      </div>
    )
  }

  const campaign = (liveCandidate ?? mockData.campaign) as unknown as Campaign

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
      <div className="flex items-start justify-between border-b pb-6 border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaign Plan Draft</h1>
          <p className="text-muted-foreground mt-1.5 text-[14.5px] font-medium">
            Draft email yang digenerate khusus untuk{" "}
            <span className="font-bold text-foreground">{campaign.targetCompany}</span>.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/match")} className="shadow-sm font-semibold text-[13.5px]">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <Button onClick={() => router.push("/polish")} className="bg-brand hover:bg-brand/90 text-white shadow-sm font-semibold text-[13.5px]">
            Lanjut ke Polish
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      <CampaignReasoning reasoning={campaign.reasoning} />

      <div className="space-y-6 pt-2">
        <h2 className="text-[19px] font-bold tracking-tight border-b pb-3 border-border/60">
          Sequence Email (3 Draft)
        </h2>
        <div className="space-y-6">
          {campaign.emails.map((email: any) => (
            <EmailPreviewCard key={email.id ?? email.sequenceNumber} email={email} />
          ))}
        </div>
      </div>

      <div className="pt-8 flex justify-end pb-12 border-t border-border/40 mt-12">
        <Button
          onClick={() => router.push("/polish")}
          size="lg"
          className="w-full sm:w-auto bg-brand hover:bg-brand/90 text-white shadow-md font-bold text-[15px] h-12 px-8 rounded-xl"
        >
          Lanjutkan ke Editor (Polish)
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  )
}
