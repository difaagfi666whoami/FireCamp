"use client"

import { useState } from "react"
import { activateCampaign } from "@/lib/api/launch"
import { session } from "@/lib/session"
import { markStageDone } from "@/lib/progress"

type LaunchMode = "ai" | "manual"

interface ScheduleItem {
  emailNumber: number
  dayLabel: string
  scheduledDay: number
  date: string
  time: string
  status: string
}

export function useLaunch() {
  const [mode, setMode] = useState<LaunchMode>("ai")
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activate = async (overrideSchedule?: ScheduleItem[]) => {
    const campaignId = session.getCampaignId()
    if (!campaignId) {
      setError("Campaign ID tidak ditemukan.")
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const finalSchedule = overrideSchedule ?? schedule
      await activateCampaign(campaignId, mode, finalSchedule)
      setIsActive(true)
      markStageDone("launch")
    } catch (err) {
      console.error("[Campfire/useLaunch]", err)
      setError("Gagal mengaktifkan campaign. Coba lagi.")
    } finally {
      setIsLoading(false)
    }
  }

  return { mode, setMode, schedule, setSchedule, isActive, isLoading, error, activate }
}
