"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, Mail, MessageSquareReply, Eye, CheckCircle2, Clock, Calendar, MousePointerClick, AlertTriangle, XCircle, ShieldAlert, Loader2, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { markStageDone } from "@/lib/progress"
import { session } from "@/lib/session"
import { getCampaignAnalytics, AnalyticsData } from "@/lib/api/analytics"
import { updateCompanyProgress } from "@/lib/api/recon"
import { StatCards } from "./components/StatCards"
import { PerformanceBarChart } from "./components/PerformanceBarChart"
import { EngagementLineChart } from "./components/EngagementLineChart"
import { PageHelp } from "@/components/ui/PageHelp"
import { SessionExpiredState } from "@/components/shared/SessionExpiredState"

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  replied: {
    label: "Replied",
    color: "text-emerald-700",
    bg: "bg-emerald-100 border-emerald-200",
    icon: <MessageSquareReply className="w-3 h-3"  strokeWidth={1.5} />,
  },
  clicked: {
    label: "Clicked",
    color: "text-indigo-700",
    bg: "bg-indigo-100 border-indigo-200",
    icon: <MousePointerClick className="w-3 h-3"  strokeWidth={1.5} />,
  },
  opened: {
    label: "Opened",
    color: "text-blue-700",
    bg: "bg-blue-100 border-blue-200",
    icon: <Eye className="w-3 h-3"  strokeWidth={1.5} />,
  },
  sent: {
    label: "Sent",
    color: "text-zinc-600",
    bg: "bg-zinc-100 border-zinc-200",
    icon: <CheckCircle2 className="w-3 h-3"  strokeWidth={1.5} />,
  },
  pending: {
    label: "Pending",
    color: "text-amber-700",
    bg: "bg-amber-100 border-amber-200",
    icon: <Clock className="w-3 h-3"  strokeWidth={1.5} />,
  },
  scheduled: {
    label: "Scheduled",
    color: "text-amber-700",
    bg: "bg-amber-100 border-amber-200",
    icon: <Calendar className="w-3 h-3"  strokeWidth={1.5} />,
  },
  bounced: {
    label: "Bounced",
    color: "text-red-700",
    bg: "bg-red-100 border-red-200",
    icon: <AlertTriangle className="w-3 h-3"  strokeWidth={1.5} />,
  },
  complained: {
    label: "Spam Complained",
    color: "text-rose-800",
    bg: "bg-rose-100 border-rose-200",
    icon: <ShieldAlert className="w-3 h-3"  strokeWidth={1.5} />,
  },
  failed: {
    label: "Failed",
    color: "text-red-700",
    bg: "bg-red-100 border-red-200",
    icon: <XCircle className="w-3 h-3"  strokeWidth={1.5} />,
  },
}

const ZERO_ANALYTICS: AnalyticsData = {
  summary: { emailsSent: 0, openRate: 0, clickRate: 0, replyRate: 0, industryBenchmarks: { openRate: 22.0, clickRate: 3.5, replyRate: 8.0 } },
  perEmail: [
    { emailNumber: 1, name: "Email 1", opens: 0, clicks: 0, replies: 0, status: "scheduled" },
    { emailNumber: 2, name: "Email 2", opens: 0, clicks: 0, replies: 0, status: "scheduled" },
    { emailNumber: 3, name: "Email 3", opens: 0, clicks: 0, replies: 0, status: "scheduled" },
  ],
  timeline: [],
  tokenUsage: { recon: 0, match: 0, craft: 0, polish: 0, total: 0, estimatedCostIDR: 0 },
}

