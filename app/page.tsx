"use client"

import Link from "next/link"
import { Flame, Languages } from "lucide-react"
import { AuroraCanvas } from "@/components/landing/AuroraCanvas"
import { useLanguage } from "@/lib/i18n/LanguageContext"

export default function LandingPage() {
  const { lang, setLang, t } = useLanguage()

  const PIPELINE_STEPS = [
    { num: "01", name: "Recon",  desc: t("Deep company profile from target URL") },
    { num: "02", name: "Match",  desc: t("Match pain points to your best product") },
    { num: "03", name: "Craft",  desc: t("AI composes 3 sharp email campaigns") },
    { num: "04", name: "Polish", desc: t("Edit and finalize drafts before sending") },
    { num: "05", name: "Launch", desc: t("Schedule and send to target inbox") },
    { num: "06", name: "Pulse",  desc: t("Track open rate, replies, and campaign performance") },
  ]

  const VALUE_PROPS = [
    {
      num: "01",
      statement: t("Not just email templates."),
      body: t("Campfire understands the target's business context — pain points, news signals, and competitor positioning — then composes operationally relevant messages."),
      tag: "AI-powered Recon",
    },
    {
      num: "02",
      statement: t("Execution, not just planning."),
      body: t("From research to delivery in one system. No handoffs between tools, no lost data, no missed steps."),
      tag: "End-to-end Pipeline",
    },
    {
      num: "03",
      statement: t("Structured from the start, not after it falls apart."),
      body: t("Every campaign has a profile, trail, and analytics. Your team knows what's being worked on, who's working on it, and what the results are."),
      tag: "Full Visibility",
    },
  ]

  const STATS = [
    { value: t("6 stages"),   label: t("Complete pipeline from research to analytics") },
    { value: "1 URL",          label: t("Just one company URL to get started") },
    { value: t("3 emails"),   label: t("Structured campaign per target, ready to send") },
    { value: "Real-time",      label: t("Track open rate and replies live on dashboard") },
  ]

  return (
    <div className="bg-[#F5F3EF] text-[#0D1A14]">

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#F5F3EF]/90 backdrop-blur-sm border-b border-[#0D1A14]/10">
        <div className="grid grid-cols-3 items-center px-6 lg:px-16 h-16">
          <div />
          <div className="flex items-center justify-center gap-2">
            <Flame size={16} color="#0F6E56" />
            <span className="text-sm tracking-tight text-[#0D1A14] font-black">campfire</span>
          </div>
          <div className="flex items-center justify-end gap-5">
            {/* EN | ID toggle */}
            <button
              onClick={() => setLang(lang === "id" ? "en" : "id")}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#0D1A14]/50 hover:text-[#0D1A14] transition-colors"
            >
              <Languages size={14} strokeWidth={1.8} />
              <span>{lang === "id" ? "EN" : "ID"}</span>
            </button>
            <Link
              href="/login"
              className="text-sm tracking-[0.04em] text-[#0D1A14]/50 hover:text-[#0D1A14] transition-colors"
            >
              {t("Sign In")}
            </Link>
            <a
              href="#contact"
              className="text-sm tracking-[0.04em] font-semibold px-5 py-2 rounded-full border border-[#0D1A14] hover:bg-[#0D1A14] hover:text-[#F5F3EF] transition-all"
            >
              {t("Request Access →")}
            </a>
          </div>
        </div>
      </nav>

      {/* Hero — aurora canvas clipped to first viewport only */}
      <section
        className="relative overflow-hidden"
        style={{ height: "100vh", cursor: "crosshair" }}
      >
        <AuroraCanvas />

        {/* Hero content */}
        <div
          className="absolute inset-0 z-[5] flex flex-col justify-center pointer-events-none"
          style={{ padding: "100px 6vw 60px" }}
        >
          <div style={{ maxWidth: 1500, margin: "0 auto", width: "100%" }}>
            <p
              className="uppercase text-[#8a948e] mb-7"
              style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, letterSpacing: "0.18em", fontWeight: 500 }}
            >
              {t("B2B Outreach Platform")}
            </p>

            <h1
              className="font-extrabold text-[#0D1A14] leading-none m-0 mb-9"
              style={{
                fontSize: "clamp(56px, 11vw, 168px)",
                letterSpacing: "-0.045em",
                maxWidth: "13ch",
              }}
            >
              {t("Research. Match.")}{" "}
              <span
                className="inline-block bg-[#C8EDE0] align-top"
                style={{ padding: "0.04em 0.14em 0.10em", marginTop: "0.10em", lineHeight: 0.95 }}
              >
                {t("Send.")}
              </span>
            </h1>

            <p
              className="text-[#4a5a52] font-normal m-0 mb-9"
              style={{ fontSize: "clamp(16px, 1.4vw, 20px)", lineHeight: 1.5, maxWidth: "36ch" }}
            >
              {t("From one company URL to prospect inbox — in 6 structured steps.")}
            </p>

            <div className="flex gap-3 flex-wrap items-center pointer-events-auto">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 transition-all"
                style={{
                  padding: "16px 26px",
                  borderRadius: 999,
                  fontSize: 15,
                  fontWeight: 600,
                  background: "#0F6E56",
                  color: "#F5F3EF",
                  boxShadow: "0 6px 20px rgba(15,110,86,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
                  textDecoration: "none",
                }}
              >
                {t("Sign in to Campfire")}
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7"/>
                </svg>
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 transition-all hover:bg-[rgba(13,26,20,0.05)]"
                style={{
                  padding: "16px 26px",
                  borderRadius: 999,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#0D1A14",
                  border: "1px solid rgba(13,26,20,0.22)",
                  textDecoration: "none",
                }}
              >
                {t("See how it works")}
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12l7 7 7-7"/>
                </svg>
              </a>
            </div>
          </div>
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
          <p className="text-xs tracking-widest text-[#C9963E] uppercase">{t("How It Works")}</p>
          <h2 className="text-4xl lg:text-6xl font-black tracking-tighter mt-4 text-[#F5F3EF] max-w-2xl">
            {t("One pipeline. Six steps. No improvisation.")}
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
          <p className="text-xs tracking-widest text-[#C8EDE0] uppercase mb-6">{t("Get Started")}</p>
          <h2 className="text-5xl lg:text-8xl font-black tracking-tighter text-[#F5F3EF] leading-none">
            {t("Outreach that's actually operated.")}
          </h2>
          <p className="text-[#F5F3EF]/60 mt-6 max-w-xl mx-auto text-base leading-relaxed">
            {t("Campfire is built for teams that don't have time to improvise. Structured, sharp, and ready to run.")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            <Link
              href="/login"
              className="rounded-full bg-[#C8EDE0] text-[#0D1A14] px-10 py-4 text-lg font-bold hover:bg-[#C8EDE0]/90 transition-all"
            >
              {t("Sign in to Campfire →")}
            </Link>
            <a
              href="mailto:difaagfi1998@gmail.com"
              className="rounded-full border border-[#F5F3EF]/30 text-[#F5F3EF] px-10 py-4 text-lg hover:bg-[#F5F3EF]/5 transition-all"
            >
              {t("Contact the Team →")}
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
