"use client"

import { useState } from "react"
import Link from "next/link"
import { Building2, MapPin, Calendar, AlertTriangle, Trash2, Eye, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CampaignProgress } from "./CampaignProgress"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface ProfileCardProps {
  company: any
  onDelete: (id: string) => void
}

export function ProfileCard({ company, onDelete }: ProfileCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="bg-white border border-border/60 rounded-xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-border">
      {/* Card Body */}
      <div className="p-5">
        {/* Top row: company info + delete */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border/60">
              <Building2 className="w-5 h-5 text-muted-foreground"  strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[15px] text-foreground leading-tight truncate">{company.name}</h3>
              <p className="text-[12.5px] text-muted-foreground mt-0.5 truncate">{company.industry}</p>
            </div>
          </div>

          {/* Delete button */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
              title="Hapus profil"
            >
              <Trash2 className="w-4 h-4"  strokeWidth={1.5} />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
              <span className="text-[11.5px] font-bold text-red-700 mr-1">Hapus?</span>
              <button
                onClick={() => onDelete(company.id)}
                className="p-1 rounded text-red-600 hover:bg-red-100 transition-colors"
                title="Ya, hapus"
              >
                <Check className="w-3.5 h-3.5"  strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors"
                title="Batal"
              >
                <X className="w-3.5 h-3.5"  strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 mb-4 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3"  strokeWidth={1.5} />
            {company.hq}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3"  strokeWidth={1.5} />
            {formatDate(company.savedAt)}
          </span>
          <span className="flex items-center gap-1 font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3"  strokeWidth={1.5} />
            {company.painPointsCount} pain points
          </span>
        </div>

        {/* Dev UUID badge */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-3">
            <p
              className="text-[10px] font-mono text-muted-foreground/50 truncate cursor-help select-all"
              title={company.id}
            >
              ID: {company.id}
            </p>
          </div>
        )}

        {/* Progress */}
        <div className="bg-slate-50 border border-border/50 rounded-lg px-3 py-2.5">
          <CampaignProgress progress={company.progress} />
        </div>
      </div>

      {/* Divider + Actions */}
      <div className="border-t border-border/50 px-5 py-3 bg-slate-50/50">
        <Link href={`/recon/${company.id}`}>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full font-semibold text-[12.5px] h-9 rounded-xl",
              "border-2 border-black text-black bg-white",
              "hover:bg-red-50 hover:border-red-400 hover:text-red-700",
              "transition-all duration-150"
            )}
          >
            <Eye className="w-3.5 h-3.5 mr-1.5"  strokeWidth={1.5} />
            Preview
          </Button>
        </Link>
      </div>
    </div>
  )
}
