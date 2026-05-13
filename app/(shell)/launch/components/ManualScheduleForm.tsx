"use client"

import { useState, useEffect } from "react"
import { Mail, CheckCircle2, AlertCircle, CalendarDays, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ScheduleItem } from "../page"
import { useLanguage } from "@/lib/i18n/LanguageContext"

interface ManualScheduleFormProps {
  defaultSchedule: ScheduleItem[]
  isActive: boolean
  isActivating?: boolean
  onActivate: (finalSchedule: ScheduleItem[]) => Promise<void>
}

function toDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null
  return new Date(`${date}T${time}:00`)
}

export function ManualScheduleForm({ defaultSchedule, isActive, isActivating, onActivate }: ManualScheduleFormProps) {
  const { t } = useLanguage()
  const [rows, setRows] = useState<ScheduleItem[]>(
    defaultSchedule.map(s => ({ ...s }))
  )
  const [minDate, setMinDate] = useState("")

  useEffect(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    setMinDate(`${y}-${m}-${d}`)
  }, [])

  const updateRow = (index: number, field: "date" | "time", value: string) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  // Returns an error message for a row, or null if valid
  const getRowError = (index: number): string | null => {
    if (index === 0) return null
    const curr = toDateTime(rows[index].date, rows[index].time)
    const prev = toDateTime(rows[index - 1].date, rows[index - 1].time)
    if (!curr || !prev) return null
    if (curr <= prev) {
      return t("Email {n} must be scheduled after Email {prev}", { n: index + 1, prev: index })
    }
    return null
  }

  const errors = rows.map((_, i) => getRowError(i))
  const hasErrors = errors.some(e => e !== null)
  const allFilled = rows.every(r => r.date && r.time)

  const getDynamicLabel = (currentIndex: number) => {
    if (currentIndex === 0) return t("Day 1")
    const curr = toDateTime(rows[currentIndex].date, rows[currentIndex].time)
    const first = toDateTime(rows[0].date, rows[0].time)
    if (!curr || !first) return t("Waiting for date")

    const currDay = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate())
    const firstDay = new Date(first.getFullYear(), first.getMonth(), first.getDate())
    const diffDays = Math.round((currDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays <= 0) {
      if (currentIndex > 0 && curr > first) return t("Same day")
      return t("Same day")
    }
    return t("Day {n}", { n: diffDays + 1 })
  }

  const handleSave = async () => {
    if (hasErrors || !allFilled) {
      toast.error(t("Please check the schedule — there are time conflicts or empty fields."))
      return
    }
    // Recompute dayLabel + scheduledDay from actual dates before saving
    const firstDate = new Date(rows[0].date + "T00:00:00")
    const finalRows = rows.map((r, i) => {
      if (i === 0) return { ...r, dayLabel: t("Day 1"), scheduledDay: 1 }
      const currDate = new Date(r.date + "T00:00:00")
      const diffDays = Math.round((currDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
      const day = diffDays + 1
      return { ...r, dayLabel: t("Day {n}", { n: day }), scheduledDay: day }
    })
    await onActivate(finalRows)
  }

  return (
    <div className="space-y-6">
      {/* Form rows */}
      <div className="space-y-4">
        <h3 className="font-bold text-[13px] text-muted-foreground uppercase tracking-wider">
          {t("Set Manual Schedule")}
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
                <Mail className="w-4 h-4"  strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-bold text-[14px] text-foreground">
                  Email {row.emailNumber}
                  <span className="ml-2 text-[12px] font-medium text-muted-foreground bg-slate-100 px-2 py-1 rounded-md">({getDynamicLabel(index)})</span>
                </p>
              </div>
              {isActive && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3"  strokeWidth={1.5} />
                  {t("Scheduled")}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Date Picker */}
              <div className="space-y-1.5">
                <label
                  htmlFor={`schedule-date-${row.emailNumber}`}
                  className="text-[12px] font-semibold text-muted-foreground block"
                >
                  {t("Send Date")}
                </label>
                <input
                  id={`schedule-date-${row.emailNumber}`}
                  name={`schedule-date-${row.emailNumber}`}
                  type="date"
                  min={minDate}
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
                <label
                  htmlFor={`schedule-time-${row.emailNumber}`}
                  className="text-[12px] font-semibold text-muted-foreground block"
                >
                  {t("Send Time")}
                </label>
                <input
                  id={`schedule-time-${row.emailNumber}`}
                  name={`schedule-time-${row.emailNumber}`}
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
                <AlertCircle className="w-3.5 h-3.5 shrink-0"  strokeWidth={1.5} />
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
          {isActivating ? <Loader2 className="w-4 h-4 mr-2 animate-spin"  strokeWidth={1.5} /> : <CalendarDays className="w-4 h-4 mr-2"  strokeWidth={1.5} />}
          {isActivating ? t("Activating...") : t("Save Schedule & Activate")}
        </Button>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5"  strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-bold text-[14.5px] text-emerald-800">{t("Schedule saved & active!")}</p>
            <p className="text-[12.5px] text-emerald-700 mt-0.5">
              {t("Campaign will be sent according to your schedule.")}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
