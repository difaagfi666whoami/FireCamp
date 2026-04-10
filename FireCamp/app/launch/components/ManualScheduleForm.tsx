"use client"

import { useState } from "react"
import { Mail, CheckCircle2, AlertCircle, CalendarDays, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ScheduleItem } from "../page"

interface ManualScheduleFormProps {
  defaultSchedule: ScheduleItem[]
  isActive: boolean
  isActivating?: boolean
  onActivate: () => void
  onScheduleChange?: (schedule: ScheduleItem[]) => void
}

function toDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null
  return new Date(`${date}T${time}:00`)
}

export function ManualScheduleForm({ defaultSchedule, isActive, isActivating, onActivate, onScheduleChange }: ManualScheduleFormProps) {
  const [rows, setRows] = useState<ScheduleItem[]>(
    defaultSchedule.map(s => ({ ...s }))
  )

  const updateRow = (index: number, field: "date" | "time", value: string) => {
    setRows(prev => {
      const next = prev.map((r, i) => i === index ? { ...r, [field]: value } : r)
      onScheduleChange?.(next)
      return next
    })
  }

  // Returns an error message for a row, or null if valid
  const getRowError = (index: number): string | null => {
    if (index === 0) return null
    const curr = toDateTime(rows[index].date, rows[index].time)
    const prev = toDateTime(rows[index - 1].date, rows[index - 1].time)
    if (!curr || !prev) return null
    if (curr <= prev) {
      return `Email ${index + 1} harus dijadwalkan setelah Email ${index}`
    }
    return null
  }

  const errors = rows.map((_, i) => getRowError(i))
  const hasErrors = errors.some(e => e !== null)
  const allFilled = rows.every(r => r.date && r.time)

  const handleSave = () => {
    if (hasErrors || !allFilled) {
      toast.error("Periksa kembali jadwal — ada konflik waktu atau field yang kosong.")
      return
    }
    onActivate()
    toast.success("Jadwal berhasil disimpan dan campaign diaktifkan!")
  }

  return (
    <div className="space-y-6">
      {/* Form rows */}
      <div className="space-y-4">
        <h3 className="font-bold text-[13px] text-muted-foreground uppercase tracking-wider">
          Atur Jadwal Manual
        </h3>

        {rows.map((row, index) => (
          <div
            key={row.emailNumber}
            className={cn(
              "rounded-xl border bg-white p-5 transition-all duration-200",
              errors[index] ? "border-red-300 bg-red-50/30" : "border-border/60"
            )}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                isActive ? "bg-emerald-50 text-emerald-600" : "bg-muted text-muted-foreground"
              )}>
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-[14px] text-foreground">
                  Email {row.emailNumber}
                  <span className="ml-2 text-[12px] font-medium text-muted-foreground">({row.dayLabel})</span>
                </p>
              </div>
              {isActive && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  Terjadwal
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Date Picker */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-muted-foreground block">
                  Tanggal Kirim
                </label>
                <input
                  type="date"
                  value={row.date}
                  onChange={e => updateRow(index, "date", e.target.value)}
                  disabled={isActive}
                  className={cn(
                    "w-full h-10 px-3 rounded-lg border text-[13.5px] font-medium bg-white text-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors",
                    "disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed",
                    errors[index] ? "border-red-300" : "border-border/70"
                  )}
                />
              </div>

              {/* Time Picker */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-muted-foreground block">
                  Jam Kirim
                </label>
                <input
                  type="time"
                  value={row.time}
                  onChange={e => updateRow(index, "time", e.target.value)}
                  disabled={isActive}
                  className={cn(
                    "w-full h-10 px-3 rounded-lg border text-[13.5px] font-medium bg-white text-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors",
                    "disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed",
                    errors[index] ? "border-red-300" : "border-border/70"
                  )}
                />
              </div>
            </div>

            {/* Inline error */}
            {errors[index] && (
              <div className="flex items-center gap-2 mt-3 text-[12px] font-medium text-red-600">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors[index]}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Save Button / Active State */}
      {!isActive ? (
        <Button
          onClick={handleSave}
          disabled={hasErrors || !allFilled || isActivating}
          className="w-full bg-brand hover:bg-brand/90 text-white font-bold h-12 rounded-xl text-[15px] shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isActivating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarDays className="w-4 h-4 mr-2" />}
          {isActivating ? "Mengaktifkan..." : "Simpan Jadwal & Aktifkan"}
        </Button>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-[14.5px] text-emerald-800">Jadwal tersimpan & aktif!</p>
            <p className="text-[12.5px] text-emerald-700 mt-0.5">
              Campaign akan dikirim sesuai jadwal yang kamu tentukan.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
