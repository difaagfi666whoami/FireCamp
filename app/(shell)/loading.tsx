import { Loader2 } from "lucide-react"

export default function ShellLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-full gap-3 p-8">
      <Loader2 className="w-6 h-6 animate-spin text-brand" strokeWidth={1.5} />
      <p className="text-[13px] text-muted-foreground">Memuat...</p>
    </div>
  )
}
