import { supabase } from "@/lib/supabase/client"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface UserProfileData {
  senderName: string
  senderTitle: string
  signature: string
  workspaceName: string
  onboardingCompleted?: boolean
}

export interface UserProfileRow {
  id: string
  user_id: string
  sender_name: string
  sender_title: string
  signature: string
  workspace_name: string
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// saveUserProfile — upsert sender identity to user_profiles table.
// Fire-and-forget safe: silently logs on failure, never throws.
// -----------------------------------------------------------------------------

export async function saveUserProfile(
  data: UserProfileData
): Promise<{ error: string | null }> {
  try {
    const { data: userData, error: authError } = await supabase.auth.getUser()
    if (authError || !userData.user) {
      console.error("[profile] Gagal mengambil user saat menyimpan profil:", authError?.message)
      return { error: "User tidak terautentikasi" }
    }

    const payload: Record<string, unknown> = {
      user_id:        userData.user.id,
      sender_name:    data.senderName,
      sender_title:   data.senderTitle,
      signature:      data.signature,
      workspace_name: data.workspaceName,
      updated_at:     new Date().toISOString(),
    }
    if (data.onboardingCompleted === true) {
      payload.onboarding_completed = true
    }

    const { error: upsertError } = await supabase
      .from("user_profiles")
      .upsert(payload, { onConflict: "user_id" })

    if (upsertError) {
      console.error("[profile] Gagal menyimpan profil ke database:", upsertError.message)
      return { error: upsertError.message }
    }

    return { error: null }
  } catch (err) {
    console.error("[profile] Unexpected error saat menyimpan profil:", err)
    return { error: "Terjadi kesalahan tak terduga" }
  }
}

// -----------------------------------------------------------------------------
// getUserProfile — fetch current user's sender identity profile.
// Returns null if not found or user is not authenticated.
// -----------------------------------------------------------------------------

export async function getUserProfile(): Promise<UserProfileRow | null> {
  try {
    const { data: userData, error: authError } = await supabase.auth.getUser()
    if (authError || !userData.user) {
      return null
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle()

    if (error || !data) {
      return null
    }

    return data as UserProfileRow
  } catch (err) {
    console.error("[profile] Gagal mengambil profil:", err)
    return null
  }
}
