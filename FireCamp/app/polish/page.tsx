"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { mockData } from "@/lib/mock/mockdata"
import { CampaignEmail } from "@/types/craft.types"
import { toneVariants, ToneType } from "@/lib/mock/toneVariants"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ToneSelector } from "./components/ToneSelector"
import { EmailEditor } from "./components/EmailEditor"
import { ApproveButton } from "./components/ApproveButton"
import { Button } from "@/components/ui/button"
import { Check, ArrowRight, ArrowLeft, RotateCcw, FileEdit } from "lucide-react"
import { markStageDone } from "@/lib/progress"
import { session } from "@/lib/session"
import { syncPolishedEmails } from "@/lib/api/craft"
import { updateCompanyProgress } from "@/lib/api/recon"

const POLISH_KEY = "campfire_polish_state"

function loadSavedEmails(): CampaignEmail[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(POLISH_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function PolishPage() {
  const router = useRouter()
  // Start with mock data (SSR-safe). useEffect below restores client-side state.
  const [emails, setEmails] = useState<CampaignEmail[]>(() =>
    JSON.parse(JSON.stringify(mockData.campaign.emails))
  )
  const [hasStarted, setHasStarted] = useState(false)
  const [restoredFromSession, setRestoredFromSession] = useState(false)
  const [activeTab, setActiveTab] = useState(() =>
    String(mockData.campaign.emails[0]?.id ?? 1)
  )

  // ─── Mount: restore emails from sessionStorage (client-only) ────────────

  useEffect(() => {
    const saved = loadSavedEmails()
    if (saved) {
      setEmails(saved)
      setRestoredFromSession(true)
      setActiveTab(String(saved[0]?.id ?? 1))
    } else {
      const craftCampaign = session.getCraftCampaign()
      if (craftCampaign?.emails?.length) {
        const restored = JSON.parse(JSON.stringify(craftCampaign.emails))
        setEmails(restored)
        setActiveTab(String(restored[0]?.id ?? 1))
      }
    }
    const alreadyStarted = sessionStorage.getItem("campfire_polish_started")
    if (alreadyStarted === "1") {
      setHasStarted(true)
    }
    // else: show idle screen until user clicks button
  }, [])

  const updateEmail = (id: number | string, updates: Partial<CampaignEmail>) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
  }

  const handleToneChange = (emailId: number | string, tone: ToneType) => {
    const email = emails.find(e => e.id === emailId)
    if (!email) return
    const idx = email.sequenceNumber - 1
    const variant = toneVariants[tone]?.[idx]
    if (variant) {
      updateEmail(emailId, { tone, subject: variant.subject, body: variant.body })
    } else {
      updateEmail(emailId, { tone })
    }
  }

  // Debounced save — wait 400ms after last change before writing to sessionStorage
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      sessionStorage.setItem(POLISH_KEY, JSON.stringify(emails))
    }, 400)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [emails])

  const allApproved = emails.every(e => e.isApproved)

  const buildEmailPayload = () =>
    emails.map(e => ({
      sequenceNumber: e.sequenceNumber,
      dayLabel:       e.dayLabel,
      scheduledDay:   e.scheduledDay,
      tone:           e.tone,
      subject:        e.subject,
      body:           e.body,
      isApproved:     e.isApproved,
    }))

  useEffect(() => {
    if (!allApproved) return
    markStageDone("polish")
    const campaignId = session.getCampaignId()
    const companyId  = session.getCompanyId()
    if (campaignId) {
      syncPolishedEmails(campaignId, buildEmailPayload())
        .catch(e => console.error("[PolishPage] syncPolishedEmails:", e))
    }
    if (companyId) {
      updateCompanyProgress(companyId, "polish").catch(console.error)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allApproved])

  const handleStartPolish = () => {
    sessionStorage.setItem("campfire_polish_started", "1")
    setHasStarted(true)
  }

  const handleProceedToLaunch = async () => {
    const campaignId = session.getCampaignId()
    if (campaignId) {
      try {
        await syncPolishedEmails(campaignId, buildEmailPayload())
      } catch (e) {
        console.error("[PolishPage] syncPolishedEmails on proceed:", e)
      }
    }
    router.push("/launch")
  }

  if (!hasStarted) {
    const companyName = session.getReconProfile()?.name ?? mockData.company.name
    return (
      <div className="flex justify-center py-16 animate-in fade-in duration-500">
        <div className="bg-white flex flex-col items-center justify-center p-8
                        border border-dashed border-border/80 rounded-2xl
                        w-[320px] shadow-sm text-center">
          <div className="bg-brand/10 p-5 rounded-full mb-6">
            <FileEdit className="w-8 h-8 text-brand" strokeWidth={1.5} />
          </div>
          <h3 className="text-[17px] font-bold mb-1 tracking-tight">
            Mulai Polish
          </h3>
          <p className="text-[13px] text-muted-foreground font-medium mb-1">
            Target: <span className="font-bold text-foreground">{companyName}</span>
          </p>
          <p className="text-center text-muted-foreground mb-8 text-[13px] leading-relaxed">
            Review dan edit 3 draft email yang sudah digenerate.
            Approve setiap email sebelum melanjutkan ke Launch.
          </p>
          <Button
            onClick={handleStartPolish}
            className="w-full bg-brand hover:bg-brand/90 text-white rounded-xl font-semibold"
          >
            Mulai Polish
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex items-start justify-between border-b pb-6 border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review & Editor (Polish)</h1>
          <p className="text-muted-foreground mt-1.5 text-[14.5px] font-medium max-w-lg">
            Review dan finalisasi draft email. Seluruh email wajib di-approve sebelum campaign bisa diaktifkan di tahap selanjutnya.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/craft")} className="shadow-sm font-semibold text-[13.5px]">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          {allApproved ? (
            <Button onClick={handleProceedToLaunch} className="bg-brand hover:bg-brand/90 text-white shadow-sm font-semibold text-[13.5px]">
              Lanjut ke Launch
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button disabled className="bg-muted text-muted-foreground font-semibold text-[13.5px]">
              Approve semua untuk Lanjut
            </Button>
          )}
        </div>
      </div>

      {/* Checkpoint banner — shown when returning with saved progress */}
      {restoredFromSession && (
        <div className="flex items-center justify-between gap-4 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <p className="font-bold text-[13.5px] text-emerald-800">
                Progress tersimpan — {emails.filter(e => e.isApproved).length}/{emails.length} email di-approve
              </p>
              <p className="text-[12px] text-emerald-700 font-medium">Pilihan tone dan approval sudah diingat dari sesi sebelumnya.</p>
            </div>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem(POLISH_KEY)
              window.location.reload()
            }}
            className="text-[12px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1.5 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      )}

      <div className="pt-2 relative">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col">
          <TabsList className="w-full justify-start bg-transparent p-0 h-auto gap-8 border-b border-border/60 rounded-none mb-8">
            {emails.map(email => (
              <TabsTrigger
                key={email.id}
                value={email.id.toString()}
                className="rounded-none border-b-[3px] border-transparent px-4 pb-3 pt-2 text-[15.5px] font-bold text-muted-foreground hover:text-foreground data-[state=active]:border-brand data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-all relative"
              >
                Email {email.sequenceNumber}
                {email.isApproved && (
                  <div className="absolute xl:top-2.5 top-1.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500 shadow-sm border border-emerald-200"></div>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {emails.map(email => (
            <TabsContent key={email.id} value={email.id.toString()} className="mt-0 outline-none border-none w-full">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-10">
                <div className="space-y-6">
                  <div className={`transition-all duration-300 ${email.isApproved ? 'opacity-85 pointer-events-none' : ''}`}>
                    <EmailEditor
                      subject={email.subject}
                      body={email.body}
                      onChangeSubject={(val) => updateEmail(email.id, { subject: val })}
                      onChangeBody={(val) => updateEmail(email.id, { body: val })}
                      disabled={email.isApproved}
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-50 border border-border/60 rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-[14px] text-muted-foreground uppercase tracking-wider mb-1">Tone & Persona</h3>
                    <p className="text-[12px] text-muted-foreground mb-4">Pilih tone untuk regenerasi otomatis isi email.</p>
                    <ToneSelector
                      currentTone={email.tone}
                      onChange={(val) => handleToneChange(email.id, val)}
                      disabled={email.isApproved}
                    />
                  </div>

                  <div className="bg-slate-50 border border-border/60 rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-[14px] text-muted-foreground uppercase tracking-wider mb-4">Approval Status</h3>
                    <ApproveButton
                      isApproved={email.isApproved}
                      emailNumber={email.sequenceNumber}
                      onToggle={() => updateEmail(email.id, { isApproved: !email.isApproved })}
                    />
                    {email.isApproved && (
                      <p className="text-[12.5px] text-muted-foreground mt-4 font-medium leading-relaxed bg-white border border-border/50 p-3 rounded-lg">
                        <span className="font-bold text-foreground">Kunci:</span> Email ini disetujui (Read-only). Batalkan approve jika Anda ingin mengedit kembali.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {allApproved && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white border border-border/80 shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-4 pr-5 rounded-2xl flex items-center gap-5 z-50 animate-in slide-in-from-bottom-5">
          <div className="w-11 h-11 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
            <Check className="w-6 h-6 stroke-[3]" />
          </div>
          <div>
            <p className="font-bold text-[15px] text-foreground">Semua draft diapprove!</p>
            <p className="text-[13px] text-muted-foreground font-medium">Siap masuk jadwal automation.</p>
          </div>
          <Button onClick={handleProceedToLaunch} className="bg-brand hover:bg-brand/90 text-white shadow-sm font-bold ml-4 rounded-xl px-6 h-11">
            Lanjut ke Launch
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}
