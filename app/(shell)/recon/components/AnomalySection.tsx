"use client"

import { Anomaly } from "@/types/recon.types"
import { AlertTriangle } from "lucide-react"

interface Props {
  anomalies?: Anomaly[]
}

export function AnomalySection({ anomalies }: Props) {
  if (!anomalies?.length) return null

  return (
    <div className="bg-amber-50/50 border border-amber-200/70 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 bg-amber-100 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600"  strokeWidth={1.5} />
        </div>
        <h3 className="font-bold text-[15px] text-foreground">
          Anomali Terdeteksi
        </h3>
        <span className="text-[12px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/50">
          {anomalies.length}
        </span>
      </div>

      <div className="space-y-3">
        {anomalies.map((a, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-amber-200/60 bg-white p-4 shadow-sm"
          >
            <p className="font-bold text-[13.5px] text-amber-800 mb-1.5">
              {a.title}
            </p>
            <p className="text-[13px] text-foreground/80 leading-snug mb-2">
              {a.observation}
            </p>
            <p className="text-[12.5px] text-muted-foreground italic leading-snug">
              {a.implication}
            </p>
            {a.evidenceUrl && (
              <a
                href={a.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-[11.5px] text-blue-600 hover:underline"
              >
                Lihat evidence →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
