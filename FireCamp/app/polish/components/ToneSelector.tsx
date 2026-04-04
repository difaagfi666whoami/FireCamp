import { Button } from "@/components/ui/button"

export type ToneType = "profesional" | "friendly" | "direct" | "storytelling";

interface ToneSelectorProps {
  currentTone: ToneType;
  onChange: (tone: ToneType) => void;
  disabled?: boolean;
}

const TONES: { label: string, value: ToneType }[] = [
  { label: "Profesional", value: "profesional" },
  { label: "Friendly", value: "friendly" },
  { label: "Direct", value: "direct" },
  { label: "Storytelling", value: "storytelling" },
]

export function ToneSelector({ currentTone, onChange, disabled }: ToneSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TONES.map(tone => (
        <Button
          key={tone.value}
          variant={currentTone === tone.value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(tone.value)}
          disabled={disabled}
          className={`${currentTone === tone.value ? 'bg-black text-white hover:bg-black/90' : 'bg-white hover:bg-slate-50'} h-8 rounded-full px-4 text-[12px] font-bold shadow-sm transition-all`}
        >
          {tone.label}
        </Button>
      ))}
    </div>
  )
}
