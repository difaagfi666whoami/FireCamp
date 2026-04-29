"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Copy, Check } from "lucide-react"

interface EmailEditorProps {
  subject: string;
  body: string;
  onChangeSubject: (val: string) => void;
  onChangeBody: (val: string) => void;
  disabled?: boolean;
  isRegenerating?: boolean;
  emailId?: string;
}

export function EmailEditor({ subject, body, onChangeSubject, onChangeBody, disabled, isRegenerating, emailId }: EmailEditorProps) {
  const suffix = emailId ?? "default"
  const subjectId = `email-subject-${suffix}`
  const bodyId = `email-body-${suffix}`

  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 relative">
      {isRegenerating && (
        <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-xl border border-brand/20">
          <Loader2 className="w-8 h-8 text-brand animate-spin mb-3"  strokeWidth={1.5} />
          <p className="text-[13px] font-bold text-brand animate-pulse tracking-tight">Sedang menyesuaikan gaya bahasa...</p>
        </div>
      )}

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label htmlFor={subjectId} className="text-[13px] font-bold tracking-tight text-muted-foreground uppercase">Subject Line</label>
          <button
            onClick={handleCopy}
            disabled={!subject && !body}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
            {copied ? "Tersalin!" : "Salin Email"}
          </button>
        </div>
        <Input
          id={subjectId}
          name={subjectId}
          value={subject}
          onChange={e => onChangeSubject(e.target.value)}
          disabled={disabled}
          className="font-bold text-[16px] h-12 disabled:opacity-75 disabled:cursor-not-allowed bg-white shadow-sm"
          placeholder="Tulis subject line email..."
        />
      </div>

      <div className="space-y-2.5">
        <label htmlFor={bodyId} className="text-[13px] font-bold tracking-tight text-muted-foreground uppercase">Body Content</label>
        <Textarea
          id={bodyId}
          name={bodyId}
          value={body}
          onChange={e => onChangeBody(e.target.value)}
          disabled={disabled}
          style={{ fieldSizing: "fixed" } as React.CSSProperties}
          className="h-[500px] overflow-y-auto text-[15px] leading-relaxed resize-y font-medium text-foreground/90 disabled:opacity-75 disabled:cursor-not-allowed p-5 bg-white shadow-sm rounded-xl border-border/80"
          placeholder="Tulis isi email di sini..."
        />
      </div>
    </div>
  )
}
