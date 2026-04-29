"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { saveUserProfile } from "@/lib/api/profile"

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  const [teamName, setTeamName] = useState("")
  const [senderName, setSenderName] = useState("")
  const [senderTitle, setSenderTitle] = useState("")
  const [signature, setSignature] = useState("")
  const [targetUrl, setTargetUrl] = useState("")

  const handleFinish = () => {
    localStorage.setItem("campfire_onboarding_done", "true")
    if (teamName.trim()) {
      localStorage.setItem("campfire_workspace_name", teamName.trim())
    }
    if (targetUrl.trim()) {
      sessionStorage.setItem("campfire_recon_prefill_url", targetUrl.trim())
    }

    // Persist sender identity to database — fire-and-forget, never blocks navigation
    saveUserProfile({
      senderName:    senderName.trim(),
      senderTitle:   senderTitle.trim(),
      signature:     signature.trim(),
      workspaceName: teamName.trim(),
    })

    router.push(targetUrl.trim() ? "/recon" : "/research-library")
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF] flex flex-col items-center justify-center px-6 py-16">
      <div className="flex items-center gap-3 mb-10">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`w-3 h-3 rounded-full border-2 transition-all ${
              n <= step
                ? "bg-[#0F6E56] border-[#0F6E56]"
                : "bg-transparent border-[#0D1A14]/30"
            }`}
          />
        ))}
      </div>

      <div className="w-full max-w-md">
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-black text-[#0D1A14] tracking-tight leading-tight">
                Selamat datang di Campfire.
              </h1>
              <p className="text-[#0D1A14]/60 mt-3">
                Kami siapkan workspace kamu dalam 3 langkah cepat.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamName" className="text-[#0D1A14] font-semibold text-sm">
                Nama tim / perusahaan kamu
              </Label>
              <Input
                id="teamName"
                placeholder="Contoh: Tim Sales Acme Corp"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="rounded-xl border-[#0D1A14]/20 focus:ring-[#0F6E56]/30"
              />
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!teamName.trim()}
              className="w-full rounded-full bg-[#0F6E56] text-white py-3 h-auto text-base font-semibold hover:bg-[#0F6E56]/90"
            >
              Lanjut →
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-black text-[#0D1A14] tracking-tight leading-tight">
                Dari siapa email ini dikirim?
              </h1>
              <p className="text-[#0D1A14]/60 mt-3">
                Informasi ini akan digunakan sebagai identitas pengirim di semua campaign kamu.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="senderName" className="text-[#0D1A14] font-semibold text-sm">
                  Nama lengkap pengirim
                </Label>
                <Input
                  id="senderName"
                  placeholder="Nama lengkap"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="rounded-xl border-[#0D1A14]/20 focus:ring-[#0F6E56]/30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="senderTitle" className="text-[#0D1A14] font-semibold text-sm">
                  Jabatan
                </Label>
                <Input
                  id="senderTitle"
                  placeholder="Contoh: Account Executive"
                  value={senderTitle}
                  onChange={(e) => setSenderTitle(e.target.value)}
                  className="rounded-xl border-[#0D1A14]/20 focus:ring-[#0F6E56]/30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signature" className="text-[#0D1A14] font-semibold text-sm">
                  Signature default <span className="font-normal text-[#0D1A14]/50">(opsional)</span>
                </Label>
                <Textarea
                  id="signature"
                  placeholder="Salam, [Nama] | [Perusahaan]"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  className="rounded-xl border-[#0D1A14]/20 focus:ring-[#0F6E56]/30 min-h-[100px]"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                className="rounded-full px-6 text-[#0D1A14]/60 hover:text-[#0D1A14]"
              >
                ← Kembali
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!senderName.trim()}
                className="flex-1 rounded-full bg-[#0F6E56] text-white py-3 h-auto text-base font-semibold hover:bg-[#0F6E56]/90"
              >
                Lanjut →
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-black text-[#0D1A14] tracking-tight leading-tight">
                Siap memulai outreach pertamamu?
              </h1>
              <p className="text-[#0D1A14]/60 mt-3">
                Campfire bekerja dari URL perusahaan target. Masukkan satu URL untuk memulai — atau lewati dan jelajahi dulu.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetUrl" className="text-[#0D1A14] font-semibold text-sm">
                URL perusahaan target pertama
              </Label>
              <Input
                id="targetUrl"
                placeholder="https://perusahaan-target.com"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="rounded-xl border-[#0D1A14]/20 focus:ring-[#0F6E56]/30"
              />
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleFinish}
                className="w-full rounded-full bg-[#0F6E56] text-white py-3 h-auto text-base font-semibold hover:bg-[#0F6E56]/90"
              >
                Mulai Recon →
              </Button>
              <div className="text-center">
                <button
                  onClick={() => {
                    localStorage.setItem("campfire_onboarding_done", "true")
                    if (teamName.trim()) {
                      localStorage.setItem("campfire_workspace_name", teamName.trim())
                    }
                    router.push("/research-library")
                  }}
                  className="text-sm text-[#0D1A14]/50 hover:text-[#0D1A14] transition-colors"
                >
                  Jelajahi dulu →
                </button>
              </div>
            </div>

            <Button
              variant="ghost"
              onClick={() => setStep(2)}
              className="w-full rounded-full text-[#0D1A14]/60 hover:text-[#0D1A14]"
            >
              ← Kembali
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
