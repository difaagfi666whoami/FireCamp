import { ProductMatch } from "@/types/match.types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit2, Trash2 } from "lucide-react"

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
              <Edit2 className="w-4 h-4" />
            </button>
            <button className="text-destructive/80 hover:text-destructive">
              <Trash2 className="w-4 h-4" />
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

        <Button variant="outline" className="w-full font-semibold border-border/80 shadow-sm">
          View Details
        </Button>
      </CardContent>
    </Card>
  )
}
