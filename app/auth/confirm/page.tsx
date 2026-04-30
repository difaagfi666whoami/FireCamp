"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

// /auth/confirm is kept as an alias — redirect to /auth/callback which handles all flows
function AuthConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get("code")
    const hash = window.location.hash

    if (code) {
      router.replace(`/auth/callback?code=${code}`)
    } else if (hash) {
      router.replace(`/auth/callback${hash}`)
    } else {
      router.replace("/auth/callback")
    }
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-[#F5F3EF] flex flex-col items-center justify-center p-4">
      <Loader2 className="w-12 h-12 animate-spin text-[#0F6E56] mb-4" />
      <p className="text-sm text-[#0D1A14]/60 mt-2">Memverifikasi akses...</p>
    </div>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#0F6E56]" />
      </div>
    }>
      <AuthConfirmContent />
    </Suspense>
  )
}
