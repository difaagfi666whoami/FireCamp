// Centralized sessionStorage key management untuk cross-page state passing.
// Pisah dari lib/progress.ts yang hanya track completion flags.

const KEYS = {
  COMPANY_ID:          "campfire_company_id",        // Supabase UUID setelah Recon save
  CAMPAIGN_ID:         "campfire_campaign_id",        // Supabase UUID setelah Match proceed
  SELECTED_PRODUCT_ID: "campfire_selected_product",  // Product UUID dipilih di Match
  RECON_PROFILE:       "campfire_recon_profile",      // Full CompanyProfile dari Recon generate
  CRAFT_CAMPAIGN:      "campfire_craft_campaign",     // Generated Campaign dari Craft
  MATCH_RESULTS:       "campfire_match_results",      // ProductMatch[] hasil AI matching
} as const

function ss(key: string): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(key)
}

function triggerChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("campfire_session_changed"))
}

function set(key: string, value: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(key, value)
    triggerChange()
  }
}

export const session = {
  getCompanyId:           ()           => ss(KEYS.COMPANY_ID),
  setCompanyId: (id: string) => {
    if (typeof window !== "undefined") {
      const oldId = sessionStorage.getItem(KEYS.COMPANY_ID)
      if (oldId && oldId !== id) {
        // Target company is switching. Nuke ALL downstream + recon profile
        // so the new target mounts fresh and re-hydrates from DB.
        sessionStorage.removeItem(KEYS.CAMPAIGN_ID)
        sessionStorage.removeItem(KEYS.SELECTED_PRODUCT_ID)
        sessionStorage.removeItem(KEYS.CRAFT_CAMPAIGN)
        sessionStorage.removeItem(KEYS.RECON_PROFILE)
        sessionStorage.removeItem("campfire_match_results")
        sessionStorage.removeItem("campfire_match_done")
        sessionStorage.removeItem("campfire_craft_done")
      }
    }
    set(KEYS.COMPANY_ID, id)
  },

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

  // Full ProductMatch[] hasil AI matching (stored di Match tab, dibaca oleh Craft)
  getMatchResults: (): any[] | null => {
    const raw = ss(KEYS.MATCH_RESULTS)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : null
    } catch { return null }
  },
  setMatchResults: (data: any) => set(KEYS.MATCH_RESULTS, JSON.stringify(data)),

  // Validates that an ID is a real Supabase UUID (not a mock ID like "profile-001")
  isValidUuid: (id: string): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),

  // Hapus semua data target aktif dari sessionStorage dan beritahu UI
  clearActiveTarget: (): void => {
    if (typeof window === "undefined") return
    Object.values(KEYS).forEach(k => sessionStorage.removeItem(k))
    window.dispatchEvent(new Event("campfire_session_changed"))
  },
}
