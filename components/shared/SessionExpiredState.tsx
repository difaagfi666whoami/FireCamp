import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { session } from "@/lib/session"

interface Props {
  currentStage: "match" | "craft" | "polish" | "launch" | "pulse"
}

const STAGE_LABELS: Record<Props["currentStage"], string> = {
  match:  "Match",
  craft:  "Craft",
  polish: "Polish",
  launch: "Launch",
  pulse:  "Pulse",
}

export function SessionExpiredState({ currentStage }: Props) {
  const router = useRouter()

  function handleStartOver() {
    session.clearActiveTarget()
    router.push("/recon")
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center space-y-5">
      <div className="p-4 bg-muted rounded-2xl">
        <RotateCcw className="w-8 h-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Sesi tidak ditemukan</h2>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
          Data pipeline <strong>{STAGE_LABELS[currentStage]}</strong> tidak tersedia di
          tab atau browser ini. Ini biasanya terjadi karena halaman dibuka di tab baru
          atau browser di-refresh.
        </p>
      </div>
      <div className="space-y-2 w-full max-w-xs">
        <Button
          onClick={handleStartOver}
          className="w-full rounded-full bg-brand text-white hover:bg-brand/90"
        >
          Mulai Recon Baru
        </Button>
        <button
          onClick={() => router.push("/research-library")}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          Kembali ke Research Library
        </button>
      </div>
    </div>
  )
}
