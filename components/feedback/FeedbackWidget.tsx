"use client"

import { useEffect, useState } from "react"
import { MessageSquare, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { flags } from "@/lib/config/feature-flags"
import { submitFeedback, type Sentiment } from "@/lib/api/feedback"

const SENTIMENTS: { key: Sentiment; emoji: string; label: string }[] = [
  { key: "positive", emoji: "😊", label: "Positif" },
  { key: "neutral",  emoji: "😐", label: "Netral"  },
  { key: "negative", emoji: "😞", label: "Negatif" },
]

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [sentiment, setSentiment] = useState<Sentiment>("neutral")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // External callers (e.g. OutOfCreditsModal, BillingDisabledPlaceholder) can
  // pop the widget open by dispatching a `campfire_open_feedback` window event.
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("campfire_open_feedback", handler)
    return () => window.removeEventListener("campfire_open_feedback", handler)
  }, [])

  // Hide widget entirely when the flags say so. Hooks above run unconditionally
  // so the React rule-of-hooks is satisfied even when the widget is disabled.
  if (!flags.FEEDBACK_WIDGET_ENABLED || !flags.EARLY_ACCESS_MODE) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || submitting) return
    setSubmitting(true)
    const res = await submitFeedback({
      sentiment,
      message: message.trim(),
      path: typeof window !== "undefined" ? window.location.pathname : "",
    })
    setSubmitting(false)

    if (res.ok) {
      toast.success("Terima kasih atas masukan kamu!")
      setOpen(false)
      setMessage("")
      setSentiment("neutral")
    } else {
      toast.error("Gagal mengirim masukan. Coba lagi sebentar.")
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-brand text-white px-4 py-2.5 shadow-lg hover:bg-brand/90 transition-colors text-[13px] font-semibold"
        aria-label="Beri masukan"
      >
        <MessageSquare className="w-4 h-4" strokeWidth={2} />
        Feedback
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold tracking-tight">
              Beri masukan
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              Kamu dalam Early Access. Setiap masukan kamu langsung dibaca oleh tim Campfire.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Bagaimana pengalamannya?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SENTIMENTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSentiment(s.key)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-3 rounded-xl border transition-colors",
                      sentiment === s.key
                        ? "border-brand bg-brand/5"
                        : "border-border/60 hover:bg-muted/40",
                    )}
                  >
                    <span className="text-2xl leading-none">{s.emoji}</span>
                    <span className="text-[12px] font-medium text-foreground">
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="feedback-message"
                className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block"
              >
                Masukan kamu
              </label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ceritakan apa yang kamu suka, apa yang membingungkan, atau fitur yang kamu butuhkan..."
                rows={5}
                maxLength={4000}
                disabled={submitting}
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground/70 mt-1.5 text-right">
                {message.length} / 4000
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-muted-foreground/60 flex-1 truncate">
                Halaman: {typeof window !== "undefined" ? window.location.pathname : ""}
              </p>
              <Button
                type="submit"
                disabled={!message.trim() || submitting}
                className="rounded-full font-semibold bg-brand hover:bg-brand/90 text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Kirim
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
