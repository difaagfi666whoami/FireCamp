import { CompanyProfile } from "@/types/recon.types"
import { ProductMatch } from "@/types/match.types"
import { mockData } from "@/lib/mock/mockdata"
import { supabase, getCurrentUserId, getCurrentSessionToken } from "@/lib/supabase/client"
import { session } from "@/lib/session"
import { isMockMode } from "@/lib/demoMode"
import { notifyCreditsChanged } from "@/lib/api/credits"

function sq(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }
const API_URL  = sq(process.env.NEXT_PUBLIC_API_URL  ?? "http://localhost:8000")

// Deteksi valid UUID untuk membedakan mock ID ("prod-001") vs Supabase UUID
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// -----------------------------------------------------------------------------
// RUN MATCHING — panggil FastAPI /api/match
// -----------------------------------------------------------------------------

export async function runMatching(companyProfile: CompanyProfile): Promise<ProductMatch[]> {
  if (isMockMode()) return mockData.matchingResults as unknown as ProductMatch[]

  const token = await getCurrentSessionToken()
  const res = await fetch(`${API_URL}/api/match`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      companyProfile,
      campaign_id: session.getCampaignId() ?? undefined,
    }),
  })

  if (!res.ok) {
    if (res.status === 402 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("campfire_out_of_credits"))
    }
    const err = await res.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  notifyCreditsChanged()
  const body = await res.json() as { matches: ProductMatch[]; tokens_used: number }

  // Simpan token di sessionStorage agar bisa dibawa ke /api/craft (campaign_id
  // belum ada saat Match berjalan).
  if (typeof body?.tokens_used === "number" && body.tokens_used > 0) {
    session.setMatchTokens(body.tokens_used)
  }

  return body.matches ?? []
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
  _selectedProductName: string,
  matchResults: RawMatchResult[],
  existingCampaignId?: string | null
): Promise<string> {
  if (!UUID_RE.test(companyId)) {
    throw new Error(`[Campfire/match] companyId bukan UUID valid: "${companyId}". Simpan profil recon terlebih dahulu.`)
  }

  const userId = await getCurrentUserId()
  const isRealUuid = UUID_RE.test(selectedProductId)

  // 1. Simpan atau perbarui Campaign
  let finalCampaignId = existingCampaignId ?? null

  if (finalCampaignId && UUID_RE.test(finalCampaignId)) {
    // Coba update data yang sudah ada
    const { data: updated, error: updateErr } = await supabase
      .from("campaigns")
      .update({
        selected_product_id:   isRealUuid ? selectedProductId : null,
        selected_product_name: _selectedProductName,
      })
      .eq("id", finalCampaignId)
      .select("id")
      .maybeSingle()

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
        user_id:               userId,
        company_id:            companyId,
        selected_product_id:   isRealUuid ? selectedProductId : null,
        selected_product_name: _selectedProductName,
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

  // 2. Bersihkan dan masukkan ulang SELURUH match results agar user bisa
  //    memilih produk lain setelah hydration tanpa re-run AI matching.
  //    DELETE-then-INSERT mencegah `matching_results` ter-dump berulang.
  if (matchResults.length > 0) {
    await supabase.from("matching_results").delete().eq("campaign_id", finalCampaignId)

    const { error: matchErr } = await supabase
      .from("matching_results")
      .insert(
        matchResults.map(m => ({
          user_id:                userId,
          campaign_id:            finalCampaignId,
          product_id:             UUID_RE.test(m.productId) ? m.productId : null,
          product_name:           m.productName,
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

// -----------------------------------------------------------------------------
// GET campaign + matching results dari Supabase (untuk hydration)
// Dipanggil saat sessionStorage kosong tapi progress match sudah true di DB
// -----------------------------------------------------------------------------

export async function getCampaignWithMatchResult(
  companyId: string
): Promise<{ campaignId: string; selectedProductId: string | null; matches: any[] } | null> {
  // 1. Dapatkan campaign dari companyId (kebal terhadap duplicate rows!)
  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("id, selected_product_id, selected_product_name")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (campErr || !campaign) return null

  // 2. Dapatkan rekaman matching_results yang terkait dengan campaign_id
  const { data: results, error: matchErr } = await supabase
    .from("matching_results")
    .select("product_id, product_name, match_score, addressed_pain_indices, reasoning, is_recommended")
    .eq("campaign_id", campaign.id)
    .order("match_score", { ascending: false })

  if (matchErr) return null

  return {
    campaignId:        campaign.id,
    selectedProductId: campaign.selected_product_id ?? campaign.selected_product_name ?? null,
    matches: (results || []).map((r: any) => ({
      id:                   r.product_id ?? r.product_name,
      name:                 r.product_name ?? "Unknown Product",
      matchScore:           r.match_score,
      addressedPainIndices: r.addressed_pain_indices,
      reasoning:            r.reasoning,
      isRecommended:        r.is_recommended,
    })),
  }
}
