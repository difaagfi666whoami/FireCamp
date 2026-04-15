"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, Mail, MessageSquareReply, Eye, CheckCircle2, Clock, Calendar, MousePointerClick, AlertTriangle, XCircle, ShieldAlert, Loader2, Activity } from "lucide-react"
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
import { TokenUsageCard } from "./components/TokenUsageCard"

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  replied: {
    label: "Replied",
    color: "text-emerald-700",
    bg: "bg-emerald-100 border-emerald-200",
    icon: <MessageSquareReply className="w-3 h-3" />,
  },
  clicked: {
    label: "Clicked",
    color: "text-indigo-700",
    bg: "bg-indigo-100 border-indigo-200",
    icon: <MousePointerClick className="w-3 h-3" />,
  },
  opened: {
    label: "Opened",
    color: "text-blue-700",
    bg: "bg-blue-100 border-blue-200",
    icon: <Eye className="w-3 h-3" />,
  },
  sent: {
    label: "Sent",
    color: "text-zinc-600",
    bg: "bg-zinc-100 border-zinc-200",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  pending: {
    label: "Pending",
    color: "text-amber-700",
    bg: "bg-amber-100 border-amber-200",
    icon: <Clock className="w-3 h-3" />,
  },
  scheduled: {
    label: "Scheduled",
    color: "text-amber-700",
    bg: "bg-amber-100 border-amber-200",
    icon: <Calendar className="w-3 h-3" />,
  },
  bounced: {
    label: "Bounced",
    color: "text-red-700",
    bg: "bg-red-100 border-red-200",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  complained: {
    label: "Spam Complained",
    color: "text-rose-800",
    bg: "bg-rose-100 border-rose-200",
    icon: <ShieldAlert className="w-3 h-3" />,
  },
  failed: {
    label: "Failed",
    color: "text-red-700",
    bg: "bg-red-100 border-red-200",
    icon: <XCircle className="w-3 h-3" />,
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
  const { summary, perEmail, timeline, tokenUsage } = analytics

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

  if (!isSessionLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground animate-in fade-in">
        <Loader2 className="w-5 h-5 animate-spin text-brand" />
        <p className="text-[14px] font-medium">Memuat data sesi...</p>
      </div>
    )
  }

  if (!hasCampaign) {
    return (
      <div className="flex justify-center py-16 animate-in fade-in duration-500">
        <div className="bg-white flex flex-col items-center justify-center p-8 border border-dashed border-border/80 rounded-2xl w-[340px] shadow-sm text-center">
          <div className="bg-brand/10 p-5 rounded-full mb-6">
            <Activity className="w-8 h-8 text-brand" strokeWidth={1.5} />
          </div>
          <h3 className="text-[17px] font-bold mb-1 tracking-tight">
            Belum ada analitik campaign
          </h3>
          <p className="text-center text-muted-foreground mb-8 text-[13px] leading-relaxed">
            Anda belum meluncurkan campaign apapun. Dasbor Pulse akan aktif setelah campaign Anda berjalan.
          </p>
          <Button onClick={() => router.push("/recon")} className="w-full bg-brand hover:bg-brand/90 text-white rounded-xl font-semibold">
            Mulai Recon
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between border-b pb-6 border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pulse — Campaign Analytics</h1>
          <p className="text-muted-foreground mt-1.5 text-[14.5px] font-medium max-w-lg">
            Pantau performa real-time campaign untuk{" "}
            <span className="font-bold text-foreground">{companyName}</span>.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/launch")}
          className="shadow-sm font-semibold text-[13.5px]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali ke Launch
        </Button>
      </div>

      {/* Stat Cards */}
      <StatCards summary={summary} />

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        <PerformanceBarChart data={perEmail} />
        <EngagementLineChart data={timeline} />
      </div>

      {/* Bottom Row: Email Status List + Token Usage */}
      <div className="grid grid-cols-[1fr_360px] gap-6">
        {/* Email Status List */}
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
                    <Mail className="w-4 h-4" />
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

        {/* Token Usage */}
        <TokenUsageCard tokenUsage={tokenUsage} />
      </div>
    </div>
  )
}
