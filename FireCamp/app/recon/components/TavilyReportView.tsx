"use client"

import { Sparkles } from "lucide-react"
import { MarkdownBlock } from "@/components/shared/MarkdownBlock"

interface Props {
  report: string
  companyName: string
  companyUrl: string
}

export function TavilyReportView({ report, companyName, companyUrl }: Props) {
  if (!report) {
    return (
      <div className="bg-white border border-border/60 rounded-2xl p-8 text-center text-muted-foreground text-[13.5px]">
        Laporan Tavily Research tidak tersedia.
      </div>
    )
  }

  // Split report into sections by H1/H2/H3 headings
  const sections = report.split(/(?=^#{1,3} )/m).filter(s => s.trim())

  return (
    <div className="space-y-4">
      {/* Badge */}
      <div className="flex items-center gap-2 text-[12px] font-bold text-brand bg-brand-light px-3 py-1.5 rounded-full w-fit">
        <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
        Laporan Tavily Research Pro
      </div>

      {sections.map((section, idx) => {
        const lines   = section.trim().split("\n")
        const heading = lines[0].replace(/^#{1,3}\s*/, "").trim()
        const body    = lines.slice(1).join("\n").trim()

        return (
          <div key={idx} className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
            {heading && (
              <h3 className="font-bold text-[15px] text-foreground mb-4">{heading}</h3>
            )}
            {body && <MarkdownBlock content={body} />}
          </div>
        )
      })}
    </div>
  )
}
