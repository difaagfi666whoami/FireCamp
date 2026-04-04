// Session-based progress tracker — derives real stage completion from session keys

export interface StageProgress {
  recon: boolean
  match: boolean
  craft: boolean
  polish: boolean
  launch: boolean
  pulse: boolean
}

export const STAGE_KEYS: Record<keyof StageProgress, string> = {
  recon:   "campfire_recon_profile",   // has value = done
  match:   "campfire_match_done",      // "1" = done
  craft:   "campfire_craft_done",      // "1" = done
  polish:  "campfire_polish_done",     // "1" = done
  launch:  "campfire_launch_done",     // "1" = done
  pulse:   "campfire_pulse_done",      // "1" = done
}

export function getSessionProgress(): StageProgress {
  if (typeof window === "undefined") {
    return { recon: false, match: false, craft: false, polish: false, launch: false, pulse: false }
  }
  return {
    recon:   !!sessionStorage.getItem(STAGE_KEYS.recon),
    match:   sessionStorage.getItem(STAGE_KEYS.match) === "1",
    craft:   sessionStorage.getItem(STAGE_KEYS.craft) === "1",
    polish:  sessionStorage.getItem(STAGE_KEYS.polish) === "1",
    launch:  sessionStorage.getItem(STAGE_KEYS.launch) === "1",
    pulse:   sessionStorage.getItem(STAGE_KEYS.pulse) === "1",
  }
}

export function markStageDone(stage: keyof StageProgress) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(STAGE_KEYS[stage], "1")
}
