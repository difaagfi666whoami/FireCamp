"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Loader2, AlertCircle } from "lucide-react"

function stripQuotes(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }

// Helper to get cookie name matching middleware
function getCookieName(url: string): string {
  try {
    const cleanUrl = stripQuotes(url)
    const hostname = new URL(cleanUrl).hostname
    const projectRef = hostname.split(".")[0]
    return `sb-${projectRef}-auth-token`
  } catch {
    return "sb-unknown-auth-token"
  }
}

function AuthConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const handleSession = async () => {
      try {
        const code = searchParams.get("code")
        
        // 1. Jika ada 'code' di URL (PKCE flow dari Supabase Magic Link)
        // Kita harus exchange code tersebut secara eksplisit di client-side
        // agar supabase-js bisa membaca code-verifier dari localStorage
        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeErr) {
            console.error("Exchange code failed:", exchangeErr)
            // Lanjut ke pengecekan getSession(), siapa tahu sudah sukses ter-exchange sebelumnya
          } else {
            // Bersihkan URL agar code tidak menempel
            window.history.replaceState(null, "", window.location.pathname)
          }
        }

        // 2. Ambil session aktif
        const { data: { session }, error: getSessionError } = await supabase.auth.getSession()
        
        if (getSessionError) throw getSessionError

        if (session) {
          // Sync to cookie
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
          const cookieName = getCookieName(url)
          
          const cookieValue = encodeURIComponent(JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            expires_in: session.expires_in,
            token_type: session.token_type,
            user: session.user,
          }))
          
          document.cookie = `${cookieName}=${cookieValue}; path=/; max-age=${session.expires_in}; SameSite=Lax`
          
          if (isMounted) router.push("/research-library")
        } else if (!code) {
          // Tidak ada session dan tidak ada code -> gagal login
          if (isMounted) setError("Sesi tidak ditemukan. Pastikan Anda mengklik link dari perangkat/browser yang sama.")
        }
      } catch (err: any) {
        console.error("Callback session error:", err)
        if (isMounted) setError(err.message || "Gagal memverifikasi login.")
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
        const cookieName = getCookieName(url)
        
        const cookieValue = encodeURIComponent(JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          expires_in: session.expires_in,
          token_type: session.token_type,
          user: session.user,
        }))
        
        document.cookie = `${cookieName}=${cookieValue}; path=/; max-age=${session.expires_in}; SameSite=Lax`
        
        if (isMounted) router.push("/research-library")
      }
    })

    handleSession()

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [router, searchParams])

  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F3EF] flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-[#0D1A14] text-center">Gagal Masuk</h1>
        <p className="text-sm text-[#0D1A14]/60 mt-2 text-center max-w-md">{error}</p>
        <button
          onClick={() => router.push("/login")}
          className="mt-6 px-6 py-2 bg-[#0F6E56] text-white rounded-full font-semibold hover:bg-[#0F6E56]/90 transition"
        >
          Kembali ke Login
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF] flex flex-col items-center justify-center p-4">
      <Loader2 className="w-12 h-12 animate-spin text-[#0F6E56] mb-4" />
      <h1 className="text-xl font-bold text-[#0D1A14]">Memverifikasi akses...</h1>
      <p className="text-sm text-[#0D1A14]/60 mt-2">Mohon tunggu sebentar, Anda sedang diarahkan ke Campfire.</p>
    </div>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-[#0F6E56]"/></div>}>
      <AuthConfirmContent />
    </Suspense>
  )
}
