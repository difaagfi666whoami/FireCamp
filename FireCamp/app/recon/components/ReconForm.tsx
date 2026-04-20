"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface ReconFormProps {
  onGenerate: (url: string) => void
  isLoading: boolean
}

export function ReconForm({ onGenerate, isLoading }: ReconFormProps) {
  const [url, setUrl] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url || !url.includes(".")) {
      toast.error("Masukkan URL perusahaan yang valid")
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
        Generate Profil
      </Button>
    </form>
  )
}
