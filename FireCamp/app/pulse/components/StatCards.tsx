"use client"

import { Mail, Eye, MousePointerClick, MessageSquareReply, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardsSummary {
  emailsSent: number
  openRate: number
  clickRate: number
  replyRate: number
  industryBenchmarks: {
    openRate: number
    clickRate: number
    replyRate: number
  }
}

interface StatCardsProps {
  summary: StatCardsSummary
}

interface CardConfig {
  label: string
  value: string | number
  unit?: string
  benchmark?: number
  icon: React.ReactNode
  description: string
}

function BenchmarkBadge({ current, benchmark }: { current: number; benchmark: number }) {
  const diff = current - benchmark
  const pct = Math.abs(diff).toFixed(1)

  if (diff > 0) {
    return (
      <div className="flex items-center gap-1 text-[11.5px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
        <TrendingUp className="w-3 h-3" />
        +{pct}% vs benchmark
      </div>
    )
  }
  if (diff < 0) {
    return (
      <div className="flex items-center gap-1 text-[11.5px] font-bold text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
        <TrendingDown className="w-3 h-3" />
        -{pct}% vs benchmark
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1 text-[11.5px] font-bold text-muted-foreground bg-muted border border-border/60 px-2 py-0.5 rounded-full">
      <Minus className="w-3 h-3" />
      Sesuai benchmark
    </div>
  )
}

export function StatCards({ summary }: StatCardsProps) {
  const cards: CardConfig[] = [
    {
      label: "Email Dikirim",
      value: summary.emailsSent,
      icon: <Mail className="w-5 h-5" />,
      description: "Total email dalam sekuens campaign",
    },
    {
      label: "Open Rate",
      value: summary.openRate,
      unit: "%",
      benchmark: summary.industryBenchmarks.openRate,
      icon: <Eye className="w-5 h-5" />,
      description: `Benchmark industri: ${summary.industryBenchmarks.openRate}%`,
    },
    {
      label: "Click Rate",
      value: summary.clickRate,
      unit: "%",
      benchmark: summary.industryBenchmarks.clickRate,
      icon: <MousePointerClick className="w-5 h-5" />,
      description: `Benchmark industri: ${summary.industryBenchmarks.clickRate}%`,
    },
    {
      label: "Reply Rate",
      value: summary.replyRate,
      unit: "%",
      benchmark: summary.industryBenchmarks.replyRate,
      icon: <MessageSquareReply className="w-5 h-5" />,
      description: `Benchmark industri: ${summary.industryBenchmarks.replyRate}%`,
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white border border-border/60 rounded-xl p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-muted-foreground uppercase tracking-wider">
              {card.label}
            </span>
            <div className="p-2 bg-muted rounded-lg text-muted-foreground">
              {card.icon}
            </div>
          </div>

          <div>
            <p className="text-[32px] font-black tracking-tight text-foreground leading-none">
              {card.value}
              {card.unit && (
                <span className="text-[18px] font-bold text-muted-foreground ml-0.5">{card.unit}</span>
              )}
            </p>
            <p className="text-[12px] text-muted-foreground mt-1.5">{card.description}</p>
          </div>

          {card.benchmark !== undefined && (
            <BenchmarkBadge current={card.value as number} benchmark={card.benchmark} />
          )}
        </div>
      ))}
    </div>
  )
}
