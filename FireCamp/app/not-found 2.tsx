"use client"

import Link from "next/link"
import { Flame } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F5F3EF] text-[#0D1A14] flex flex-col">
      {/* Top-left logo */}
      <header className="px-8 py-6">
        <Link href="/" className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 bg-[#0F6E56] rounded-lg flex items-center justify-center">
            <Flame className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <span className="font-bold text-[15px] tracking-tight text-[#0D1A14]">Campfire</span>
        </Link>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 pb-24">
        <p className="text-xs tracking-widest text-[#0D1A14]/40 uppercase mb-6">Error</p>

        <h1
          className="font-black tracking-tighter text-[#0D1A14] leading-none mb-6"
          style={{ fontSize: "clamp(6rem, 18vw, 14rem)" }}
        >
          404
        </h1>

        <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-[#0D1A14] mb-3">
          Halaman tidak ditemukan.
        </h2>
        <p className="text-base text-[#0D1A14]/60 max-w-md mb-10">
          Halaman yang kamu cari tidak ada atau sudah dipindahkan.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="rounded-full border border-[#0D1A14]/30 px-8 py-3 text-base text-[#0D1A14] hover:bg-[#0D1A14]/5 transition-all font-medium"
          >
            ← Kembali
          </button>
          <Link
            href="/"
            className="rounded-full bg-[#0F6E56] text-white px-8 py-3 text-base font-semibold hover:bg-[#0F6E56]/90 transition-all"
          >
            Beranda →
          </Link>
        </div>
      </div>
    </div>
  )
}
