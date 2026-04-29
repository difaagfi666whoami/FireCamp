"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-variants"
import { cn } from "@/lib/utils"

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ShellError({ error, reset }: ErrorPageProps) {
  const message = error?.message?.trim()
    ? error.message
    : "Terjadi kesalahan tak terduga. Silakan coba lagi."

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="bg-white border border-border/60 rounded-2xl p-8 max-w-md w-full flex flex-col items-center text-center gap-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-amber-500" strokeWidth={1.5} />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-[17px] font-bold text-foreground tracking-tight">
            Terjadi kesalahan.
          </h2>
          <p className="text-[13.5px] text-muted-foreground leading-relaxed max-w-xs">
            {message}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button
            onClick={reset}
            className="bg-brand hover:bg-brand/90 text-white font-semibold text-[13.5px]"
          >
            Coba Lagi
          </Button>
          <Link
            href="/research-library"
            className={cn(buttonVariants({ variant: "outline" }), "text-[13.5px] font-medium")}
          >
            Research Library
          </Link>
        </div>
      </div>
    </div>
  )
}
