import Link from "next/link"
import { Flame } from "lucide-react"

const PIPELINE_STEPS = [
  { num: "01", name: "Recon",  desc: "Profil mendalam dari URL perusahaan target" },
  { num: "02", name: "Match",  desc: "Cocokkan pain point ke produk terbaik kamu" },
  { num: "03", name: "Craft",  desc: "AI menyusun 3 email campaign yang tajam" },
  { num: "04", name: "Polish", desc: "Edit dan finalisasi draft sebelum dikirim" },
  { num: "05", name: "Launch", desc: "Jadwalkan dan kirim ke inbox target" },
  { num: "06", name: "Pulse",  desc: "Pantau open rate, reply, dan performa campaign" },
]

const VALUE_PROPS = [
  {
    num: "01",
    statement: "Bukan sekadar template email.",
    body: "Campfire memahami konteks bisnis target — pain point, sinyal berita, dan posisi kompetitor — lalu menyusun pesan yang relevan secara operasional.",
    tag: "AI-powered Recon",
  },
  {
    num: "02",
    statement: "Eksekusi, bukan sekadar rencana.",
    body: "Dari riset ke pengiriman dalam satu sistem. Tidak ada handoff antar tools, tidak ada data yang hilang, tidak ada langkah yang terlewat.",
    tag: "End-to-end Pipeline",
  },
  {
    num: "03",
    statement: "Terstruktur sejak awal, bukan setelah berantakan.",
    body: "Setiap campaign punya profil, trail, dan analytics. Tim kamu tahu apa yang sedang dikerjakan, siapa yang mengerjakan, dan apa hasilnya.",
    tag: "Full Visibility",
  },
]

const STATS = [
  { value: "6 tahap",   label: "Pipeline lengkap dari riset ke analytics" },
  { value: "1 URL",     label: "Cukup URL perusahaan untuk memulai" },
  { value: "3 email",   label: "Campaign terstruktur per target, siap kirim" },
  { value: "Real-time", label: "Tracking open rate dan reply langsung di dashboard" },
]

