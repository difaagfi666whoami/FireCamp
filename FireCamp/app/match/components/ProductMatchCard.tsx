import { ProductMatch } from "@/types/match.types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit2, Trash2, Target, Lightbulb, CheckCircle2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function ProductMatchCard({ match }: { match: ProductMatch & { painPointTargeted?: string, usp?: string[] } }) {
  const scoreColor = match.matchScore >= 90 ? "stroke-success text-success" 
                   : match.matchScore >= 70 ? "stroke-warning text-warning" 
                   : "stroke-muted text-foreground";

  // Create a circular progress using svg
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (match.matchScore / 100) * circumference;

  return (
    <Card className="shadow-none border border-border/80">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-6">
          <h3 className="font-bold text-base">{match.name}</h3>
          <div className="flex items-center gap-3">
            <button className="text-muted-foreground hover:text-foreground">
              <Edit2 className="w-4 h-4"  strokeWidth={1.5} />
            </button>
            <button className="text-destructive/80 hover:text-destructive">
              <Trash2 className="w-4 h-4"  strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 mb-6">
          {/* Circular Progress */}
          <div className="relative w-[96px] h-[96px] flex items-center justify-center shrink-0">
            <svg className="transform -rotate-90 w-full h-full">
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="stroke-muted/30 fill-none"
                strokeWidth="6"
              />
              <circle
                cx="48"
                cy="48"
                r={radius}
                className={`fill-none ${scoreColor.split(' ')[0]}`}
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-[9px] font-semibold text-foreground/70 leading-none mb-1">Match Score:</span>
              <span className="text-xl font-bold leading-none tracking-tight">{match.matchScore}%</span>
            </div>
          </div>

          <div>
            <p className="text-[14px] text-foreground/90">
              <span className="font-bold">Key Alignments:</span> {match.usp ? match.usp.join(", ") : match.painPointTargeted}
            </p>
          </div>
        </div>

        <Dialog>
          <DialogTrigger render={<Button variant="outline" className="w-full font-semibold border-border/80 shadow-sm" onClick={(e) => e.stopPropagation()} />}>
            View Details
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl md:max-w-4xl w-[90vw] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className={`px-2.5 py-1 text-xs font-bold rounded-full ${scoreColor.split(' ')[1]} bg-muted/30 border border-muted`}>
                  {match.matchScore}% Cocok
                </div>
                {match.isRecommended && (
                  <div className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                    ★ Direkomendasikan
                  </div>
                )}
              </div>
              <DialogTitle className="text-2xl font-bold">{match.name}</DialogTitle>
              <DialogDescription className="text-base mt-2 font-medium">
                {match.tagline || match.description || "Solusi yang ditargetkan untuk kebutuhan perusahaan."}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* AI Reasoning */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 font-bold text-foreground">
                  <Lightbulb className="w-5 h-5 text-brand"  strokeWidth={1.5} />
                  Analisis AI (Reasoning)
                </h4>
                <div className="bg-muted/40 border border-border/60 rounded-xl p-4 text-[14px] leading-relaxed text-muted-foreground">
                  {match.reasoning || "Tidak ada detail analisis spesifik yang disediakan untuk produk ini."}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Pain Points Targeted */}
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 font-bold text-foreground">
                    <Target className="w-4 h-4 text-destructive"  strokeWidth={1.5} />
                    Targeted Pain Points
                  </h4>
                  <div className="space-y-2">
                    {(match.painPointTargeted ? match.painPointTargeted.split(' & ') : []).map((point, idx) => (
                      <div key={idx} className="flex gap-2 text-[13px] text-muted-foreground bg-destructive/5 rounded-lg p-3 border border-destructive/10">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-destructive/70 mt-0.5"  strokeWidth={1.5} />
                        <span>{point}</span>
                      </div>
                    ))}
                    {(!match.painPointTargeted || match.painPointTargeted.length === 0) && (
                      <p className="text-[13px] text-muted-foreground italic">Tidak ada pain point terdeteksi.</p>
                    )}
                  </div>
                </div>

                {/* USPs */}
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 font-bold text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-success"  strokeWidth={1.5} />
                    Unique Selling Propositions
                  </h4>
                  <div className="space-y-2">
                    {(match.usp && match.usp.length > 0 ? match.usp : ["-"]).map((usp, idx) => (
                      <div key={idx} className="flex gap-2 text-[13px] text-foreground font-medium bg-success/5 rounded-lg p-3 border border-success/10">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-success mt-0.5"  strokeWidth={1.5} />
                        <span>{usp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
