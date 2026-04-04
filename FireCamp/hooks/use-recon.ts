"use client"

import { useState } from "react"
import { generateReconProfile } from "@/lib/api/recon"
import { session } from "@/lib/session"
import { markStageDone } from "@/lib/progress"
import { CompanyProfile } from "@/types/recon.types"

export function useRecon() {
  const [url, setUrl] = useState("")
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)

  const STEPS = [
    "Mengambil data LinkedIn via Proxycurl...",
    "Scanning website perusahaan via Firecrawl...",
    "Mencari kontak PIC yang relevan...",
    "Mengambil berita terkini via Tavily API...",
    "Menganalisis pain points dengan AI...",
    "Memfinalisasi profil & citation...",
  ]

  const generate = async () => {
    if (!url.trim()) return
    setIsLoading(true)
    setError(null)
    setCurrentStep(0)

    try {
      // Step-by-step progress (mock delays)
      for (let i = 0; i < STEPS.length - 1; i++) {
        setCurrentStep(i)
        await new Promise(r => setTimeout(r, 500))
      }
      setCurrentStep(STEPS.length - 1)

      const result = await generateReconProfile(url)
      setProfile(result)
      session.setReconProfile(result)
      if (result.id) session.setCompanyId(result.id)
      markStageDone("recon")
    } catch (err) {
      console.error("[Campfire/useRecon]", err)
      setError("Gagal mengambil profil perusahaan. Coba lagi.")
    } finally {
      setIsLoading(false)
    }
  }

  return { url, setUrl, profile, setProfile, isLoading, error, currentStep, steps: STEPS, generate }
}
