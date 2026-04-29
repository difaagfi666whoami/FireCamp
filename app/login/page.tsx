"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Flame, Loader2, CheckCircle2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase/client"

type State = "idle" | "loading" | "success" | "error"

const IS_DEV = process.env.NODE_ENV === "development"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [state, setState] = useState<State>("idle")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setState("loading")
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    })
    if (error) {
      setState("error")
    } else {
      setState("success")
    }
  }

  const handleResend = async () => {
    setState("loading")
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    })
    setState(error ? "error" : "success")
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF] flex">
      <div className="hidden lg:flex lg:w-1/2 bg-[#0D1A14] flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <Flame size={20} color="#C8EDE0" />
          <span className="text-[#F5F3EF] font-bold text-lg lowercase">campfire</span>
        </div>

        <div>
          <p className="text-4xl font-black text-[#F5F3EF] tracking-tighter leading-tight">
            Setiap outreach yang terstruktur
            <br />
            dimulai dari sini.
          </p>
        </div>

        <div />
      </div>

      <div className="w-full lg:w-1/2 flex flex-col">
        <div className="p-6">
          <Link href="/" className="text-sm text-[#0D1A14]/50 hover:text-[#0D1A14] transition-colors">
            ← Kembali ke beranda
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm">
            {state === "success" ? (
              <div className="flex flex-col items-center text-center gap-4">
                <CheckCircle2 size={48} color="#0F6E56" />
                <h2 className="text-2xl font-bold text-[#0D1A14] tracking-tight">Link masuk terkirim!</h2>
                <p className="text-sm text-[#0D1A14]/60">Cek inbox email kamu. Link berlaku 10 menit.</p>
                <button
                  onClick={handleResend}
                  className="text-sm text-[#0F6E56] hover:underline font-semibold"
                >
                  Kirim ulang →
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h1 className="text-3xl font-black text-[#0D1A14] tracking-tight">Masuk</h1>
                  <p className="text-sm text-[#0D1A14]/60 mt-2">
                    Masukkan email kamu. Kami kirim link masuk langsung ke inbox.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#0D1A14] font-semibold text-sm">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nama@perusahaan.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={state === "loading"}
                    required
                    className="rounded-xl border-[#0D1A14]/20 focus:ring-[#0F6E56]/30"
                  />
                </div>

                {state === "error" && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    Gagal mengirim link. Pastikan email valid dan coba lagi.
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={state === "loading" || !email.trim()}
                  className="w-full rounded-full bg-[#0F6E56] text-white py-3 font-semibold hover:bg-[#0F6E56]/90 h-auto text-base"
                >
                  {state === "loading" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Mengirim...
                    </>
                  ) : (
                    "Kirim Link Masuk →"
                  )}
                </Button>

                <p className="text-xs text-[#0D1A14]/40 text-center">
                  Belum punya akses? Hubungi tim Campfire.
                </p>

                {IS_DEV && (
                  <div className="border-t border-[#0D1A14]/10 pt-4">
                    <button
                      type="button"
                      onClick={() => { window.location.href = "/research-library" }}
                      className="w-full text-xs text-[#0D1A14]/40 hover:text-[#0D1A14]/70 transition-colors py-2 rounded-lg hover:bg-[#0D1A14]/5"
                    >
                      [DEV] Masuk tanpa auth →
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
