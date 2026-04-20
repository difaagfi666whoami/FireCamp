import { BrainCircuit } from "lucide-react"

export function CampaignReasoning({ reasoning }: { reasoning: string }) {
  return (
    <div className="bg-brand/5 border border-brand/20 rounded-xl p-6 relative overflow-hidden shadow-sm">
      <div className="absolute -top-12 -right-12 text-brand/5 rotate-12">
        <BrainCircuit className="w-48 h-48"  strokeWidth={1.5} />
      </div>
      <div className="relative flex items-start gap-4 z-10">
        <div className="bg-brand text-white p-2.5 rounded-xl shrink-0">
          <BrainCircuit className="w-5 h-5"  strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="font-semibold text-[17px] text-brand-dark mb-1.5 tracking-tight">Campaign AI Reasoning</h3>
          <p className="text-[14.5px] leading-relaxed text-foreground/80 font-medium">
            {reasoning}
          </p>
        </div>
      </div>
    </div>
  )
}
