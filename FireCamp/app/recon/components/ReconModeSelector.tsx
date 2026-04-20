import { ReconMode } from "@/types/recon.types"
import { cn } from "@/lib/utils"
import { Zap, Sparkles } from "lucide-react"

interface ReconModeSelectorProps {
  value: ReconMode
  onChange: (mode: ReconMode) => void
}

export function ReconModeSelector({ value, onChange }: ReconModeSelectorProps) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-[13px] font-bold text-foreground">Pilih mode riset</p>
      </div>
      
      <div className="flex gap-3">
        <button
          onClick={() => onChange('free')}
          className={cn(
            "flex-1 relative flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-[13.5px] font-semibold transition-all duration-200",
            value === 'free' 
              ? "bg-brand/5 border-brand text-brand ring-1 ring-brand"
              : "bg-white border-border/80 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <Zap className="w-4 h-4"  strokeWidth={1.5} />
          <span>Free</span>
        </button>

        <button
          disabled
          className={cn(
            "flex-1 relative flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-[13.5px] font-semibold transition-all duration-200",
            value === 'pro' 
              ? "bg-pro-accent/5 border-pro-accent text-pro-accent ring-1 ring-pro-accent"
              : "bg-muted border-border/80 text-muted-foreground opacity-60 cursor-not-allowed"
          )}
        >
          <Sparkles className="w-4 h-4"  strokeWidth={1.5} />
          <span>Pro</span>
          {/* Demo Mode badge */}
          <span className="absolute -top-2.5 -right-2.5 bg-pro-accent text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            Terkunci
          </span>
        </button>
      </div>
      
      <p className="text-[12px] text-muted-foreground mt-3 leading-relaxed">
        {value === 'free' 
          ? "Riset cepat untuk menghasilkan profil dan pain point umum. Memerlukan ~15 sedetik."
          : "Riset mendalam menggunakan data spesifik dan analisis komprehensif. Perlu lebih banyak kredit AI."}
      </p>
    </div>
  )
}
