"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { mockData } from "@/lib/mock/mockdata"
import { ModeSelector } from "./components/ModeSelector"
import { AiScheduleView } from "./components/AiScheduleView"
import { ManualScheduleForm } from "./components/ManualScheduleForm"
import { toast } from "sonner"
import { markStageDone } from "@/lib/progress"
import { session } from "@/lib/session"
import { saveCampaignSchedule } from "@/lib/api/launch"
import { updateCompanyProgress } from "@/lib/api/recon"

type Mode = "ai" | "manual"

export default function LaunchPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("ai")
  const [isActive, setIsActive] = useState(false)

  const schedule = mockData.schedule

  const handleActivate = () => {
    setIsActive(true)
    markStageDone("launch")
    toast.success("Campaign berhasil diaktifkan! Pantau progres di halaman Pulse.")
    const companyId  = session.getCompanyId()
    const campaignId = session.getCampaignId()
    if (companyId) {
      updateCompanyProgress(companyId, "launch").catch(console.error)
    }
    if (campaignId) {
      saveCampaignSchedule(
        campaignId,
        mode,
        schedule.map((s: any) => ({
          emailNumber: s.emailNumber,
          date:        s.date,
          time:        s.time,
          status:      s.status,
        }))
      ).catch(e => console.error("[LaunchPage] activateCampaign:", e))
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
            <span className="font-bold text-foreground">{mockData.company.name}</span>.
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
            onActivate={handleActivate}
          />
        ) : (
          <ManualScheduleForm
            defaultSchedule={schedule}
            isActive={isActive}
            onActivate={handleActivate}
          />
        )}
      </div>

      {/* Footer CTA after activation */}
      {isActive && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white border border-border/80 shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-4 pr-5 rounded-2xl flex items-center gap-5 z-50 animate-in slide-in-from-bottom-5">
          <div className="w-11 h-11 bg-brand/10 text-brand rounded-full flex items-center justify-center shrink-0">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-[15px] text-foreground">Campaign diluncurkan!</p>
            <p className="text-[13px] text-muted-foreground font-medium">Pantau open rate, click, dan reply di Pulse.</p>
          </div>
          <Button
            onClick={() => router.push("/pulse")}
            className="bg-brand hover:bg-brand/90 text-white shadow-sm font-bold ml-4 rounded-xl px-6 h-11"
          >
            Buka Pulse
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}
