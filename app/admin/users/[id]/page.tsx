"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Loader2, ArrowLeft, CheckCircle2, Circle } from "lucide-react"

type Detail = {
  user: {
    id: string
    email: string
    created_at: string
    last_sign_in_at: string | null
    workspace_name: string | null
    sender_name: string | null
    sender_title: string | null
    balance: number
    total_spent: number
    total_earned: number
  }
  transactions: Array<{
    id: string
    type: "purchase" | "debit" | "refund" | "grant"
    amount: number
    description: string
    created_at: string
  }>
  companies: Array<{
    id: string
    name: string
    url: string
    industry: string
    created_at: string
    progress_recon: boolean
    progress_match: boolean
    progress_craft: boolean
    progress_polish: boolean
    progress_launch: boolean
    progress_pulse: boolean
  }>
  feedback: Array<{
    id: string
    sentiment: "positive" | "neutral" | "negative"
    message: string
    page_path: string
    created_at: string
  }>
}

const TX_LABEL: Record<Detail["transactions"][number]["type"], string> = {
  purchase: "Pembelian",
  grant:    "Hadiah",
  refund:   "Refund",
  debit:    "Pakai Kredit",
}

const TX_ACCENT: Record<Detail["transactions"][number]["type"], string> = {
  purchase: "text-success",
  grant:    "text-success",
  refund:   "text-success",
  debit:    "text-foreground",
}

const SENTIMENT_LABEL: Record<Detail["feedback"][number]["sentiment"], string> = {
  positive: "Positif",
  neutral:  "Netral",
  negative: "Negatif",
}

const STAGES = [
  { key: "progress_recon",  label: "Recon"  },
  { key: "progress_match",  label: "Match"  },
  { key: "progress_craft",  label: "Craft"  },
  { key: "progress_polish", label: "Polish" },
  { key: "progress_launch", label: "Launch" },
  { key: "progress_pulse",  label: "Pulse"  },
] as const

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>()
  const userId = params.id

  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          setError(json?.error ?? `HTTP ${res.status}`)
          setDetail(null)
          return
        }
        setDetail(await res.json())
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F3EF]">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Memuat detail user...
      </div>
    </div>
  )

  if (error || !detail) return (
    <div className="min-h-screen p-8 bg-[#F5F3EF]">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke daftar user
        </Link>
        <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-red-900">
          <p className="font-semibold mb-2">Tidak dapat memuat data</p>
          <p className="text-sm">{error ?? "User tidak ditemukan."}</p>
        </div>
      </div>
    </div>
  )

  const { user, transactions, companies, feedback } = detail

  return (
    <div className="min-h-screen p-8 bg-[#F5F3EF]">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Nav back */}
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke daftar user
        </Link>

        {/* Header */}
        <header>
          <h1 className="text-2xl font-bold tracking-tight">{user.email || "(no email)"}</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1">
            Daftar {formatDate(user.created_at)}
            {user.last_sign_in_at && ` · Login terakhir ${formatDate(user.last_sign_in_at)}`}
          </p>
        </header>

        {/* Profile + Stats */}
        <Section title="Profil & Kredit">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Stat label="Saldo Sekarang" value={user.balance.toLocaleString("id-ID")} />
            <Stat label="Total Dipakai"  value={user.total_spent.toLocaleString("id-ID")} />
            <Stat label="Total Diterima" value={user.total_earned.toLocaleString("id-ID")} />
            <Stat label="Recon Targets"  value={companies.length.toLocaleString("id-ID")} />
          </div>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12.5px]">
            <ProfileField label="Workspace"   value={user.workspace_name} />
            <ProfileField label="Sender Name" value={user.sender_name} />
            <ProfileField label="Job Title"   value={user.sender_title} />
          </dl>
        </Section>

        {/* Companies / Recon Targets */}
        <Section title={`Recon Targets (${companies.length})`}>
          {companies.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-[13px]">
              User ini belum membuat target Recon.
            </p>
          ) : (
            <div className="space-y-3">
              {companies.map((c) => (
                <div key={c.id} className="rounded-xl border border-border/40 p-4 bg-muted/20">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[14px] truncate">{c.name}</p>
                      <p className="text-[11.5px] text-muted-foreground truncate">
                        {c.industry || "—"} · {c.url}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground/70 shrink-0">
                      {formatDate(c.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {STAGES.map((s) => {
                      const done = (c as any)[s.key] as boolean
                      return (
                        <span
                          key={s.key}
                          className={`inline-flex items-center gap-1 text-[11px] ${
                            done ? "text-success" : "text-muted-foreground/60"
                          }`}
                        >
                          {done
                            ? <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
                            : <Circle className="w-3 h-3" strokeWidth={1.5} />
                          }
                          {s.label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Activity Timeline */}
        <Section title={`Aktivitas Terbaru (${transactions.length})`}>
          {transactions.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-[13px]">
              Belum ada transaksi kredit.
            </p>
          ) : (
            <div className="divide-y divide-border/30">
              {transactions.map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${TX_ACCENT[tx.type]}`}>
                        {TX_LABEL[tx.type]}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {formatDate(tx.created_at)}
                      </span>
                    </div>
                    <p className="text-[13px] text-foreground mt-0.5 truncate">
                      {tx.description || "—"}
                    </p>
                  </div>
                  <span className={`tabular-nums font-semibold text-[14px] shrink-0 ${
                    tx.type === "debit" ? "text-foreground" : "text-success"
                  }`}>
                    {tx.type === "debit" ? "−" : "+"}
                    {Math.abs(tx.amount).toLocaleString("id-ID")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Feedback */}
        <Section title={`Feedback (${feedback.length})`}>
          {feedback.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-[13px]">
              User ini belum mengirim feedback.
            </p>
          ) : (
            <div className="space-y-3">
              {feedback.map((f) => (
                <div key={f.id} className="rounded-xl border border-border/40 p-4 bg-muted/20">
                  <div className="flex items-center justify-between mb-2 text-[11.5px] text-muted-foreground">
                    <span className="font-semibold uppercase tracking-wider">
                      {SENTIMENT_LABEL[f.sentiment]}
                    </span>
                    <span className="tabular-nums">{formatDate(f.created_at)}</span>
                  </div>
                  <p className="text-[13.5px] text-foreground whitespace-pre-wrap mb-1">
                    {f.message}
                  </p>
                  {f.page_path && (
                    <p className="text-[11px] text-muted-foreground/70 font-mono">{f.page_path}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white border border-border/60 p-6">
      <h2 className="text-lg font-bold tracking-tight mb-4">{title}</h2>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/30 p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="text-2xl font-black tabular-nums mt-1">{value}</p>
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</dt>
      <dd className="text-foreground mt-0.5">{value?.trim() || "—"}</dd>
    </div>
  )
}
