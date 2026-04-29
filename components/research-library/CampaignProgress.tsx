import { CampaignProgress as ICampaignProgress } from "@/types/recon.types"
import { cn } from "@/lib/utils"

interface CampaignProgressProps {
  progress: ICampaignProgress
}

const STEPS = [
  { key: "recon",   label: "Recon" },
  { key: "match",   label: "Match" },
  { key: "craft",   label: "Craft" },
  { key: "polish",  label: "Polish" },
  { key: "launch",  label: "Launch" },
  { key: "pulse",   label: "Pulse" },
] as const

export function CampaignProgress({ progress }: CampaignProgressProps) {
  let foundFirstFalse = false

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, index) => {
        const done = progress[step.key as keyof ICampaignProgress]
        let state: "done" | "active" | "pending"
        if (done) {
          state = "done"
        } else if (!foundFirstFalse) {
          foundFirstFalse = true
          state = "active"
        } else {
          state = "pending"
        }

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-[11px] font-bold",
                  state === "done"    && "text-emerald-600",
                  state === "active"  && "text-foreground",
                  state === "pending" && "text-muted-foreground/50"
                )}
              >
                {step.label}
              </span>
              <span
                className={cn(
                  "text-[10px] font-black",
                  state === "done"    && "text-emerald-500",
                  state === "active"  && "text-amber-500",
                  state === "pending" && "text-muted-foreground/30"
                )}
              >
                {state === "done" ? "✓" : state === "active" ? "●" : "○"}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <span className="mx-1 text-[10px] text-muted-foreground/30 font-medium">→</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
