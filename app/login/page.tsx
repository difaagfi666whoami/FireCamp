"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Flame, Loader2, CheckCircle2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/i18n/LanguageContext"

type State = "idle" | "loading" | "success" | "error"

export default function LoginPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [email, setEmail] = useState("")
  const [state, setState] = useState<State>("idle")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setState("loading")
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setState(error ? "error" : "success")
  }

  const handleGoogleLogin = async () => {
    setState("loading")
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) setState("error")
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
            {t("Every structured outreach starts here.")}
          </p>
        </div>

        <div />
      </div>

      <div className="w-full lg:w-1/2 flex flex-col">
        <div className="p-6">
          <Link href="/" className="text-sm text-[#0D1A14]/50 hover:text-[#0D1A14] transition-colors">
            {t("← Back to home")}
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm">
            {state === "success" ? (
              <div className="flex flex-col items-center text-center gap-4">
                <CheckCircle2 size={48} color="#0F6E56" />
                <h2 className="text-2xl font-bold text-[#0D1A14] tracking-tight">{t("Magic link sent!")}</h2>
                <p className="text-sm text-[#0D1A14]/60">{t("Check your inbox. Link is valid for 10 minutes.")}</p>
                <button
                  onClick={handleResend}
                  className="text-sm text-[#0F6E56] hover:underline font-semibold"
                >
                  {t("Resend →")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h1 className="text-3xl font-black text-[#0D1A14] tracking-tight">{t("Sign In")}</h1>
                  <p className="text-sm text-[#0D1A14]/60 mt-2">
                    {t("Enter your email. We'll send a magic link directly to your inbox.")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#0D1A14] font-semibold text-sm">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("name@company.com")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={state === "loading"}
                    required
                    className="rounded-xl border-[#0D1A14]/20 focus:ring-[#0F6E56]/30"
                  />
                </div>

                {state === "error" && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    {t("Failed to send link. Make sure the email is valid and try again.")}
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
                      {t("Sending...")}
                    </>
                  ) : (
                    t("Send Magic Link →")
                  )}
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#0D1A14]/10" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-[#F5F3EF] px-2 text-[#0D1A14]/50 font-medium">{t("OR")}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={state === "loading"}
                  className="w-full rounded-full border border-[#0D1A14]/20 bg-white text-[#0D1A14] py-3 font-semibold hover:bg-[#0D1A14]/5 h-auto text-base flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {t("Continue with Google")}
                </Button>

                <p className="text-xs text-[#0D1A14]/40 text-center mt-6">
                  {t("No access yet? Contact the Campfire team.")}
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
