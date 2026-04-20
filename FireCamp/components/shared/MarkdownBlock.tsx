"use client"

/**
 * MarkdownBlock — lightweight Markdown-to-JSX renderer.
 * Handles: ## headings, **bold**, *italic*, - bullets, 1. numbered lists, blank-line paragraphs.
 * No external library — safe to use under the no-new-deps rule in architecture.md.
 */

import { cn } from "@/lib/utils"

// ── Inline renderer (bold + italic) ──────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  // Matches: **bold**, *italic*, [label](url)
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)]+)\))/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[0].startsWith("**")) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {match[2]}
        </strong>
      )
    } else if (match[0].startsWith("*")) {
      // *italic*
      parts.push(<em key={match.index}>{match[3]}</em>)
    } else {
      // [label](url) — citation link
      const label = match[4]
      const href  = match[5]
      parts.push(
        <a
          key={match.index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 hover:underline text-[12px] font-medium"
        >
          {label}
          <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>
}

// ── Block types ───────────────────────────────────────────────────────────────

type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; text: string }
  | { type: "blank" }
  | { type: "table"; headers: string[]; rows: string[][] }

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n")
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      blocks.push({ type: "blank" })
      i++
      continue
    }

    // ## Heading 2
    if (/^##\s+/.test(trimmed)) {
      blocks.push({ type: "h2", text: trimmed.replace(/^##\s+/, "") })
      i++
      continue
    }

    // ### Heading 3
    if (/^###\s+/.test(trimmed)) {
      blocks.push({ type: "h3", text: trimmed.replace(/^###\s+/, "") })
      i++
      continue
    }

    // Unordered list — collect consecutive - or * items
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""))
        i++
      }
      blocks.push({ type: "ul", items })
      continue
    }

    // Ordered list — collect consecutive N. items
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""))
        i++
      }
      blocks.push({ type: "ol", items })
      continue
    }

    // Markdown table — detect by | at start
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim())
        i++
      }
      const parseRow = (line: string) =>
        line.split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)

      const headers  = tableLines[0] ? parseRow(tableLines[0]) : []
      const dataRows = tableLines.slice(2).map(parseRow).filter(r => r.length > 0)

      if (headers.length > 0) {
        blocks.push({ type: "table", headers, rows: dataRows })
      }
      continue
    }

    // Plain paragraph
    blocks.push({ type: "p", text: trimmed })
    i++
  }

  return blocks
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MarkdownBlockProps {
  content: string
  className?: string
}

export function MarkdownBlock({ content, className }: MarkdownBlockProps) {
  if (!content) return null
  const blocks = parseBlocks(content)

  return (
    <div className={cn("space-y-2.5", className)}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "blank":
            return <div key={idx} className="h-1" />

          case "h2":
            return (
              <h4 key={idx} className="text-[14px] font-bold text-foreground mt-4 mb-1 first:mt-0">
                {renderInline(block.text)}
              </h4>
            )

          case "h3":
            return (
              <h5 key={idx} className="text-[13px] font-semibold text-foreground/90 mt-3 mb-0.5">
                {renderInline(block.text)}
              </h5>
            )

          case "ul":
            return (
              <ul key={idx} className="space-y-1.5 pl-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5 items-start text-[13.5px] text-foreground/85 leading-snug">
                    <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            )

          case "ol":
            return (
              <ol key={idx} className="space-y-1.5 pl-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5 items-start text-[13.5px] text-foreground/85 leading-snug">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-brand/10 text-brand text-[11px] font-black flex items-center justify-center mt-0.5">
                      {j + 1}
                    </span>
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ol>
            )

          case "table":
            return (
              <div key={idx} className="overflow-x-auto rounded-xl border border-border/60 mt-2 mb-1">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-muted border-b border-border/60">
                      {block.headers.map((h, j) => (
                        <th key={j} className="px-3 py-2 text-left font-bold text-foreground/80 whitespace-nowrap">
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={j} className={j % 2 === 0 ? "bg-white" : "bg-muted/30"}>
                        {row.map((cell, k) => (
                          <td key={k} className="px-3 py-2 text-foreground/75 align-top leading-snug border-t border-border/40">
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )

          case "p":
            return (
              <p key={idx} className="text-[13.5px] text-foreground/85 leading-relaxed">
                {renderInline(block.text)}
              </p>
            )
        }
      })}
    </div>
  )
}