export default function PulsePage() {
  const router = useRouter()
  const [companyName, setCompanyName] = useState("Perusahaan")
  const [analytics, setAnalytics] = useState<AnalyticsData>(ZERO_ANALYTICS)
  const [hasCampaign, setHasCampaign] = useState(true)
  const [isSessionLoaded, setIsSessionLoaded] = useState(false)
  const { summary, perEmail, timeline } = analytics

  useEffect(() => {
    setCompanyName(session.getReconProfile()?.name ?? "Perusahaan")
    const companyId  = session.getCompanyId()
    const campaignId = session.getCampaignId()
    
    if (!campaignId) {
      setHasCampaign(false)
    } else {
      markStageDone("pulse")
      if (companyId) {
        updateCompanyProgress(companyId, "pulse").catch(console.error)
      }
      getCampaignAnalytics(campaignId)
        .then(setAnalytics)
        .catch((e) => console.error("[PulsePage] analytics:", e))
    }
    setIsSessionLoaded(true)
  }, [])

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
      <span className="hover:text-foreground cursor-pointer transition-colors" onClick={() => router.push("/polish")}>Polish</span>
      <ChevronRight className="w-3.5 h-3.5"  strokeWidth={1.5} />
      <span className="hover:text-foreground cursor-pointer transition-colors" onClick={() => router.push("/launch")}>Launch</span>
      <ChevronRight className="w-3.5 h-3.5"  strokeWidth={1.5} />
      <span className="text-foreground font-semibold">Pulse</span>
    </div>
  )
  const stepBadge = <span className="text-[11.5px] font-bold uppercase tracking-wider text-brand bg-brand-light px-2.5 py-1 rounded-full">Langkah 6 dari 6</span>

  if (!isSessionLoaded) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in">
        {breadcrumb}
        <div className="flex items-center">{stepBadge}</div>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-brand"  strokeWidth={1.5} />
          <p className="text-[14px] font-medium">Memuat data sesi...</p>
        </div>
      </div>
    )
  }

  if (!hasCampaign) {
    return <SessionExpiredState currentStage="pulse" />
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">

      {breadcrumb}

      <div className="flex items-start justify-between border-b pb-6 border-border/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11.5px] font-bold uppercase tracking-wider text-brand bg-brand-light px-2.5 py-1 rounded-full">Langkah 6 dari 6</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-2">Pulse — Campaign Analytics</h1>
          <p className="text-muted-foreground mt-1.5 text-[14.5px] font-medium max-w-lg">
            Pantau performa real-time campaign untuk{" "}
            <span className="font-bold text-foreground">{companyName}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PageHelp
            title="Pulse — Analytics Campaign"
            content={{
              what: "Pantau performa campaign secara real-time: open rate, click rate, reply rate, dan penggunaan token AI.",
              tips: "Open rate di atas 30% dianggap baik untuk cold email B2B. Bandingkan dengan campaign sebelumnya.",
              next: "Gunakan insight dari Pulse untuk memperbaiki campaign berikutnya di target yang baru."
            }}
          />
          <Button
            variant="outline"
            onClick={() => router.push("/launch")}
            className="shadow-sm font-semibold text-[13.5px]"
          >
            <ArrowLeft className="w-4 h-4 mr-2"  strokeWidth={1.5} />
            Kembali ke Launch
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <StatCards summary={summary} />

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        <PerformanceBarChart data={perEmail} />
        <EngagementLineChart data={timeline} />
      </div>

      {/* Email Status List — full width */}
      <div className="bg-white border border-border/60 rounded-xl p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="font-bold text-[15px] text-foreground">Status per Email</h3>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            Status terkini masing-masing email dalam sekuens
          </p>
        </div>
        <div className="space-y-3">
          {perEmail.map((email: any) => {
            const cfg = STATUS_CONFIG[email.status] ?? STATUS_CONFIG.pending
            return (
              <div
                key={email.emailNumber}
                className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-slate-50/50"
              >
                <div className="p-2 bg-muted rounded-lg shrink-0 text-muted-foreground">
                  <Mail className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[14px] text-foreground">{email.name}</p>
                  <div className="flex gap-3 mt-1.5 text-[12px] text-muted-foreground font-medium">
                    <span>{email.opens} opens</span>
                    <span>·</span>
                    <span>{email.clicks} clicks</span>
                    <span>·</span>
                    <span>{email.replies} replies</span>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2.5 py-1 rounded-full border",
                    cfg.color,
                    cfg.bg
                  )}
                >
                  {cfg.icon}
                  {cfg.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
