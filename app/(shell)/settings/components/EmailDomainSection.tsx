"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Loader2, Copy, CheckCircle2, Clock, AlertCircle, Trash2, RefreshCw } from "lucide-react"
import {
  getEmailSettings,
  addDomain,
  verifyDomain,
  removeDomain,
  type UserEmailSettings,
  type DnsRecord,
} from "@/lib/api/emailSettings"
import { useLanguage } from "@/lib/i18n/LanguageContext"

// ─── Copy to clipboard button ─────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-muted transition-colors"
      title={t("Salin")}
      type="button"
    >
      {copied
        ? <CheckCircle2 className="w-3.5 h-3.5 text-success" strokeWidth={1.5} />
        : <Copy className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
      }
    </button>
  )
}

// ─── Domain status badge ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: UserEmailSettings["domainStatus"] }) {
  const { t } = useLanguage()
  if (status === "verified") return (
    <Badge className="bg-success/10 text-success border-success/20 text-xs font-medium">
      <CheckCircle2 className="w-3 h-3 mr-1" /> {t("Domain Aktif")}
    </Badge>
  )
  if (status === "pending") return (
    <Badge className="bg-warning/10 text-warning border-warning/20 text-xs font-medium">
      <Clock className="w-3 h-3 mr-1" /> {t("Menunggu Verifikasi")}
    </Badge>
  )
  if (status === "failed") return (
    <Badge className="bg-danger/10 text-danger border-danger/20 text-xs font-medium">
      <AlertCircle className="w-3 h-3 mr-1" /> {t("Verifikasi Gagal")}
    </Badge>
  )
  return (
    <Badge variant="secondary" className="text-xs font-medium">
      {t("Belum Dikonfigurasi")}
    </Badge>
  )
}

// ─── DNS records table ────────────────────────────────────────────────────────

function DnsRecordsTable({ records }: { records: DnsRecord[] }) {
  const { t } = useLanguage()
  return (
    <div className="rounded-xl border border-border/40 overflow-hidden mt-4">
      <div className="bg-muted/40 px-4 py-2.5 border-b border-border/40">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t("DNS Records — Tambahkan di domain registrar kamu")}
        </p>
      </div>
      <div className="divide-y divide-border/30">
        {records.map((record, idx) => (
          <div key={idx} className="px-4 py-3 grid grid-cols-[80px_1fr_1fr_32px] gap-3 items-start text-xs">
            <div>
              <span className="font-mono font-semibold bg-brand-light text-brand px-1.5 py-0.5 rounded text-[11px]">
                {record.type}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">{t("NAMA / HOST")}</p>
              <p className="font-mono text-foreground break-all">{record.name}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">{t("VALUE / KONTEN")}</p>
              <p className="font-mono text-foreground break-all">{record.value}</p>
            </div>
            <CopyButton text={record.value} />
          </div>
        ))}
      </div>
      <div className="bg-muted/20 px-4 py-2.5 border-t border-border/40">
        <p className="text-[11px] text-muted-foreground">
          {t("DNS propagation tip")}
        </p>
      </div>
    </div>
  )
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  trigger: React.ReactNode
  title: string
  description: React.ReactNode
  confirmLabel: string
  onConfirm: () => void
}

