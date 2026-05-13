"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useLanguage } from "@/lib/i18n/LanguageContext"

interface ReconFormProps {
  onGenerate: (url: string) => void
  isLoading: boolean
}

export function ReconForm({ onGenerate, isLoading }: ReconFormProps) {
  const { t } = useLanguage()
  const [url, setUrl] = useState("")

  useEffect(() => {
    const prefill = sessionStorage.getItem("campfire_recon_prefill_url")
    if (prefill) {
      setUrl(prefill)
      sessionStorage.removeItem("campfire_recon_prefill_url")
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url || !url.includes(".")) {
      toast.error(t("Enter a valid company URL"))
      return
    }
    onGenerate(url)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full">
      <div className="flex-1 w-full">
        <Input
          id="company-url"
          placeholder="https://company.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isLoading}
          autoComplete="off"
          className="rounded-xl h-11"
        />
      </div>
      <Button type="submit" disabled={isLoading || !url} className="w-full sm:w-auto h-11 px-8 rounded-xl font-bold bg-brand hover:bg-brand/90 text-white">
        {t("Generate Profile")}
      </Button>
    </form>
  )
}
