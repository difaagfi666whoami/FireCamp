import { CompanyProfile } from "@/types/recon.types"
import { ProductMatch } from "@/types/match.types"
import { Campaign } from "@/types/craft.types"
import { supabase, getCurrentUserId, getCurrentSessionToken } from "@/lib/supabase/client"
import { session } from "@/lib/session"

function sq(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }
const API_URL  = sq(process.env.NEXT_PUBLIC_API_URL  ?? "http://localhost:8000")

// -----------------------------------------------------------------------------
// GENERATE CAMPAIGN — panggil FastAPI /api/craft
// -----------------------------------------------------------------------------

export async function generateCampaign(
  companyProfile: CompanyProfile,
  selectedProduct: ProductMatch
): Promise<Campaign> {
  const token = await getCurrentSessionToken()
  const body = {
    companyProfile,
    selectedProduct,
    token_recon: session.getReconTokens(),
    token_match: session.getMatchTokens(),
    campaign_id: session.getCampaignId() ?? undefined,
  }
  const res = await fetch(`${API_URL}/api/craft`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }))
    // Log payload + error detail agar 422 Pydantic bisa didiagnosa di DevTools
    console.error("[Campfire/craft] POST /api/craft failed", {
      status:  res.status,
      detail:  err?.detail,
      error:   err,
      payload: body,
    })
    const detailMsg =
      typeof err?.detail === "string"
        ? err.detail
        : Array.isArray(err?.detail)
        ? err.detail
            .map((d: any) => `${(d.loc || []).join(".")}: ${d.msg}`)
            .join(" | ")
        : `HTTP ${res.status}`
    throw new Error(detailMsg)
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
  const userId = await getCurrentUserId()

  const { error: reasoningErr } = await supabase
    .from("campaigns")
    .update({ reasoning })
    .eq("id", campaignId)

  if (reasoningErr) {
    console.error("[Campfire/craft] update campaign reasoning:", reasoningErr)
    throw new Error(reasoningErr.message)
  }

  // Upsert by (campaign_id, sequence_number) agar re-generate / re-mount
  // tidak menduplikasi baris campaign_emails.
  const { error: emailsErr } = await supabase
    .from("campaign_emails")
    .upsert(
      emails.map(e => ({
        user_id:         userId,
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

  if (emailsErr) {
    console.error("[Campfire/craft] insert campaign_emails:", emailsErr)
    throw new Error(emailsErr.message)
  }
}

// -----------------------------------------------------------------------------
// GET crafted emails dari Supabase (untuk hydration saat session kosong)
// -----------------------------------------------------------------------------

export async function getCraftedEmailsByCompany(companyId: string): Promise<any | null> {
  // Cegat Campaign terbaru milik Company ini (kebal terhadap duplicate rows!)
  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("id, reasoning")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (campErr || !campaign) return null

  // Dengan Campaign.id, raup semua email
  const { data: emails, error: emailErr } = await supabase
    .from("campaign_emails")
    .select("*")
    .eq("campaign_id", campaign.id)
    .order("sequence_number")

  if (emailErr || !emails || emails.length === 0) return null

  return {
    campaignId:    campaign.id,
    reasoning:     campaign.reasoning ?? "",
    targetCompany: "N/A", // diisi ulang dari UI state dengan profile.name
    emails: (emails ?? []).map((e: any) => ({
      id:             e.id,
      sequenceNumber: e.sequence_number,
      dayLabel:       e.day_label,
      scheduledDay:   e.scheduled_day,
      subject:        e.subject,
      body:           e.body,
      tone:           e.tone,
      isApproved:     e.is_approved,
    })),
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
  const userId = await getCurrentUserId()
  const { error } = await supabase
    .from("campaign_emails")
    .upsert(
      emails.map(e => ({
        user_id:         userId,
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

// -----------------------------------------------------------------------------
// REWRITE EMAIL TONE (Panggil AI backend untuk regenerasi specific email)
// -----------------------------------------------------------------------------

export interface RewriteRequestPayload {
  targetCompany: string
  originalSubject: string
  originalBody: string
  campaignReasoning: string
  newTone: string
  sequenceNumber: number
  campaign_id?: string
}

export interface RewriteResponsePayload {
  subject: string
  body: string
  tone: string
}

export async function regenerateEmailTone(req: RewriteRequestPayload): Promise<RewriteResponsePayload> {
  const token = await getCurrentSessionToken()
  const res = await fetch(`${API_URL}/api/craft/rewrite`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(req),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }))
    const detailMsg =
      typeof err?.detail === "string"
        ? err.detail
        : Array.isArray(err?.detail)
        ? err.detail.map((d: any) => `${(d.loc || []).join(".")}: ${d.msg}`).join(" | ")
        : `HTTP ${res.status}`
    throw new Error(detailMsg)
  }

  return res.json()
}
