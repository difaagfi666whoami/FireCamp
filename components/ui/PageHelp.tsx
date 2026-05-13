"use client"

import { HelpCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useLanguage } from "@/lib/i18n/LanguageContext"

interface PageHelpContent {
  what: string
  tips: string
  next: string
}

interface PageHelpProps {
  title: string
  content: PageHelpContent
}

export function PageHelp({ title, content }: PageHelpProps) {
  const { t } = useLanguage()

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button className="flex items-center justify-center w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
        }
      >
        <HelpCircle size={16} />
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-semibold text-foreground mb-1">{t("What is this?")}</p>
            <p className="text-muted-foreground leading-relaxed">{content.what}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">{t("Tips")}</p>
            <p className="text-muted-foreground leading-relaxed">{content.tips}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">{t("Next step")}</p>
            <p className="text-muted-foreground leading-relaxed">{content.next}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
