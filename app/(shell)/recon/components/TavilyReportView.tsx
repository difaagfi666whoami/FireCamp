"use client"

import { Sparkles, ExternalLink } from "lucide-react"
import { MarkdownBlock } from "@/components/shared/MarkdownBlock"

interface Props {
  report: string
  companyName: string
  companyUrl: string
}

function parseSourceMap(report: string): Record<number, string> {
  const map: Record<number, string> = {}
  const sourcesMatch = report.match(/\n#{1,3}\s*Sources\s*\n([\s\S]+)$/i)
  if (!sourcesMatch) return map
  for (const line of sourcesMatch[1].split("\n")) {
    // Format: "- [N] https://url"
    const m = line.match(/^-\s*\[(\d+)\]\s+(https?:\/\/\S+)/)
    if (m) map[parseInt(m[1])] = m[2]
  }
  return map
}

function injectCitations(text: string, sourceMap: Record<number, string>): string {
  if (Object.keys(sourceMap).length === 0) return text
  return text.replace(/\[(\d+)\]/g, (match, n) => {
    const url = sourceMap[parseInt(n)]
    return url ? `[${n}](${url})` : match
  })
}

export function TavilyReportView({ report, companyName, companyUrl }: Props) {
  if (!report) {
    return (
      <div className="bg-white border border-border/60 rounded-2xl p-8 text-center text-muted-foreground text-[13.5px]">
        Laporan Tavily Research tidak tersedia.
      </div>
    )
  }

  const sourceMap = parseSourceMap(report)

  // Strip Sources section from body before splitting into sections
  const bodyOnly = report.replace(/\n#{1,3}\s*Sources\s*\n[\s\S]+$/i, "")
  const sections = bodyOnly.split(/(?=^#{1,3} )/m).filter(s => s.trim())

  const sourcesList = Object.entries(sourceMap)
    .map(([k, v]) => ({ index: parseInt(k), url: v }))
    .sort((a, b) => a.index - b.index)

  return (
    <div className="space-y-4">
      {/* Badge */}
      <div className="flex items-center gap-2 text-[12px] font-bold text-brand bg-brand-light px-3 py-1.5 rounded-full w-fit">
        <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
        Laporan Tavily Research Pro
      </div>

      {/* Content sections */}
      {sections.map((section, idx) => {
        const lines   = section.trim().split("\n")
        const heading = lines[0].replace(/^#{1,3}\s*/, "").trim()
        const body    = injectCitations(lines.slice(1).join("\n").trim(), sourceMap)

        return (
          <div key={idx} className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
            {heading && (
              <h3 className="font-bold text-[15px] text-foreground mb-4">{heading}</h3>
            )}
            {body && <MarkdownBlock content={body} />}
          </div>
        )
      })}

      {/* Sources panel */}
      {sourcesList.length > 0 && (
        <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-[15px] text-foreground mb-4">Sources</h3>
          <div className="space-y-2">
            {sourcesList.map(({ index, url }) => (
              <div key={index} className="flex items-start gap-2.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-brand/10 text-brand text-[10px] font-black flex items-center justify-center mt-0.5">
                  {index}
                </span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12.5px] text-blue-600 hover:underline break-all leading-snug flex items-center gap-1"
                >
                  {url}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
