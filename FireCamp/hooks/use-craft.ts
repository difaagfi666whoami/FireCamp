"use client"

import { useState } from "react"
import { generateCampaign } from "@/lib/api/craft"
import { session } from "@/lib/session"
import { markStageDone } from "@/lib/progress"
import { Campaign } from "@/types/craft.types"
import { CompanyProfile } from "@/types/recon.types"
import { ProductCatalogItem } from "@/types/match.types"

export function useCraft() {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)

  const STEPS = [
    "Menganalisis profil perusahaan target...",
    "Memuat data produk yang dipilih...",
    "Menyusun Email 1: Ice-breaker...",
    "Menyusun Email 2: Pain-focused...",
    "Menyusun Email 3: Urgency & close...",
    "Memfinalisasi campaign & reasoning...",
  ]

  const generate = async (companyProfile: CompanyProfile, selectedProduct: ProductCatalogItem) => {
    setIsLoading(true)
    setError(null)
    setCurrentStep(0)

    try {
      for (let i = 0; i < STEPS.length - 1; i++) {
        setCurrentStep(i)
        await new Promise(r => setTimeout(r, 500))
      }
      setCurrentStep(STEPS.length - 1)

      const result = await generateCampaign(companyProfile, selectedProduct)
      setCampaign(result)
      session.setCraftCampaign(result)
      return result
    } catch (err) {
      console.error("[Campfire/useCraft]", err)
      setError("Gagal membuat campaign. Coba lagi.")
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const proceed = () => markStageDone("craft")

  return { campaign, setCampaign, isLoading, error, currentStep, steps: STEPS, generate, proceed }
}
