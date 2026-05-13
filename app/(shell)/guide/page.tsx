"use client"

import { BookOpen } from "lucide-react"
import { useLanguage } from "@/lib/i18n/LanguageContext"

export default function GuidePage() {
  const { t } = useLanguage()

  const PIPELINE_STEPS = [
    { step: 1, name: "Recon",  desc: t("Enter the target company URL. Campfire automatically analyzes pain points, key contacts, latest news, and competitor positioning.") },
    { step: 2, name: "Match",  desc: t("Campfire matches the target's pain points with the most relevant product from your catalog. Select the product with the highest relevance.") },
    { step: 3, name: "Craft",  desc: t("AI composes 3 email campaigns based on the target's business context and selected product. Process takes 30–60 seconds.") },
    { step: 4, name: "Polish", desc: t("Edit the subject and email body as needed. Use the 'Copy Email' button to copy to clipboard.") },
    { step: 5, name: "Launch", desc: t("Schedule email delivery to the target contact. Double-check the address and schedule before activating the campaign.") },
    { step: 6, name: "Pulse",  desc: t("Monitor open rate, click rate, and reply rate in real-time after the campaign is active.") },
  ]

  const FAQ = [
    { q: t("Why don't key contacts appear in Recon results?"),         a: t("Campfire searches for contacts from public data. If not found, try using Pro Mode for deeper search. Some smaller companies simply don't have enough public contact data.") },
    { q: t("How long does the Recon process take?"),                    a: t("Free Mode completes in 15–30 seconds. Pro Mode takes 45–90 seconds as it performs deeper analysis with more data sources.") },
    { q: t("Are emails sent immediately or can they be scheduled?"),    a: t("You can choose immediate delivery or schedule a specific date and time on the Launch page. All emails are sent through the email account registered in Settings.") },
    { q: t("How many emails are sent per campaign?"),                   a: t("Each campaign generates 3 emails (Email 1, 2, 3) directed to 1 target contact. You can edit each email before sending.") },
    { q: t("How do I restart research for the same company?"),         a: t("Open Research Library, find the company profile, then click 'Re-run Recon'. The URL will be pre-filled and you can generate a new profile immediately.") },
  ]

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-10 border-b pb-6">
        <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center shrink-0 mt-0.5">
          <BookOpen className="w-4 h-4 text-brand" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Campfire Guide")}</h1>
          <p className="text-muted-foreground mt-1 text-[14.5px] font-medium">
            {t("Everything you need to know to get started.")}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Section 1 — What is Campfire */}
        <details className="group border border-border/60 rounded-2xl overflow-hidden" open>
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none font-semibold text-[14.5px] hover:bg-muted/50 transition-colors select-none">
            {t("What is Campfire?")}
            <span className="text-muted-foreground text-lg transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="px-5 pb-5 space-y-3 text-[14px] text-muted-foreground leading-relaxed border-t border-border/40 pt-4">
            <p>{t("Campfire is a B2B outreach platform that automates the entire process — from target company research to email campaign delivery. All you need is a single company URL to get started.")}</p>
            <p>{t("Campfire is designed for sales and marketing teams who want to run outreach in a structured way: deep research, product matching, personalized emails, and analytics — all in one pipeline.")}</p>
          </div>
        </details>

        {/* Section 2 — Workflow */}
        <details className="group border border-border/60 rounded-2xl overflow-hidden" open>
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none font-semibold text-[14.5px] hover:bg-muted/50 transition-colors select-none">
            {t("Workflow — 6 Steps")}
            <span className="text-muted-foreground text-lg transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="px-5 pb-5 border-t border-border/40 pt-4">
            <div className="space-y-4">
              {PIPELINE_STEPS.map((s) => (
                <div key={s.step} className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-brand text-white text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {s.step}
                  </div>
                  <div>
                    <p className="font-semibold text-[14px] text-foreground">{s.name}</p>
                    <p className="text-[13.5px] text-muted-foreground leading-relaxed mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>

        {/* Section 3 — FAQ */}
        <details className="group border border-border/60 rounded-2xl overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none font-semibold text-[14.5px] hover:bg-muted/50 transition-colors select-none">
            FAQ
            <span className="text-muted-foreground text-lg transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="px-5 pb-5 border-t border-border/40 pt-4">
            <div className="space-y-5">
              {FAQ.map((item, i) => (
                <div key={i} className="space-y-1.5">
                  <p className="font-semibold text-[14px] text-foreground">{item.q}</p>
                  <p className="text-[13.5px] text-muted-foreground leading-relaxed">{item.a}</p>
                  {i < FAQ.length - 1 && <div className="border-b border-border/40 pt-2" />}
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}
