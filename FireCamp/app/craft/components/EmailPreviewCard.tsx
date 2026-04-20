import { CampaignEmail } from "@/types/craft.types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Tag } from "lucide-react"

export function EmailPreviewCard({ email }: { email: CampaignEmail }) {
  return (
    <Card className="border-border/80 shadow-sm relative pt-4 overflow-hidden rounded-[14px]">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-brand"></div>
      <CardHeader className="py-4 px-6 border-b border-border/40 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-[17px]">Email {email.sequenceNumber}</h3>
            <Badge variant="outline" className="bg-white text-[12px] font-semibold border-border/80 capitalize">
              Tone: {email.tone}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-bold bg-white border border-border/60 text-foreground/80 px-3 py-1.5 rounded-full shadow-sm">
            <Calendar className="w-4 h-4 text-brand"  strokeWidth={1.5} />
            {email.dayLabel}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="mb-5">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Tag className="w-3 h-3"  strokeWidth={1.5} /> Subject Line
          </div>
          <p className="font-bold text-[17px] tracking-tight">{email.subject}</p>
        </div>
        <div className="border border-border/60 shadow-sm rounded-xl p-5 bg-white whitespace-pre-wrap text-[14.5px] leading-relaxed text-foreground/90 font-medium">
          {email.body}
        </div>
      </CardContent>
    </Card>
  )
}
