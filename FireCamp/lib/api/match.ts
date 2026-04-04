import { CompanyProfile } from "@/types/recon.types"
import { ProductMatch } from "@/types/match.types"
import { mockData } from "@/lib/mock/mockdata"
import { supabase } from "@/lib/supabase/client"

function sq(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }
const USE_MOCK = sq(process.env.NEXT_PUBLIC_USE_MOCK ?? "true") === "true"
const API_URL  = sq(process.env.NEXT_PUBLIC_API_URL  ?? "http://localhost:8000")

// Deteksi valid UUID untuk membedakan mock ID ("prod-001") vs Supabase UUID
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// -----------------------------------------------------------------------------
// RUN MATCHING — panggil FastAPI /api/match
// -----------------------------------------------------------------------------

export async function runMatching(companyProfile: CompanyProfile): Promise<ProductMatch[]> {
  if (USE_MOCK) return mockData.matchingResults as unknown as ProductMatch[]

  const res = await fetch(`${API_URL}/api/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyProfile }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  return res.json()
}

// -----------------------------------------------------------------------------
// Internal RawMatchResult type
// -----------------------------------------------------------------------------

interface RawMatchResult {
  productId: string
  productName: string
  matchScore: number
  addressedPainIndices: number[]
  reasoning: string
  isRecommended: boolean
}

// -----------------------------------------------------------------------------
// SAVE campaign + matching results ke Supabase
// Dipanggil dari MatchingTab saat user klik "Lanjutkan ke Craft"
// -----------------------------------------------------------------------------

export async function saveCampaignAndMatching(
  companyId: string,
  selectedProductId: string,
  selectedProductName: string,
  matchResults: RawMatchResult[]
): Promise<string> {
  if (!UUID_RE.test(companyId)) {
    throw new Error(`[Campfire/match] companyId bukan UUID valid: "${companyId}". Simpan profil recon terlebih dahulu.`)
  }

  const isRealUuid = UUID_RE.test(selectedProductId)

  const { data: campaign, error: campaignErr } = await supabase
    .from("campaigns")
    .insert({
      company_id:            companyId,
      selected_product_id:   isRealUuid ? selectedProductId : null,
      status:                "draft",
      automation_mode:       "ai",
    })
    .select("id")
    .single()

  if (campaignErr) {
    console.error("[Campfire/match] insert campaign:", campaignErr)
    throw new Error(campaignErr.message)
  }

  const campaignId: string = campaign.id

  if (matchResults.length) {
    const { error: matchErr } = await supabase
      .from("matching_results")
      .insert(
        matchResults.map(m => ({
          campaign_id:            campaignId,
          product_id:             UUID_RE.test(m.productId) ? m.productId : null,
          match_score:            m.matchScore,
          addressed_pain_indices: m.addressedPainIndices,
          reasoning:              m.reasoning,
          is_recommended:         m.isRecommended,
        }))
      )
    if (matchErr) {
      console.error("[Campfire/match] insert matching_results:", matchErr)
      throw new Error(matchErr.message)
    }
  }

  return campaignId
}
