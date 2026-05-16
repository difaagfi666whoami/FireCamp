"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCcw, ChevronRight } from "lucide-react"

type Row = {
  id: string
  email: string
  created_at: string
  balance: number
  total_spent: number
  company_count: number
  last_activity_at: string | null
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function relativeTime(iso: string | null) {
  if (!iso) return "Belum pernah"
  const diff = Date.now() - Date.parse(iso)
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return "Baru saja"
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} hari lalu`
  const months = Math.round(days / 30)
  return `${months} bulan lalu`
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("")

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" })
      if (!res.ok) {
        if (res.status === 401) {
          setError("Tidak terautentikasi sebagai admin. Pastikan emailmu ada di ADMIN_EMAILS.")
        } else {
          const json = await res.json().catch(() => ({}))
          setError(json?.error ?? `HTTP ${res.status}`)
        }
        setRows(null)
        return
      }
      const data = await res.json()
      setRows(data.users)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = (rows ?? []).filter((r) =>
    !filter.trim() || r.email.toLowerCase().includes(filter.trim().toLowerCase())
  )

  return (
    <div className="min-h-screen p-8 bg-[#F5F3EF]">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Nav tabs */}
        <nav className="flex items-center gap-2 text-[13px] font-semibold">
          <Link
            href="/admin/usage"
            className="px-4 py-1.5 rounded-full bg-white border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            Usage Overview
          </Link>
          <Link
            href="/admin/users"
            className="px-4 py-1.5 rounded-full bg-foreground text-[#F5F3EF] border border-foreground"
          >
            Users
          </Link>
        </nav>

        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin · Users</h1>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              {rows ? `${rows.length} user terdaftar` : "Memuat..."}
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

        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-red-900">
            <p className="font-semibold mb-2">Tidak dapat memuat data</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading && !rows && (
          <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Memuat user...</span>
          </div>
        )}

        {rows && (
          <section className="rounded-2xl bg-white border border-border/60 p-6 space-y-4">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Cari email..."
              className="w-full rounded-xl border border-border/60 px-4 py-2.5 text-[13.5px] focus:outline-none focus:border-brand/60"
            />

            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border/40 text-[11.5px] uppercase tracking-wider text-muted-foreground font-semibold text-left">
                    <th className="py-2 pr-2">Email</th>
                    <th className="py-2 px-2 text-right">Saldo</th>
                    <th className="py-2 px-2 text-right">Total Pakai</th>
                    <th className="py-2 px-2 text-right">Target</th>
                    <th className="py-2 px-2">Aktivitas Terakhir</th>
                    <th className="py-2 pl-2 text-right w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-2.5 pr-2">
                        <Link href={`/admin/users/${r.id}`} className="block hover:text-brand">
                          <div className="font-medium truncate max-w-xs">{r.email || "(no email)"}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Daftar {formatDate(r.created_at)}
                          </div>
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums font-semibold">
                        {r.balance.toLocaleString("id-ID")}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">
                        {r.total_spent.toLocaleString("id-ID")}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        {r.company_count}
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground text-[12px]">
                        {relativeTime(r.last_activity_at)}
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <Link href={`/admin/users/${r.id}`} aria-label="Lihat detail">
                          <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        {filter ? "Tidak ada user cocok dengan pencarian." : "Belum ada user."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-muted-foreground/70">
              Saldo = kredit tersedia · Total Pakai = jumlah kredit yang sudah di-debit · Target = jumlah Recon profile yang dibuat.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
