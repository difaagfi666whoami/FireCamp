import { supabase } from "@/lib/supabase/client"

interface ScheduleItem {
  emailNumber: number
  dayLabel: string
  scheduledDay: number
  date: string
  time: string
  status: string
}

// Dipanggil saat user klik "Aktifkan Automation" atau "Simpan Jadwal & Aktifkan".
// UPDATE campaigns (status='active') + UPDATE campaign_emails (scheduled_date/time, status).
export async function activateCampaign(
  campaignId: string,
  mode: "ai" | "manual",
  schedule: ScheduleItem[]
): Promise<void> {
  // Update status campaign
  const { error: campaignErr } = await supabase
    .from("campaigns")
    .update({
      status:          "active",
      automation_mode: mode,
      activated_at:    new Date().toISOString(),
    })
    .eq("id", campaignId)

  if (campaignErr) {
    console.error("[Campfire/launch] update campaign:", campaignErr)
    throw new Error(campaignErr.message)
  }

  // Update jadwal per email
  for (const item of schedule) {
    const { error } = await supabase
      .from("campaign_emails")
      .update({
        day_label:      item.dayLabel,
        scheduled_day:  item.scheduledDay,
        scheduled_date: item.date,
        scheduled_time: item.time,
        status: item.status === "sent" ? "sent" : "scheduled",
      })
      .eq("campaign_id", campaignId)
      .eq("sequence_number", item.emailNumber)

    if (error) {
      console.error(`[Campfire/launch] update email schedule seq=${item.emailNumber}:`, error)
    }
  }
}

export const saveCampaignSchedule = activateCampaign
