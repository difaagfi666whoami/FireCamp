import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { ToneType } from "@/lib/mock/toneVariants"

interface ToneSelectorProps {
  currentTone: ToneType;
  onChange: (tone: ToneType) => void;
  disabled?: boolean;
  isRegenerating?: boolean;
}

const TONES: { label: string, value: ToneType }[] = [
  { label: "Profesional", value: "profesional" },
  { label: "Friendly", value: "friendly" },
  { label: "Direct", value: "direct" },
  { label: "Storytelling", value: "storytelling" },
]

export function ToneSelector({ currentTone, onChange, disabled, isRegenerating }: ToneSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TONES.map(tone => {
        const isActive = currentTone === tone.value
        return (
          <Button
            key={tone.value}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(tone.value)}
            disabled={disabled || isRegenerating}
            className={`${isActive ? 'bg-black text-white hover:bg-black/90' : 'bg-white hover:bg-slate-50'} h-8 rounded-full px-4 text-[12px] font-bold shadow-sm transition-all`}
          >
            {isActive && isRegenerating && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {tone.label}
          </Button>
        )
      })}
    </div>
  )
}
