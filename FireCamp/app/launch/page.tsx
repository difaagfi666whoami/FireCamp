"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeSelector } from "./components/ModeSelector"
import { AiScheduleView } from "./components/AiScheduleView"
import { ManualScheduleForm } from "./components/ManualScheduleForm"
import { toast } from "sonner"
import { markStageDone } from "@/lib/progress"
import { session } from "@/lib/session"
import { saveCampaignSchedule } from "@/lib/api/launch"
import { updateCompanyProgress } from "@/lib/api/recon"

type Mode = "ai" | "manual"

export interface ScheduleItem {
  emailNumber: number
  dayLabel: string
  scheduledDay: number
  date: string
  time: string
  status: string
}

// ─── Dynamic schedule generator (B2B Day 1 → 4 → 10 methodology) ────────

function generateDefaultSchedule(): ScheduleItem[] {
  const now = new Date()
  // Email 1: Tomorrow 09:00
  const d1 = new Date(now)
  d1.setDate(d1.getDate() + 1)
  // Email 2: Day 4 (3 days after Email 1) 10:00
  const d2 = new Date(d1)
  d2.setDate(d2.getDate() + 3)
  // Email 3: Day 10 (6 days after Email 2) 09:30
  const d3 = new Date(d2)
  d3.setDate(d3.getDate() + 6)

  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  return [
    { emailNumber: 1, dayLabel: "Hari ke-1",  scheduledDay: 1,  date: fmt(d1), time: "09:00", status: "scheduled" },
    { emailNumber: 2, dayLabel: "Hari ke-4",  scheduledDay: 4,  date: fmt(d2), time: "10:00", status: "scheduled" },
    { emailNumber: 3, dayLabel: "Hari ke-10", scheduledDay: 10, date: fmt(d3), time: "09:30", status: "scheduled" },
  ]
}

export default function LaunchPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("ai")
  const [isActive, setIsActive] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [companyName, setCompanyName] = useState("")
  const [schedule, setSchedule] = useState<ScheduleItem[]>(generateDefaultSchedule)

  // ─── Mount: validate session & hydrate company name ───────────────────

  useEffect(() => {
    const campaignId = session.getCampaignId()
    const craft = session.getCraftCampaign()

    if (!campaignId && !craft) {
      toast.error("Tidak ada campaign aktif", {
        description: "Silakan buat campaign terlebih dahulu dari tahap Craft.",
      })
      router.push("/research-library")
      return
    }

    const name = session.getReconProfile()?.name ?? craft?.targetCompany ?? ""
    setCompanyName(name)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Activate handler (awaited, with error boundary) ──────────────────
  // `finalSchedule` parameter allows child components (ManualScheduleForm)
  // to pass their local edited rows directly, avoiding stale parent state.

  const handleActivate = async (finalSchedule?: ScheduleItem[]) => {
    const dataToSave = finalSchedule ?? schedule
    const campaignId = session.getCampaignId()
    const companyId = session.getCompanyId()

    setIsActivating(true)
    try {
      if (campaignId) {
        await saveCampaignSchedule(
          campaignId,
          mode,
          dataToSave.map(s => ({
            emailNumber:  s.emailNumber,
            dayLabel:     s.dayLabel,
            scheduledDay: s.scheduledDay,
            date:         s.date,
            time:         s.time,
            status:       s.status,
          }))
        )
      }
      if (companyId) {
        await updateCompanyProgress(companyId, "launch")
      }
      markStageDone("launch")
      setSchedule(dataToSave)
      setIsActive(true)
      toast.success("Campaign berhasil diaktifkan! Pantau progres di halaman Pulse.")
    } catch (err: any) {
      toast.error("Gagal meluncurkan automation", {
        description: err.message ?? "Koneksi ke database gagal.",
      })
    } finally {
      setIsActivating(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between border-b pb-6 border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Launch — Automation Setup</h1>
          <p className="text-muted-foreground mt-1.5 text-[14.5px] font-medium max-w-lg">
            Pilih mode pengiriman dan aktifkan campaign untuk{" "}
            {companyName
              ? <span className="font-bold text-foreground">{companyName}</span>
              : <span className="text-muted-foreground italic">memuat...</span>
            }.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/polish")}
            className="shadow-sm font-semibold text-[13.5px]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          {isActive && (
            <Button
              onClick={() => router.push("/pulse")}
              className="bg-brand hover:bg-brand/90 text-white shadow-sm font-semibold text-[13.5px]"
            >
              Lihat Pulse
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Mode Selector */}
      <div className="space-y-2">
        <h2 className="font-bold text-[13px] text-muted-foreground uppercase tracking-wider">
          Pilih Mode Pengiriman
        </h2>
        <ModeSelector mode={mode} onChange={(m) => { setMode(m); setIsActive(false) }} />
      </div>

      {/* Mode Content */}
      <div className="pt-2">
        {mode === "ai" ? (
          <AiScheduleView
            schedule={schedule}
            isActive={isActive}
            isActivating={isActivating}
            onActivate={handleActivate}
          />
        ) : (
          <ManualScheduleForm
            defaultSchedule={schedule}
            isActive={isActive}
            isActivating={isActivating}
            onActivate={handleActivate}
          />
        )}
      </div>

      {/* Footer CTA after activation */}
      {isActive && (
        <div className="mt-8 bg-brand/5 border border-brand/20 shadow-sm p-5 pr-6 rounded-2xl flex items-center justify-between z-10 animate-in fade-in duration-500">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-brand/10 text-brand rounded-full flex items-center justify-center shrink-0 shadow-sm">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-[16px] text-foreground tracking-tight">Campaign diluncurkan!</p>
              <p className="text-[13.5px] text-muted-foreground font-medium">Pantau open rate, click, dan reply di Pulse.</p>
            </div>
          </div>
          <Button
            onClick={() => router.push("/pulse")}
            className="bg-brand hover:bg-brand/90 text-white shadow-sm font-bold rounded-xl px-6 h-12 text-[14.5px]"
          >
            Buka Pulse
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}
