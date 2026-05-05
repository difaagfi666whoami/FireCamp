"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Flame, Loader2, CheckCircle2, Mail, RotateCcw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { redeemInviteCode } from "@/lib/api/invite-codes"
import { flags } from "@/lib/config/feature-flags"
import { supabase } from "@/lib/supabase/client"

type State     = "idle" | "loading" | "success" | "error"
type SendState = "sending" | "sent" | "resending" | "failed"

const AUTO_SEND_FLAG = "campfire_invite_auto_sent"

const ERROR_MESSAGES: Record<string, string> = {
  invalid:          "Kode undangan tidak valid atau sudah kadaluarsa.",
  expired:          "Kode undangan sudah kadaluarsa.",
  exhausted:        "Kode undangan sudah dipakai. Hubungi tim Campfire.",
  already_redeemed: "Kamu sudah menukarkan kode undangan sebelumnya. Mengarahkan...",
  empty:            "Masukkan kode undangan kamu.",
  unauthenticated:  "Sesi tidak valid. Silakan login ulang.",
}

async function requestInviteEmail(force = false): Promise<boolean> {
  const res = await fetch("/api/invite-codes/auto-send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  })
  return res.ok
}

export default function RedeemInvitePage() {
  const router = useRouter()
  const [code, setCode]       = useState("")
  const [state, setState]     = useState<State>("idle")
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [sendState, setSendState] = useState<SendState>("sending")
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then((res) => {
      setUserEmail(res.data.session?.user?.email ?? null)
    })

    // Guard: only auto-send once per browser session to prevent duplicate emails
    // when the auth redirect flow double-mounts this component.
    if (sessionStorage.getItem(AUTO_SEND_FLAG)) {
      setSendState("sent")
      return
    }

    requestInviteEmail(false)
      .then(ok => {
        if (ok) sessionStorage.setItem(AUTO_SEND_FLAG, "1")
        setSendState(ok ? "sent" : "failed")
      })
      .catch(() => setSendState("failed"))
  }, [])

  const handleResendEmail = async () => {
    setSendState("resending")
    const ok = await requestInviteEmail(true).catch(() => false)
    setSendState(ok ? "sent" : "failed")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setState("loading")
    setErrorKey(null)

    const res = await redeemInviteCode(code)
    if (res.success) {
      setState("success")
      setTimeout(() => router.push("/onboarding"), 1200)
      return
    }
    if (res.error === "already_redeemed") {
      setErrorKey(res.error)
      setTimeout(() => router.push("/research-library"), 1500)
      return
    }
    if (res.error === "unauthenticated") {
      router.push("/login")
      return
    }
    setState("error")
    setErrorKey(res.error)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF] flex flex-col items-center justify-center px-6 py-16">
      <div className="flex items-center gap-2 mb-10">
        <Flame size={20} color="#0F6E56" />
        <span className="font-bold text-lg lowercase text-[#0D1A14]">campfire</span>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-border/60 shadow-sm p-8">
        {state === "success" ? (
          <div className="flex flex-col items-center text-center gap-4">
            <CheckCircle2 size={48} className="text-brand" />
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Kode berhasil ditukar!
            </h2>
            <p className="text-[14px] text-muted-foreground">
              Kamu mendapat <span className="font-semibold text-brand">
                {flags.FREE_CREDITS_ON_SIGNUP} kredit
              </span> gratis. Mengarahkan ke onboarding...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center mb-3">
                <Mail size={22} className="text-brand" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Cek email kamu
              </h1>
              <p className="text-[13.5px] text-muted-foreground leading-relaxed">
                Kami telah mengirimkan kode undangan ke{" "}
                <span className="font-semibold text-foreground">
                  {userEmail ?? "emailmu"}
                </span>
                . Masukkan kode dari email untuk mendapatkan{" "}
                <span className="font-semibold text-brand">
                  {flags.FREE_CREDITS_ON_SIGNUP} kredit
                </span>{" "}
                gratis.
              </p>
            </div>

            {/* Email send status */}
            <div className={[
              "flex items-center gap-2.5 rounded-xl px-4 py-3 text-[12.5px] font-medium border",
              sendState === "sending" || sendState === "resending"
                ? "bg-muted/40 border-border/40 text-muted-foreground"
                : sendState === "sent"
                  ? "bg-brand/5 border-brand/20 text-brand"
                  : "bg-red-50 border-red-200 text-red-700",
            ].join(" ")}>
              {(sendState === "sending" || sendState === "resending")
                ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                : sendState === "sent"
                  ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  : <Mail className="w-3.5 h-3.5 shrink-0" />
              }
              <span className="flex-1">
                {sendState === "sending"   && "Mengirim kode ke email kamu..."}
                {sendState === "resending" && "Mengirim ulang..."}
                {sendState === "sent"      && "Email terkirim. Cek inbox (atau folder spam)."}
                {sendState === "failed"    && "Gagal mengirim email."}
              </span>
              {(sendState === "sent" || sendState === "failed") && (
                <button
                  type="button"
                  onClick={handleResendEmail}
                  className="shrink-0 flex items-center gap-1 text-[11.5px] font-semibold underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
                >
                  <RotateCcw className="w-3 h-3" />
                  Kirim ulang
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="code" className="text-[13px] font-semibold text-foreground">
                Kode undangan
              </Label>
              <Input
                id="code"
                type="text"
                placeholder="CAMP-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={state === "loading"}
                required
                className="rounded-xl uppercase tracking-widest font-mono"
                autoFocus
              />
            </div>

            {errorKey && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {ERROR_MESSAGES[errorKey] ?? "Terjadi kesalahan. Coba lagi."}
              </p>
            )}

            <Button
              type="submit"
              disabled={state === "loading" || !code.trim()}
              className="w-full rounded-full bg-brand text-white py-3 font-semibold hover:bg-brand/90 h-auto text-base"
            >
              {state === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Memproses...
                </>
              ) : (
                "Tukarkan kode →"
              )}
            </Button>

            <div className="text-center text-[12px] text-muted-foreground">
              Butuh bantuan?{" "}
              <Link href="mailto:hello@campfire.id" className="text-brand font-semibold hover:underline">
                Hubungi tim Campfire
              </Link>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="w-full text-[12px] text-muted-foreground/60 hover:text-foreground transition-colors py-2"
            >
              Keluar dan masuk dengan email lain
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