export default function LandingPage() {
  return (
    <div className="bg-[#F5F3EF] text-[#0D1A14]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#F5F3EF]/90 backdrop-blur-sm border-b border-[#0D1A14]/10">
        <div className="grid grid-cols-3 items-center px-6 lg:px-16 h-16">
          {/* Left — intentionally empty */}
          <div />

          {/* Center */}
          <div className="flex items-center justify-center gap-2">
            <Flame size={16} color="#0F6E56" />
            <span className="text-sm tracking-tight text-[#0D1A14] font-black">
              campfire
            </span>
          </div>

          {/* Right */}
          <div className="flex items-center justify-end gap-5">
            <Link
              href="/login"
              className="text-sm tracking-[0.04em] text-[#0D1A14]/50 hover:text-[#0D1A14] transition-colors"
            >
              Masuk
            </Link>
            <a
              href="#contact"
              className="text-sm tracking-[0.04em] font-semibold px-5 py-2 rounded-full border border-[#0D1A14] hover:bg-[#0D1A14] hover:text-[#F5F3EF] transition-all"
            >
              Minta Akses →
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col justify-center pt-24 pb-16 px-6 lg:px-16">
        <p className="text-xs tracking-widest text-[#0D1A14]/50 uppercase mb-8">Platform Outreach B2B</p>

        <h1 className="font-black tracking-tighter text-[#0D1A14] leading-none" style={{ fontSize: "clamp(4rem, 10vw, 9rem)" }}>
          Riset. Cocokkan.
        </h1>
        <h1 className="font-black tracking-tighter text-[#0D1A14] leading-none" style={{ fontSize: "clamp(4rem, 10vw, 9rem)" }}>
          <span className="bg-[#C8EDE0] px-4 py-1 inline-block -rotate-1">Kirim.</span>
        </h1>

        <p className="text-xl text-[#0D1A14]/60 mt-6 max-w-lg font-normal">
          Dari satu URL perusahaan ke inbox prospek — dalam 6 langkah terstruktur.
        </p>

        <div className="flex flex-wrap items-center gap-4 mt-10">
          <Link
            href="/login"
            className="rounded-full bg-[#0F6E56] text-white px-8 py-3 text-base font-semibold hover:bg-[#0F6E56]/90 transition-all"
          >
            Masuk ke Campfire →
          </Link>
          <a
            href="#how-it-works"
            className="rounded-full border border-[#0D1A14]/30 px-8 py-3 text-base text-[#0D1A14] hover:bg-[#0D1A14]/5 transition-all"
          >
            Lihat cara kerjanya ↓
          </a>
        </div>

      </section>

      {/* Pipeline Flow */}
      <section
        id="how-it-works"
        className="relative py-24 px-6 lg:px-16 text-[#F5F3EF] overflow-hidden"
        style={{
          background: "linear-gradient(125deg, #0F2318 0%, #0A1A14 28%, #060E0A 52%, #0D1B0A 76%, #091610 100%)",
        }}
      >
        {/* Film grain — static */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 pointer-events-none mix-blend-screen"
          style={{
            opacity: 0.42,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "160px 160px",
          }}
        />

        {/* Directional light sweep */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 70% 40%, rgba(201,150,62,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10">
          <p className="text-xs tracking-widest text-[#C9963E] uppercase">Cara Kerja</p>
          <h2 className="text-4xl lg:text-6xl font-black tracking-tighter mt-4 text-[#F5F3EF] max-w-2xl">
            Satu pipeline. Enam langkah. Tanpa improvisasi.
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mt-12">
            {PIPELINE_STEPS.map((step) => (
              <div
                key={step.num}
                className="bg-white/[0.03] backdrop-blur-sm border border-[#F5F3EF]/10 rounded-2xl p-6 hover:bg-white/[0.06] hover:border-[#C9963E]/25 transition-all duration-300"
              >
                <p className="text-5xl font-black text-[#C9963E]/30 leading-none mb-4">{step.num}</p>
                <p className="text-xl font-bold text-[#F5F3EF] mb-2">{step.name}</p>
                <p className="text-sm text-[#F5F3EF]/50 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Propositions */}
      <section className="py-24 px-6 lg:px-16 bg-[#F5F3EF]">
        {VALUE_PROPS.map((vp, i) => (
          <div key={i} className="flex items-start gap-8 py-10 border-b border-[#0D1A14]/10 last:border-b-0">
            <span className="text-sm font-bold text-[#0D1A14]/30 shrink-0 pt-1">{vp.num}</span>
            <div className="flex-1 space-y-3">
              <p className="text-2xl lg:text-3xl font-black text-[#0D1A14] tracking-tight">{vp.statement}</p>
              <p className="text-base text-[#0D1A14]/60 max-w-2xl leading-relaxed">{vp.body}</p>
            </div>
            <span className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full bg-[#C8EDE0] text-[#0D1A14]">
              {vp.tag}
            </span>
          </div>
        ))}
      </section>

      {/* Stats / Trust */}
      <section className="py-16 px-6 lg:px-16 bg-[#C8EDE0]">
        <div className="flex justify-between items-center flex-wrap gap-8">
          {STATS.map((stat) => (
            <div key={stat.value}>
              <p className="text-5xl font-black text-[#0D1A14] leading-none">{stat.value}</p>
              <p className="text-sm text-[#0D1A14]/70 mt-1 max-w-[180px]">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section
        id="contact"
        className="relative py-32 px-6 lg:px-16 text-center overflow-hidden"
        style={{
          background: "linear-gradient(125deg, #091A12 0%, #071310 28%, #030806 52%, #091408 76%, #060F09 100%)",
        }}
      >
        {/* Film grain — static */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 pointer-events-none mix-blend-screen"
          style={{
            opacity: 0.38,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "160px 160px",
          }}
        />
        {/* Directional light sweep */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 70% 40%, rgba(201,150,62,0.04) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10">
        <p className="text-xs tracking-widest text-[#C8EDE0] uppercase mb-6">Mulai Sekarang</p>
        <h2 className="text-5xl lg:text-8xl font-black tracking-tighter text-[#F5F3EF] leading-none">
          Outreach yang benar-benar dioperasikan.
        </h2>
        <p className="text-[#F5F3EF]/60 mt-6 max-w-xl mx-auto text-base leading-relaxed">
          Campfire dirancang untuk tim yang tidak punya waktu untuk berimprovisasi. Terstruktur, tajam, dan siap dijalankan.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
          <Link
            href="/login"
            className="rounded-full bg-[#C8EDE0] text-[#0D1A14] px-10 py-4 text-lg font-bold hover:bg-[#C8EDE0]/90 transition-all"
          >
            Masuk ke Campfire →
          </Link>
          <a
            href="mailto:difaagfi1998@gmail.com"
            className="rounded-full border border-[#F5F3EF]/30 text-[#F5F3EF] px-10 py-4 text-lg hover:bg-[#F5F3EF]/5 transition-all"
          >
            Hubungi Tim →
          </a>
        </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 lg:px-16 bg-[#0D1A14] border-t border-[#F5F3EF]/10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Flame size={18} color="#F5F3EF" />
            <span className="font-bold text-[#F5F3EF] lowercase">campfire</span>
          </div>
          <p className="text-sm text-[#F5F3EF]/40">Research. Match. Send.</p>
          <p className="text-sm text-[#F5F3EF]/40">© 2025 Campfire</p>
        </div>
      </footer>
    </div>
  )
}
