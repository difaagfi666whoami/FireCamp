import { CompanyProfile } from "@/types/recon.types"
import { ProductCatalogItem } from "@/types/match.types"
import { Campaign } from "@/types/craft.types"
import { mockData } from "@/lib/mock/mockdata"
import { supabase } from "@/lib/supabase/client"

function sq(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }
const USE_MOCK = sq(process.env.NEXT_PUBLIC_USE_MOCK ?? "true") === "true"
const API_URL  = sq(process.env.NEXT_PUBLIC_API_URL  ?? "http://localhost:8000")

// -----------------------------------------------------------------------------
// GENERATE CAMPAIGN — panggil FastAPI /api/craft
// -----------------------------------------------------------------------------

export async function generateCampaign(
  companyProfile: CompanyProfile,
  selectedProduct: ProductCatalogItem
): Promise<Campaign> {
  if (USE_MOCK) return mockData.campaign as unknown as Campaign

  const res = await fetch(`${API_URL}/api/craft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyProfile, selectedProduct }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  return res.json()
}

// -----------------------------------------------------------------------------
// SAVE crafted emails ke Supabase (fire-and-forget dari CraftPage)
// -----------------------------------------------------------------------------

export async function saveCraftedEmails(
  campaignId: string,
  emails: Array<{
    sequenceNumber: number
    dayLabel: string
    scheduledDay: number
    subject: string
    body: string
    tone: string
    isApproved: boolean
  }>,
  reasoning: string
): Promise<void> {
  const { error: reasoningErr } = await supabase
    .from("campaigns")
    .update({ reasoning })
    .eq("id", campaignId)

  if (reasoningErr) {
    console.error("[Campfire/craft] update campaign reasoning:", reasoningErr)
    throw new Error(reasoningErr.message)
  }

  const { error: emailsErr } = await supabase
    .from("campaign_emails")
    .insert(
      emails.map(e => ({
        campaign_id:     campaignId,
        sequence_number: e.sequenceNumber,
        day_label:       e.dayLabel,
        scheduled_day:   e.scheduledDay,
        subject:         e.subject,
        body:            e.body,
        tone:            e.tone,
        is_approved:     e.isApproved,
        status:          "draft",
      }))
    )

  if (emailsErr) {
    console.error("[Campfire/craft] insert campaign_emails:", emailsErr)
    throw new Error(emailsErr.message)
  }
}

// -----------------------------------------------------------------------------
// SYNC polished emails ke Supabase (fire-and-forget dari PolishPage)
// -----------------------------------------------------------------------------

export async function syncPolishedEmails(
  campaignId: string,
  emails: Array<{
    sequenceNumber: number
    dayLabel:       string
    scheduledDay:   number
    tone:           string
    subject:        string
    body:           string
    isApproved:     boolean
  }>
): Promise<void> {
  const { error } = await supabase
    .from("campaign_emails")
    .upsert(
      emails.map(e => ({
        campaign_id:     campaignId,
        sequence_number: e.sequenceNumber,
        day_label:       e.dayLabel,
        scheduled_day:   e.scheduledDay,
        subject:         e.subject,
        body:            e.body,
        tone:            e.tone,
        is_approved:     e.isApproved,
        status:          "draft",
      })),
      { onConflict: "campaign_id,sequence_number" }
    )

  if (error) {
    console.error("[Campfire/craft] syncPolishedEmails:", error)
    throw error
  }
}