function ConfirmDialog({ trigger, title, description, confirmLabel, onConfirm }: ConfirmDialogProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("Batal")}</DialogClose>
          <Button
            className="bg-danger hover:bg-danger/90 text-white"
            onClick={() => { setOpen(false); onConfirm() }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EmailDomainSection() {
  const { t } = useLanguage()
  const [settings, setSettings]         = useState<UserEmailSettings | null>(null)
  const [isLoading, setIsLoading]       = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVerifying, setIsVerifying]   = useState(false)
  const [showForm, setShowForm]         = useState(false)

  const [fromName,  setFromName]  = useState("")
  const [fromEmail, setFromEmail] = useState("")

  useEffect(() => {
    getEmailSettings().then((s) => {
      setSettings(s)
      if (s?.fromName)  setFromName(s.fromName)
      if (s?.fromEmail) setFromEmail(s.fromEmail)
      setIsLoading(false)
    })
  }, [])

  const domain = fromEmail.includes("@") ? fromEmail.split("@")[1] : ""

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromName.trim() || !fromEmail.trim()) return

    setIsSubmitting(true)
    const result = await addDomain({ fromName: fromName.trim(), fromEmail: fromEmail.trim() })
    setIsSubmitting(false)

    if (!result.success) {
      toast.error(result.error ?? t("Gagal mendaftarkan domain"))
      return
    }

    const updated = await getEmailSettings()
    setSettings(updated)
    setShowForm(false)
    toast.success(t("Domain berhasil didaftarkan!"))
  }

  const handleVerify = async () => {
    setIsVerifying(true)
    const result = await verifyDomain()
    setIsVerifying(false)

    if (!result.success) {
      toast.error(result.error ?? t("Verifikasi gagal"))
      return
    }

    const updated = await getEmailSettings()
    setSettings(updated)

    if (result.status === "verified") {
      toast.success(t("Domain berhasil diverifikasi!"))
    } else if (result.status === "failed") {
      toast.error(t("Verifikasi gagal. Pastikan DNS records sudah benar."))
    } else {
      toast.info(t("DNS records belum terverifikasi."))
    }
  }

  const handleRemove = async () => {
    const result = await removeDomain()
    if (!result.success) {
      toast.error(result.error ?? t("Gagal menghapus domain"))
      return
    }
    setSettings(null)
    setFromName("")
    setFromEmail("")
    toast.success(t("Domain berhasil dihapus."))
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="flex items-center gap-2 py-8 text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
      <span className="text-sm">{t("Memuat konfigurasi email...")}</span>
    </div>
  )

  const hasDomain  = !!settings?.resendDomainId
  const isVerified = settings?.domainStatus === "verified"
  const isPending  = settings?.domainStatus === "pending"

  return (
    <div className="space-y-5">

      {/* Current status */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">{t("Status Domain Pengirim")}</p>
          <p className="text-xs text-muted-foreground">
            {isVerified
              ? t("Email sent from: {email}", { email: settings!.fromEmail })
              : t("Email dikirim dari domain default Campfire (campfire.web.id)")
            }
          </p>
        </div>
        <StatusBadge status={settings?.domainStatus ?? "unverified"} />
      </div>

      {/* Verified state */}
      {isVerified && (
        <div className="rounded-xl bg-success/5 border border-success/20 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-success mt-0.5 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-semibold text-success">{t("Domain Aktif")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("All future campaigns will be sent as")}{" "}
                <span className="font-mono font-medium">{settings!.fromName} &lt;{settings!.fromEmail}&gt;</span>
              </p>
            </div>
          </div>
          <ConfirmDialog
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="text-danger border-danger/30 hover:bg-danger/5 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
                {t("Hapus Domain")}
              </Button>
            }
            title={t("Hapus konfigurasi domain?")}
            description={t("Domain will be removed warning", { domain: settings?.fromEmail?.split("@")[1] ?? "" })}
            confirmLabel={t("Ya, Hapus Domain")}
            onConfirm={handleRemove}
          />
        </div>
      )}

      {/* Pending state — show DNS records */}
      {isPending && settings?.dnsRecords && (
        <div className="rounded-xl bg-warning/5 border border-warning/20 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-warning mt-0.5 shrink-0" strokeWidth={1.5} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-warning">{t("Menunggu Verifikasi DNS")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("Add records to DNS manager", { domain: settings.fromEmail?.split("@")[1] ?? "" })}
              </p>
            </div>
          </div>
          <DnsRecordsTable records={settings.dnsRecords} />
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleVerify}
              disabled={isVerifying}
              size="sm"
              className="bg-brand hover:bg-brand/90 text-white text-xs"
            >
              {isVerifying
                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" strokeWidth={1.5} />{t("Mengecek...")}</>
                : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />{t("Cek Verifikasi")}</>
              }
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" className="text-danger text-xs">
                  <Trash2 className="w-3.5 h-3.5 mr-1" strokeWidth={1.5} />
                  {t("Batalkan")}
                </Button>
              }
              title={t("Batalkan pendaftaran domain?")}
              description={t("Konfigurasi domain akan dihapus. Kamu bisa mendaftarkan domain baru kapan saja.")}
              confirmLabel={t("Ya, Batalkan")}
              onConfirm={handleRemove}
            />
          </div>
        </div>
      )}

      {/* No domain yet OR add form */}
      {!hasDomain && (
        <>
          {!showForm ? (
            <Button
              onClick={() => setShowForm(true)}
              variant="outline"
              size="sm"
              className="text-xs border-brand/30 text-brand hover:bg-brand-light"
            >
              {t("Tambah Domain Sendiri")}
            </Button>
          ) : (
            <form onSubmit={handleAddDomain} className="space-y-4 rounded-xl border border-border/40 p-4">
              <p className="text-sm font-semibold">{t("Daftarkan Domain Pengirim")}</p>

              <div className="space-y-2">
                <Label htmlFor="fromName" className="text-xs font-semibold">
                  {t("Nama Pengirim")} <span className="text-danger">*</span>
                </Label>
                <Input
                  id="fromName"
                  placeholder={t("Contoh: Budi Santoso")}
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="rounded-xl border-border/60 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fromEmail" className="text-xs font-semibold">
                  {t("Alamat Email Pengirim")} <span className="text-danger">*</span>
                </Label>
                <Input
                  id="fromEmail"
                  type="email"
                  placeholder={t("Contoh: budi@pt-maju-jaya.co.id")}
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="rounded-xl border-border/60 text-sm"
                />
                {domain && (
                  <p className="text-[11px] text-muted-foreground">
                    {t("Domain yang akan didaftarkan:")} <span className="font-mono font-medium">{domain}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isSubmitting || !fromName.trim() || !fromEmail.trim()}
                  size="sm"
                  className="bg-brand hover:bg-brand/90 text-white text-xs"
                >
                  {isSubmitting
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" strokeWidth={1.5} />{t("Mendaftarkan...")}</>
                    : t("Daftarkan Domain")
                  }
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowForm(false)}
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  {t("Batal")}
                </Button>
              </div>
            </form>
          )}

          <div className="rounded-xl bg-muted/30 border border-border/30 p-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">{t("Without your own domain")}</strong>{" "}
              {t("— emails are sent from")}{" "}
              <span className="font-mono">noreply@campfire.web.id</span>.{" "}
              {t("Adding your own domain improves email credibility and deliverability to prospect inboxes.")}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
