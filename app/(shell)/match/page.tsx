"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MatchingTab } from "./components/MatchingTab"
import { ProductCatalogTab } from "./components/ProductCatalogTab"
import { session } from "@/lib/session"
import { PageHelp } from "@/components/ui/PageHelp"
import { SessionExpiredState } from "@/components/shared/SessionExpiredState"
import { useLanguage } from "@/lib/i18n/LanguageContext"

export default function MatchPage() {
  const router = useRouter()

  const [companyName, setCompanyName] = useState<string>("")
  const [companyId, setCompanyId] = useState<string>("")
  const [sessionChecked, setSessionChecked] = useState(false)
  const [hasSessionData, setHasSessionData] = useState(true)
  const { t } = useLanguage()

  useEffect(() => {
    const profile = session.getReconProfile()
    const id = session.getCompanyId()
    
    if (!profile || !id) {
      setHasSessionData(false)
    } else {
      if (profile.name) setCompanyName(profile.name)
      setCompanyId(id)
    }
    setSessionChecked(true)
  }, [])

  if (!sessionChecked) return null
  if (!hasSessionData) return <SessionExpiredState currentStage="match" />

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Pipeline breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground font-medium">
        <span
          className="hover:text-foreground cursor-pointer transition-colors"
          onClick={() => router.push("/research-library")}
        >
          Research Library
        </span>
        <ChevronRight className="w-3.5 h-3.5"  strokeWidth={1.5} />
        <span
          className="hover:text-foreground cursor-pointer transition-colors"
          onClick={() => companyId && router.push(`/recon/${companyId}`)}
        >
          Review Profil
        </span>
        <ChevronRight className="w-3.5 h-3.5"  strokeWidth={1.5} />
        <span className="text-foreground font-semibold">Match</span>
        <ChevronRight className="w-3.5 h-3.5"  strokeWidth={1.5} />
        <span>Craft</span>
        <ChevronRight className="w-3.5 h-3.5"  strokeWidth={1.5} />
        <span>Polish</span>
        <ChevronRight className="w-3.5 h-3.5"  strokeWidth={1.5} />
        <span>Launch</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between border-b pb-6 border-border/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11.5px] font-bold uppercase tracking-wider text-brand bg-brand-light px-2.5 py-1 rounded-full">
              {t("Step {step} of {total}", { step: 2, total: 6 })}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-2">Product Matching</h1>
          <p className="text-muted-foreground mt-1 text-[14.5px] font-medium">
            {companyName
              ? t("Match the best product to the pain points of {name}.", { name: companyName })
              : t("Match the best product to the pain points of {name}.", { name: "" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PageHelp
            title="Match — Pencocokan Produk"
            content={{
              what: "Campfire mencocokkan pain point perusahaan target dengan produk yang paling relevan dari katalog kamu.",
              tips: "Pilih produk dengan match score tertinggi. Perhatikan juga sinyal urgensi jika ada regulasi atau pergerakan kompetitor terbaru.",
              next: "Setelah memilih produk, lanjut ke Craft untuk membuat email campaign."
            }}
          />
          <Button
            variant="outline"
            onClick={() => companyId ? router.push(`/recon/${companyId}`) : router.push("/research-library")}
            className="shadow-sm font-semibold text-[13.5px] rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-2"  strokeWidth={1.5} />
            Review Profil
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="matching" className="w-full flex flex-col">
        <TabsList className="w-full justify-start bg-transparent p-0 h-auto gap-8 border-b border-border/60 rounded-none mb-8">
          <TabsTrigger
            value="matching"
            className="rounded-none border-b-[3px] border-transparent px-4 pb-3 pt-2 text-[15.5px] font-bold text-muted-foreground hover:text-foreground data-[state=active]:border-brand data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-all"
          >
            {t("Matching Analysis")}
          </TabsTrigger>
          <TabsTrigger
            value="catalog"
            className="rounded-none border-b-[3px] border-transparent px-4 pb-3 pt-2 text-[15.5px] font-bold text-muted-foreground hover:text-foreground data-[state=active]:border-brand data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-all"
          >
            {t("Product Catalog")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matching" className="mt-0 outline-none border-none w-full">
          <MatchingTab />
        </TabsContent>

        <TabsContent value="catalog" className="mt-0 outline-none border-none w-full">
          <ProductCatalogTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
