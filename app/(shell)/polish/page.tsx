"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { CampaignEmail } from "@/types/craft.types"
import { toneVariants, ToneType } from "@/lib/mock/toneVariants"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ToneSelector } from "./components/ToneSelector"
import { EmailEditor } from "./components/EmailEditor"
import { ApproveButton } from "./components/ApproveButton"
import { Button } from "@/components/ui/button"
import { Check, ArrowRight, ArrowLeft, RotateCcw, FileEdit, Loader2, ChevronRight } from "lucide-react"
import { markStageDone } from "@/lib/progress"
import { PageHelp } from "@/components/ui/PageHelp"
import { session } from "@/lib/session"
import { syncPolishedEmails, regenerateEmailTone, getCraftedEmailsByCompany } from "@/lib/api/craft"
import { updateCompanyProgress } from "@/lib/api/recon"
import { toast } from "sonner"

function sq(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }
const IS_LIVE = sq(process.env.NEXT_PUBLIC_USE_MOCK ?? "true") !== "true"

const POLISH_KEY = "campfire_polish_state"

function loadSavedEmails(): CampaignEmail[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(POLISH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

export default function PolishPage() {
  const router = useRouter()
  // Client-side state initialization
  const [emails, setEmails] = useState<CampaignEmail[]>([])
  const [hasStarted, setHasStarted] = useState(false)
  const [restoredFromSession, setRestoredFromSession] = useState(false)
  const [companyName, setCompanyName] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  // Helper: AI payload might not have `id`, fallback to sequenceNumber
  const getEmailId = (e: CampaignEmail) => String(e.id || e.sequenceNumber)

  const [activeTab, setActiveTab] = useState("1")

  // ─── Mount: restore emails (4-level hierarchy) ─────────────────────────

  useEffect(() => {
    const reconName = session.getReconProfile()?.name
    if (reconName) setCompanyName(reconName)

    const alreadyStarted = sessionStorage.getItem("campfire_polish_started")
    if (alreadyStarted === "1") setHasStarted(true)

    const applyEmails = (list: CampaignEmail[], restored?: boolean) => {
      setEmails(list)
      setActiveTab(String(list[0]?.id || list[0]?.sequenceNumber || 1))
      if (restored) setRestoredFromSession(true)
      
      // Auto-start editor jika ada draf email yang berhasil dilempar
      setHasStarted(true)
      sessionStorage.setItem("campfire_polish_started", "1")
    }

    ;(async () => {
      try {
        // Level 1: sessionStorage polish state
        const saved = loadSavedEmails()
        if (saved) { applyEmails(saved, true); return }

        // Level 2: sessionStorage craft campaign
        const craftCampaign = session.getCraftCampaign()
        if (craftCampaign?.emails?.length) {
          applyEmails(JSON.parse(JSON.stringify(craftCampaign.emails)))
          return
        }

        // Level 3: Supabase (live mode only)
        if (IS_LIVE) {
          const companyId = session.getCompanyId()
          if (companyId) {
            const dbResult = await getCraftedEmailsByCompany(companyId)
            if (dbResult?.emails?.length) {
              applyEmails(dbResult.emails)
              return
            }
          }
        }
      } catch (err) {
        console.error("[PolishPage] hydration error:", err)
      } finally {
        setIsLoading(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [isRegenerating, setIsRegenerating] = useState<Record<string, boolean>>({})

  const updateEmail = (id: number | string, updates: Partial<CampaignEmail>) => {
    setEmails(prev => prev.map(e => getEmailId(e) === String(id) ? { ...e, ...updates } : e))
  }

  const handleToneChange = async (emailId: string | number, tone: ToneType) => {
    const stringId = String(emailId)
    const email = emails.find(e => getEmailId(e) === stringId)
    if (!email) return

    // Jika sedang regenerate, ignore click
    if (isRegenerating[stringId]) return

    // Jika MOCK mode, gunakan text statis dari toneVariants (simulasi delay 1 detik)
    if (!IS_LIVE) {
      setIsRegenerating(prev => ({ ...prev, [stringId]: true }))
      updateEmail(emailId, { tone, isApproved: false })
      await new Promise(resolve => setTimeout(resolve, 1000))
      const idx = email.sequenceNumber - 1
      const variant = toneVariants[tone]?.[idx]
      if (variant) {
        updateEmail(emailId, { subject: variant.subject, body: variant.body })
      }
      setIsRegenerating(prev => ({ ...prev, [stringId]: false }))
      return
    }

    // --- LIVE MODE: Panggil AI Backend ---
    const craftCampaign = session.getCraftCampaign()

    if (!craftCampaign || !craftCampaign.reasoning) {
      toast.error("Gagal merubah tone", { description: "Data Campaign asli hilang dari sesi, tidak ada context reasoning untuk AI." })
      return
    }

    try {
      setIsRegenerating(prev => ({ ...prev, [stringId]: true }))
      
      // Update UI seketika: ganti tone, unapprove, subject dan body belum ganti (tunggu asinkronus)
      updateEmail(emailId, { tone: tone, isApproved: false })

      const newContent = await regenerateEmailTone({
        targetCompany:     companyName,
        originalSubject:   email.subject,
        originalBody:      email.body,
        campaignReasoning: craftCampaign.reasoning,
        newTone:           tone,
        sequenceNumber:    email.sequenceNumber,
        campaign_id:       session.getCampaignId() ?? undefined,
      })

      updateEmail(emailId, { 
        subject: newContent.subject, 
        body: newContent.body,
        isApproved: false // pastikan dicabut kembali kalau-kalau dicentang sembari nunggu
      })
      toast.success(`Berhasil meregenerasi tone Email ${email.sequenceNumber}`)
      
    } catch (err: any) {
      toast.error("Gagal meregenerasi tone email", { description: err.message })
      // rollback UI tone
      updateEmail(emailId, { tone: email.tone })
    } finally {
      setIsRegenerating(prev => ({ ...prev, [stringId]: false }))
    }
  }

  // Debounced save — wait 400ms after last change before writing to sessionStorage
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (emails.length === 0) return // CEGAH PENYIMPANAN ARRAY KOSONG
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
      setIsSyncing(true)
      try {
        await syncPolishedEmails(campaignId, buildEmailPayload())
      } catch (err: any) {
        toast.error("Gagal menyimpan hasil edit", { description: err.message ?? "Koneksi ke database gagal." })
        setIsSyncing(false)
        return
      }
      setIsSyncing(false)
    }
    router.push("/launch")
  }

  const breadcrumb = (
    <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground font-medium">
      <span className="hover:text-foreground cursor-pointer transition-colors" onClick={() => router.push("/research-library")}>Research Library</span>
      <ChevronRight className="w-3.5 h-3.5"  strokeWidth={1.5} />
      <span className="hover:text-foreground cursor-pointer transition-colors" onClick={() => { const id = session.getCompanyId(); if (id) router.push(`/recon/${id}`) }}>Review Profil</span>
      <ChevronRight className="w-3.5 h-3.5"  strokeWidth={1.5} />
      <span className="hover:text-foreground cursor-pointer transition-colors" onClick={() => router.push("/match")}>Match</span>
      <ChevronRight className="w-3.5 h-3.5"  strokeWidth={1.5} />
      <span className="hover:text-foreground cursor-pointer transition-colors" onClick={() => router.push("/craft")}>Craft</span>
      <ChevronRight className="w-3.5 h-3.5"  strokeWidth={1.5} />
      <span className="text-foreground font-semibold">Polish</span>
      <ChevronRight className="w-3.5 h-3.5"  strokeWidth={1.5} />
      <span>Launch</span>
    </div>
  )
  const stepBadge = <span className="text-[11.5px] font-bold uppercase tracking-wider text-brand bg-brand-light px-2.5 py-1 rounded-full">Langkah 4 dari 6</span>

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
        {breadcrumb}
        <div className="flex items-center">{stepBadge}</div>
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
          <Loader2 className="w-8 h-8 text-brand animate-spin"  strokeWidth={1.5} />
          <p className="text-[13.5px] font-medium">Memuat data email...</p>
        </div>
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
        {breadcrumb}
        <div className="flex items-center">{stepBadge}</div>
        <div className="flex justify-center py-10">
          <div className="bg-white flex flex-col items-center justify-center p-8 border border-dashed border-border/80 rounded-2xl max-w-sm w-full shadow-sm text-center">
            <div className="bg-brand/10 p-5 rounded-full mb-6">
              <FileEdit className="w-8 h-8 text-brand" strokeWidth={1.5} />
            </div>
            <h3 className="text-[17px] font-bold mb-1 tracking-tight">Belum ada draft email</h3>
            <p className="text-[13px] text-muted-foreground font-medium mb-4">
              Target: <span className="font-bold text-foreground">{companyName || "Belum dipilih"}</span>
            </p>
            <p className="text-center text-muted-foreground mb-8 text-[13px] leading-relaxed">
              Anda belum melakukan generate campaign di tahap Craft. Silakan kembali ke Craft untuk membuat draft email terlebih dahulu.
            </p>
            <Button onClick={() => router.push("/craft")} className="w-full bg-brand hover:bg-brand/90 text-white rounded-xl font-semibold">
              Menuju Craft
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!hasStarted) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
        {breadcrumb}
        <div className="flex items-center">{stepBadge}</div>
        <div className="flex justify-center py-10">
          <div className="bg-white flex flex-col items-center justify-center p-8 border border-dashed border-border/80 rounded-2xl max-w-sm w-full shadow-sm text-center">
            <div className="bg-brand/10 p-5 rounded-full mb-6">
              <FileEdit className="w-8 h-8 text-brand" strokeWidth={1.5} />
            </div>
            <h3 className="text-[17px] font-bold mb-1 tracking-tight">Mulai Polish</h3>
            <p className="text-[13px] text-muted-foreground font-medium mb-1">
              Target: <span className="font-bold text-foreground">{companyName}</span>
            </p>
            <p className="text-center text-muted-foreground mb-8 text-[13px] leading-relaxed">
              Review dan edit 3 draft email yang sudah digenerate. Approve setiap email sebelum melanjutkan ke Launch.
            </p>
            <Button onClick={handleStartPolish} className="w-full bg-brand hover:bg-brand/90 text-white rounded-xl font-semibold">
              Mulai Polish
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">

      {breadcrumb}

      <div className="flex items-start justify-between border-b pb-6 border-border/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {stepBadge}
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-2">Review & Editor (Polish)</h1>
          <p className="text-muted-foreground mt-1.5 text-[14.5px] font-medium max-w-lg">
            Review dan finalisasi draft email. Seluruh email wajib di-approve sebelum campaign bisa diaktifkan di tahap selanjutnya.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PageHelp
            title="Polish — Edit & Finalisasi Email"
            content={{
              what: "Edit subject dan body setiap email campaign sebelum dikirim. Kamu bisa menyesuaikan tone, panjang, dan detail konten.",
              tips: "Gunakan tombol Salin Email untuk menyalin subject dan body sekaligus ke clipboard.",
              next: "Setelah semua email difinalisasi, lanjut ke Launch untuk menjadwalkan pengiriman."
            }}
          />
          <Button variant="outline" onClick={() => router.push("/craft")} className="shadow-sm font-semibold text-[13.5px]">
            <ArrowLeft className="w-4 h-4 mr-2"  strokeWidth={1.5} />
            Kembali
          </Button>
          {allApproved ? (
            <Button onClick={handleProceedToLaunch} disabled={isSyncing} className="bg-brand hover:bg-brand/90 text-white shadow-sm font-semibold text-[13.5px]">
              {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"  strokeWidth={1.5} /> : null}
              {isSyncing ? "Menyimpan..." : "Lanjut ke Launch"}
              {!isSyncing && <ArrowRight className="w-4 h-4 ml-2"  strokeWidth={1.5} />}
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
              <Check className="w-4 h-4 stroke-[2.5]"  strokeWidth={1.5} />
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
            <RotateCcw className="w-3.5 h-3.5"  strokeWidth={1.5} />
            Reset
          </button>
        </div>
      )}

      <div className="pt-2 relative">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col">
          <TabsList className="w-full justify-start bg-transparent p-0 h-auto gap-8 border-b border-border/60 rounded-none mb-8">
            {emails.map(email => {
              const eId = getEmailId(email)
              return (
              <TabsTrigger
                key={eId}
                value={eId}
                className="rounded-none border-b-[3px] border-transparent px-4 pb-3 pt-2 text-[15.5px] font-bold text-muted-foreground hover:text-foreground data-[state=active]:border-brand data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-all relative"
              >
                Email {email.sequenceNumber}
                {email.isApproved && (
                  <div className="absolute xl:top-2.5 top-1.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500 shadow-sm border border-emerald-200"></div>
                )}
              </TabsTrigger>
            )})}
          </TabsList>

          {emails.map(email => {
            const eId = getEmailId(email)
            return (
            <TabsContent key={eId} value={eId} className="mt-0 outline-none border-none w-full">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-10">
                <div className="space-y-6">
                  <div className={`relative transition-all duration-300 ${email.isApproved ? 'opacity-85 pointer-events-none' : ''}`}>
                    <EmailEditor
                      emailId={eId}
                      subject={email.subject}
                      body={email.body}
                      onChangeSubject={(val) => updateEmail(eId, { subject: val })}
                      onChangeBody={(val) => updateEmail(eId, { body: val })}
                      disabled={email.isApproved || isRegenerating[eId]}
                      isRegenerating={isRegenerating[eId]}
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-50 border border-border/60 rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-[14px] text-muted-foreground uppercase tracking-wider mb-1">Tone & Persona</h3>
                    <p className="text-[12px] text-muted-foreground mb-4">Pilih tone untuk regenerasi otomatis isi email.</p>
                    <ToneSelector
                      currentTone={email.tone}
                      onChange={(val) => handleToneChange(eId, val)}
                      disabled={email.isApproved || isRegenerating[eId]}
                      isRegenerating={isRegenerating[eId]}
                    />
                  </div>

                  <div className="bg-slate-50 border border-border/60 rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-[14px] text-muted-foreground uppercase tracking-wider mb-4">Approval Status</h3>
                    <ApproveButton
                      isApproved={email.isApproved}
                      emailNumber={email.sequenceNumber}
                      onToggle={() => updateEmail(eId, { isApproved: !email.isApproved })}
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
          )})}
        </Tabs>
      </div>

      {allApproved && (
        <div className="mt-8 bg-emerald-50/50 border border-emerald-200 shadow-sm p-5 pr-6 rounded-2xl flex items-center justify-between z-10 animate-in fade-in duration-500">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0 shadow-sm">
              <Check className="w-6 h-6 stroke-[3]"  strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-bold text-[16px] text-emerald-900 tracking-tight">Semua draft diapprove!</p>
              <p className="text-[13.5px] text-emerald-700 font-medium">Siap masuk jadwal automation.</p>
            </div>
          </div>
          <Button onClick={handleProceedToLaunch} disabled={isSyncing} className="bg-brand hover:bg-brand/90 text-white shadow-sm font-bold rounded-xl px-6 h-12 text-[14.5px]">
            {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"  strokeWidth={1.5} /> : null}
            {isSyncing ? "Menyimpan..." : "Lanjut ke Launch"}
            {!isSyncing && <ArrowRight className="w-4 h-4 ml-2"  strokeWidth={1.5} />}
          </Button>
        </div>
      )}
    </div>
  )
}
