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
  matchResults: RawMatchResult[],
  existingCampaignId?: string | null
): Promise<string> {
  if (!UUID_RE.test(companyId)) {
    throw new Error(`[Campfire/match] companyId bukan UUID valid: "${companyId}". Simpan profil recon terlebih dahulu.`)
  }

  const isRealUuid = UUID_RE.test(selectedProductId)

  // 1. Simpan atau perbarui Campaign
  let finalCampaignId = existingCampaignId ?? null

  if (finalCampaignId && UUID_RE.test(finalCampaignId)) {
    // Coba update data yang sudah ada
    const { data: updated, error: updateErr } = await supabase
      .from("campaigns")
      .update({
        selected_product_id: isRealUuid ? selectedProductId : null,
      })
      .eq("id", finalCampaignId)
      .select("id")
      .single()

    if (updateErr || !updated) {
      console.warn("[Campfire/match] Update campaign gagal, fallback insert baru", updateErr)
      finalCampaignId = null
    }
  }

  if (!finalCampaignId) {
    // Insert baru
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
    finalCampaignId = campaign.id
  }

  // 2. Bersihkan dan masukkan ulang Matching Results (HANYA PRODUK TERPILIH)
  const filteredMatches = matchResults.filter(m => m.productId === selectedProductId)

  if (filteredMatches.length > 0) {
    // Hapus sisa-sisa hasil terdahulu dari ID campaign ini agar tidak ganda
    await supabase.from("matching_results").delete().eq("campaign_id", finalCampaignId)

    const { error: matchErr } = await supabase
      .from("matching_results")
      .insert(
        filteredMatches.map(m => ({
          campaign_id:            finalCampaignId,
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

  return finalCampaignId!
}
