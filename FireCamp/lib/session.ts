// Centralized sessionStorage key management untuk cross-page state passing.
// Pisah dari lib/progress.ts yang hanya track completion flags.

const KEYS = {
  COMPANY_ID:          "campfire_company_id",        // Supabase UUID setelah Recon save
  CAMPAIGN_ID:         "campfire_campaign_id",        // Supabase UUID setelah Match proceed
  SELECTED_PRODUCT_ID: "campfire_selected_product",  // Product UUID dipilih di Match
  RECON_PROFILE:       "campfire_recon_profile",      // Full CompanyProfile dari Recon generate
  CRAFT_CAMPAIGN:      "campfire_craft_campaign",     // Generated Campaign dari Craft
} as const

function ss(key: string): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(key)
}

function set(key: string, value: string): void {
  if (typeof window !== "undefined") sessionStorage.setItem(key, value)
}

export const session = {
  getCompanyId:           ()           => ss(KEYS.COMPANY_ID),
  setCompanyId:           (id: string) => set(KEYS.COMPANY_ID, id),

  getCampaignId:          ()           => ss(KEYS.CAMPAIGN_ID),
  setCampaignId:          (id: string) => set(KEYS.CAMPAIGN_ID, id),

  getSelectedProductId:   ()           => ss(KEYS.SELECTED_PRODUCT_ID),
  setSelectedProductId:   (id: string) => set(KEYS.SELECTED_PRODUCT_ID, id),

  // Full CompanyProfile JSON (stored after Recon generate, read by Match & Craft)
  getReconProfile:        ()           => {
    const raw = ss(KEYS.RECON_PROFILE)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  },
  setReconProfile:        (profile: any) => set(KEYS.RECON_PROFILE, JSON.stringify(profile)),

  // Generated Campaign JSON (stored after Craft generate, read by Polish)
  getCraftCampaign:       ()           => {
    const raw = ss(KEYS.CRAFT_CAMPAIGN)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  },
  setCraftCampaign:       (campaign: any) => set(KEYS.CRAFT_CAMPAIGN, JSON.stringify(campaign)),

  // Validates that an ID is a real Supabase UUID (not a mock ID like "profile-001")
  isValidUuid: (id: string): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
}
