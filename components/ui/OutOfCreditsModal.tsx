"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function OutOfCreditsModal() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handler = () => setIsOpen(true)
    window.addEventListener("campfire_out_of_credits", handler)
    return () => window.removeEventListener("campfire_out_of_credits", handler)
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200 border border-border/40">
        <div className="w-12 h-12 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center mb-5">
          <AlertCircle className="w-6 h-6 text-danger" />
        </div>
        
        <h2 className="text-xl font-bold tracking-tight text-foreground mb-2">
          Kredit Habis
        </h2>
        <p className="text-[14px] text-muted-foreground leading-relaxed mb-8">
          Operasi ini membutuhkan kredit AI, tapi saldo akunmu tidak mencukupi. Silakan lakukan top-up kredit untuk melanjutkan.
        </p>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="flex-1 rounded-full font-semibold"
            onClick={() => setIsOpen(false)}
          >
            Batal
          </Button>
          <Button 
            className="flex-1 rounded-full font-semibold bg-brand hover:bg-brand/90 text-white"
            onClick={() => {
              setIsOpen(false)
              router.push("/pricing")
            }}
          >
            Beli Kredit →
          </Button>
        </div>
      </div>
    </div>
  )
}
