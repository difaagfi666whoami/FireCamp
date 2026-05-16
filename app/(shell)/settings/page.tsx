"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { getUserProfile, saveUserProfile } from "@/lib/api/profile"
import { EmailDomainSection } from "./components/EmailDomainSection"
import { Loader2 } from "lucide-react"
import { useLanguage } from "@/lib/i18n/LanguageContext"

interface FormState {
  workspaceName: string
  senderName: string
  senderTitle: string
  signature: string
}

const EMPTY_FORM: FormState = {
  workspaceName: "",
  senderName: "",
  senderTitle: "",
  signature: "",
}

export default function SettingsPage() {
  const { t } = useLanguage()
  const [form, setForm]         = useState<FormState>(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving]   = useState(false)

  useEffect(() => {
    getUserProfile().then((profile) => {
      if (profile) {
        setForm({
          workspaceName: profile.workspace_name ?? "",
          senderName:    profile.sender_name    ?? "",
          senderTitle:   profile.sender_title   ?? "",
          signature:     profile.signature      ?? "",
        })
      }
      setIsLoading(false)
    })
  }, [])

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.senderName.trim() || !form.senderTitle.trim()) return

    setIsSaving(true)
    const { error } = await saveUserProfile({
      workspaceName: form.workspaceName.trim(),
      senderName:    form.senderName.trim(),
      senderTitle:   form.senderTitle.trim(),
      signature:     form.signature.trim(),
    })
    setIsSaving(false)

    if (error) {
      toast.error(t("Failed to save profile"))
    } else {
      toast.success(t("Profile saved successfully"))
      window.dispatchEvent(new Event("campfire_profile_changed"))
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="border-b pb-6 border-border/40">
        <h1 className="text-2xl font-bold tracking-tight">{t("Settings (title)")}</h1>
        <p className="text-muted-foreground mt-1.5 text-[14.5px] font-medium">
          {t("Manage your sender identity and workspace.")}
        </p>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground animate-in fade-in">
          <Loader2 className="w-7 h-7 animate-spin" strokeWidth={1.5} />
          <p className="text-[14px] font-medium">{t("Loading profile...")}</p>
        </div>
      )}

      {/* Form */}
      {!isLoading && (
        <>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Workspace */}
          <div className="space-y-2">
            <Label htmlFor="workspaceName" className="font-semibold text-sm">
              {t("Team / Workspace Name")}
            </Label>
            <Input
              id="workspaceName"
              placeholder="Contoh: Tim Sales Acme Corp"
              value={form.workspaceName}
              onChange={set("workspaceName")}
              className="rounded-xl border-border/60"
              disabled={isSaving}
            />
          </div>

          {/* Sender name */}
          <div className="space-y-2">
            <Label htmlFor="senderName" className="font-semibold text-sm">
              {t("Sender Name")} <span className="text-danger">*</span>
            </Label>
            <Input
              id="senderName"
              placeholder="Nama lengkap"
              value={form.senderName}
              onChange={set("senderName")}
              className="rounded-xl border-border/60"
              required
              disabled={isSaving}
            />
          </div>

          {/* Sender title */}
          <div className="space-y-2">
            <Label htmlFor="senderTitle" className="font-semibold text-sm">
              {t("Job Title")} <span className="text-danger">*</span>
            </Label>
            <Input
              id="senderTitle"
              placeholder="Contoh: Account Executive"
              value={form.senderTitle}
              onChange={set("senderTitle")}
              className="rounded-xl border-border/60"
              required
              disabled={isSaving}
            />
          </div>

          {/* Signature */}
          <div className="space-y-2">
            <Label htmlFor="signature" className="font-semibold text-sm">
              {t("Signature")}{" "}
              <span className="font-normal text-muted-foreground">{t("(optional)")}</span>
            </Label>
            <Textarea
              id="signature"
              placeholder="Salam, [Nama] | [Perusahaan]"
              value={form.signature}
              onChange={set("signature")}
              className="rounded-xl border-border/60 min-h-[100px]"
              disabled={isSaving}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isSaving || !form.senderName.trim() || !form.senderTitle.trim()}
            className="bg-brand hover:bg-brand/90 text-white shadow-sm font-semibold text-[13.5px] rounded-xl px-6"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.5} />
                {t("Saving...")}
              </>
            ) : (
              t("Save Changes")
            )}
          </Button>
        </form>

        {/* Email domain section */}
        <div className="space-y-4 pt-2">
          <div className="border-t pt-6 border-border/40">
            <h2 className="text-base font-semibold tracking-tight">Domain Email Pengirim</h2>
            <p className="text-muted-foreground mt-1 text-[13.5px]">
              Kirim campaign dari alamat email domain perusahaan kamu sendiri.
            </p>
          </div>
          <EmailDomainSection />
        </div>
        </>
      )}
    </div>
  )
}
