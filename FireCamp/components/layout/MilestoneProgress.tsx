"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { getSessionProgress } from "@/lib/progress"

const STAGES = [
  { key: "recon",   label: "Recon"  },
  { key: "match",   label: "Match"  },
  { key: "craft",   label: "Craft"  },
  { key: "polish",  label: "Polish" },
  { key: "launch",  label: "Launch" },
  { key: "pulse",   label: "Pulse"  },
] as const

type StageKey = typeof STAGES[number]["key"]

interface MilestoneProgressProps {
  activeStage?: StageKey
}

export function MilestoneProgress({ activeStage }: MilestoneProgressProps) {
  const [progress, setProgress] = useState<Record<StageKey, boolean>>({
    recon: false, match: false, craft: false, polish: false, launch: false, pulse: false,
  })

  useEffect(() => {
    const p = getSessionProgress()
    setProgress(p as Record<StageKey, boolean>)
  }, [activeStage])

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STAGES.map((stage, idx) => {
        const isDone   = progress[stage.key]
        const isActive = stage.key === activeStage && !isDone

        return (
          <div key={stage.key} className="flex items-center gap-1">
            {idx > 0 && (
              <span className="text-muted-foreground/40 text-xs">→</span>
            )}
            <span
              className={cn(
                "text-xs font-medium",
                isDone   ? "text-success"          : "",
                isActive ? "text-foreground"        : "",
                !isDone && !isActive ? "text-muted-foreground/50" : ""
              )}
            >
              {isDone   ? `${stage.label} ✓` : ""}
              {isActive ? `${stage.label} ●` : ""}
              {!isDone && !isActive ? `${stage.label} ○` : ""}
            </span>
          </div>
        )
      })}
    </div>
  )
}
