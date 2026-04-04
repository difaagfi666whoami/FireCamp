"use client"

import { useState } from "react"
import { runMatching } from "@/lib/api/match"
import { session } from "@/lib/session"
import { markStageDone } from "@/lib/progress"
import { ProductMatch } from "@/types/match.types"
import { CompanyProfile } from "@/types/recon.types"

export function useMatch() {
  const [matchResults, setMatchResults] = useState<ProductMatch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)

  const STEPS = [
    "Menganalisis pain points perusahaan...",
    "Memindai katalog produk...",
    "Mengevaluasi kesesuaian produk...",
    "Menyusun rekomendasi...",
    "Memfinalisasi value proposition...",
  ]

  const run = async (companyProfile: CompanyProfile) => {
    setIsLoading(true)
    setError(null)
    setCurrentStep(0)

    try {
      for (let i = 0; i < STEPS.length - 1; i++) {
        setCurrentStep(i)
        await new Promise(r => setTimeout(r, 500))
      }
      setCurrentStep(STEPS.length - 1)

      const results = await runMatching(companyProfile)
      setMatchResults(results)
      return results
    } catch (err) {
      console.error("[Campfire/useMatch]", err)
      setError("Gagal menjalankan proses matching. Coba lagi.")
      return []
    } finally {
      setIsLoading(false)
    }
  }

  const proceed = (selectedProductId: string) => {
    session.setSelectedProductId(selectedProductId)
    markStageDone("match")
  }

  return { matchResults, isLoading, error, currentStep, steps: STEPS, run, proceed }
}
