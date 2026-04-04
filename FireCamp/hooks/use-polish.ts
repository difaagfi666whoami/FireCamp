"use client"

import { useState } from "react"
import { markStageDone } from "@/lib/progress"
import { CampaignEmail } from "@/types/craft.types"

export function usePolish(initialEmails: CampaignEmail[]) {
  const [emails, setEmails] = useState<CampaignEmail[]>(initialEmails)

  const approvedCount = emails.filter(e => e.isApproved).length
  const allApproved   = emails.length > 0 && approvedCount === emails.length

  const updateEmail = (id: string, patch: Partial<Pick<CampaignEmail, "subject" | "body" | "tone">>) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  const approveEmail = (id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, isApproved: !e.isApproved } : e))
  }

  const proceed = () => {
    if (!allApproved) return
    markStageDone("polish")
  }

  return { emails, setEmails, approvedCount, allApproved, updateEmail, approveEmail, proceed }
}
