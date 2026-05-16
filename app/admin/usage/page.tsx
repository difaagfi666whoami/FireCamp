"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCcw, AlertTriangle, ExternalLink } from "lucide-react"

type Stats = {
  users: {
    total: number
    active: number
    inactive: number
    creditsDistributed: number
    creditsConsumed: number
  }
  pipeline: {
    last7Days: Record<string, number>
    avgCreditsPerActiveUserPerDay: number
  }
  feedback: {
    counts: { positive: number; neutral: number; negative: number }
    recent: Array<{
      id: string
      user_id: string
      user_email: string
      sentiment: string
      message: string
      page_path: string
      created_at: string
    }>
  }
  apiBurn: Array<{
    name: string
    monthlyLimit: number
    estimatedUsed: number
    percentRemaining: number
    daysUntilExhaustion: number | null
    alert: boolean
  }>
  generatedAt: string
}

const OP_LABELS: Record<string, string> = {
  recon_free: "Recon Free",
  recon_pro:  "Recon Pro",
  match:      "Match",
  craft:      "Craft",
  polish:     "Polish",
  other:      "Lainnya",
}

const SENTIMENT_LABELS: Record<string, string> = {
  positive: "Positif",
  neutral:  "Netral",
  negative: "Negatif",
}

export default function AdminUsagePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/usage-stats", { cache: "no-store" })
      if (!res.ok) {
        if (res.status === 401) {
          setError("Tidak terautentikasi sebagai admin. Pastikan emailmu ada di ADMIN_EMAILS atau gunakan X-Admin-Secret header.")
        } else {
          const json = await res.json().catch(() => ({}))
          setError(json?.error ?? `HTTP ${res.status}`)
        }
        setStats(null)
        return
      }
      const data = (await res.json()) as Stats
      setStats(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3EF]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Memuat statistik...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen p-8 bg-[#F5F3EF]">
        <h1 className="text-2xl font-bold mb-4">Admin · Usage</h1>
        <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-red-900 max-w-3xl">
          <p className="font-semibold mb-2">Tidak dapat memuat data</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="min-h-screen p-8 bg-[#F5F3EF]">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Nav tabs */}
        <nav className="flex items-center gap-2 text-[13px] font-semibold">
          <Link
            href="/admin/usage"
            className="px-4 py-1.5 rounded-full bg-foreground text-[#F5F3EF] border border-foreground"
          >
            Usage Overview
          </Link>
          <Link
            href="/admin/users"
            className="px-4 py-1.5 rounded-full bg-white border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            Users
          </Link>
        </nav>

        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin · Usage</h1>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              Diperbarui: {new Date(stats.generatedAt).toLocaleString("id-ID")}
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-[13px] font-semibold bg-white hover:bg-muted/40 disabled:opacity-60"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </header>

        <Section title="User Overview">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Stat label="Total user"        value={stats.users.total} />
            <Stat label="Aktif"             value={stats.users.active} />
            <Stat label="Belum aktif"       value={stats.users.inactive} />
            <Stat label="Kredit dibagikan"  value={stats.users.creditsDistributed} />
            <Stat label="Kredit dipakai"    value={stats.users.creditsConsumed} />
          </div>
        </Section>

        <Section
          title="Pipeline (7 hari terakhir)"
          right={
            <span className="text-[12px] text-muted-foreground">
              Rata-rata{" "}
              <span className="font-semibold text-foreground">
                {stats.pipeline.avgCreditsPerActiveUserPerDay}
              </span>{" "}
              kredit / user aktif / hari
            </span>
          }
        >
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/40 text-[11.5px] uppercase tracking-wider text-muted-foreground font-semibold text-left">
                <th className="py-2">Operasi</th>
                <th className="py-2 text-right">Total Run</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.pipeline.last7Days).map(([op, count]) => (
                <tr key={op} className="border-b border-border/20 last:border-0">
                  <td className="py-2.5">{OP_LABELS[op] ?? op}</td>
                  <td className="py-2.5 text-right tabular-nums font-semibold">{count}</td>
                </tr>
              ))}
              {Object.keys(stats.pipeline.last7Days).length === 0 && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-muted-foreground">
                    Belum ada aktivitas dalam 7 hari terakhir.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-muted-foreground/70">
            Catatan: success rate per stage tidak ditampilkan — saat ini tidak ada kolom success di credit_transactions.
          </p>
        </Section>

        <Section title="Feedback Summary">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Stat label="Positif" value={stats.feedback.counts.positive} accent="text-success" />
            <Stat label="Netral"  value={stats.feedback.counts.neutral} />
            <Stat label="Negatif" value={stats.feedback.counts.negative} accent="text-danger" />
          </div>
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            10 feedback terbaru
          </h3>
          {stats.feedback.recent.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-[13px]">
              Belum ada feedback masuk.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.feedback.recent.map((f) => (
                <div
                  key={f.id}
                  className="rounded-xl border border-border/40 p-4 bg-muted/20"
                >
                  <div className="flex items-center justify-between mb-2 text-[11.5px] text-muted-foreground">
                    <span className="font-semibold uppercase tracking-wider">
                      {SENTIMENT_LABELS[f.sentiment] ?? f.sentiment}
                    </span>
                    <span className="tabular-nums">
                      {new Date(f.created_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <p className="text-[13.5px] text-foreground whitespace-pre-wrap mb-2">
                    {f.message}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 gap-4">
                    <span className="truncate">{f.user_email || "(tanpa email)"}</span>
                    <span className="font-mono shrink-0">{f.page_path || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Pantau Kredit API Eksternal">
          <p className="text-[12px] text-muted-foreground/80 mb-4">
            Cek dashboard masing-masing provider untuk memantau pemakaian real-time.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: "Tavily Search",  url: "https://app.tavily.com",       color: "text-blue-600",    bg: "bg-blue-50"   },
              { name: "Jina AI",        url: "https://jina.ai/dashboard",    color: "text-violet-600",  bg: "bg-violet-50" },
              { name: "Serper.dev",     url: "https://serper.dev/dashboard", color: "text-emerald-600", bg: "bg-emerald-50"},
              { name: "Resend",         url: "https://resend.com/overview",  color: "text-orange-600",  bg: "bg-orange-50" },
            ].map(api => (
              <a
                key={api.name}
                href={api.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-between rounded-xl border border-border/40 px-4 py-3 ${api.bg} hover:border-border transition-colors group`}
              >
                <span className={`text-[13px] font-semibold ${api.color}`}>{api.name}</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </a>
            ))}
          </div>
        </Section>

        <Section title="Free Tier API Burn (estimasi bulan ini)">
          <p className="text-[11.5px] text-muted-foreground/80 mb-4">
            Estimasi: jumlah operasi pipeline pada bulan berjalan dikalikan rata-rata pemakaian per operasi. Bukan angka pasti — verifikasi via dashboard provider masing-masing.
          </p>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/40 text-[11.5px] uppercase tracking-wider text-muted-foreground font-semibold text-left">
                <th className="py-2">API</th>
                <th className="py-2 text-right">Limit / bulan</th>
                <th className="py-2 text-right">Estimasi terpakai</th>
                <th className="py-2 text-right">Sisa</th>
                <th className="py-2 text-right">Habis dalam (hari)</th>
              </tr>
            </thead>
            <tbody>
              {stats.apiBurn.map((api) => (
                <tr
                  key={api.name}
                  className={`border-b border-border/20 last:border-0 ${api.alert ? "bg-warning/5" : ""}`}
                >
                  <td className="py-2.5 font-semibold flex items-center gap-2">
                    {api.name}
                    {api.alert && <AlertTriangle className="w-3.5 h-3.5 text-warning" />}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {api.monthlyLimit.toLocaleString("id-ID")}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {api.estimatedUsed.toLocaleString("id-ID")}
                  </td>
                  <td
                    className={`py-2.5 text-right tabular-nums font-semibold ${
                      api.alert ? "text-warning" : ""
                    }`}
                  >
                    {api.percentRemaining}%
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {api.daysUntilExhaustion === null ? "—" : api.daysUntilExhaustion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl bg-white border border-border/60 p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

function Stat({
  label,
  value,
  accent = "text-foreground",
}: {
  label: string
  value: number
  accent?: string
}) {
  return (
    <div className="rounded-xl bg-muted/30 p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </p>
      <p className={`text-2xl font-black tabular-nums mt-1 ${accent}`}>
        {value.toLocaleString("id-ID")}
      </p>
    </div>
  )
}
