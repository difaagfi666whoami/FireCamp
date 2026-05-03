"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Flame, Loader2, CheckCircle2, Gift } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { redeemInviteCode } from "@/lib/api/invite-codes"
import { flags } from "@/lib/config/feature-flags"
import { supabase } from "@/lib/supabase/client"

type State = "idle" | "loading" | "success" | "error"

const ERROR_MESSAGES: Record<string, string> = {
  invalid:           "Kode undangan tidak valid atau sudah kadaluarsa.",
  expired:           "Kode undangan sudah kadaluarsa.",
  exhausted:         "Kode undangan sudah dipakai terlalu banyak. Hubungi tim Campfire.",
  already_redeemed:  "Kamu sudah menukarkan kode undangan sebelumnya. Mengarahkan...",
  empty:             "Masukkan kode undangan kamu.",
  unauthenticated:   "Sesi tidak valid. Silakan login ulang.",
}

export default function RedeemInvitePage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [state, setState] = useState<State>("idle")
  const [errorKey, setErrorKey] = useState<string | null>(null)

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
                <Gift size={22} className="text-brand" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Tukarkan kode undangan
              </h1>
              <p className="text-[13.5px] text-muted-foreground leading-relaxed">
                Campfire saat ini dalam Early Access. Masukkan kode undangan yang
                kamu terima untuk membuka akses dan {flags.FREE_CREDITS_ON_SIGNUP} kredit
                gratis.
              </p>
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
              Belum punya kode?{" "}
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
