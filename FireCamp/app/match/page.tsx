"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MatchingTab } from "./components/MatchingTab"
import { ProductCatalogTab } from "./components/ProductCatalogTab"
import { session } from "@/lib/session"

export default function MatchPage() {
  const router = useRouter()

  const [companyName, setCompanyName] = useState<string>("")

  useEffect(() => {
    const profile = session.getReconProfile()
    if (profile?.name) setCompanyName(profile.name)
  }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between border-b pb-6 border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Matching</h1>
          <p className="text-muted-foreground mt-1.5 text-[14.5px] font-medium">
            Cocokkan produk terbaik dengan pain points{" "}
            {companyName && (
              <span className="font-bold text-foreground">{companyName}</span>
            )}
            .
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/recon")}
          className="shadow-sm font-semibold text-[13.5px]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali ke Recon
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="matching" className="w-full flex flex-col">
        <TabsList className="w-full justify-start bg-transparent p-0 h-auto gap-8 border-b border-border/60 rounded-none mb-8">
          <TabsTrigger
            value="matching"
            className="rounded-none border-b-[3px] border-transparent px-4 pb-3 pt-2 text-[15.5px] font-bold text-muted-foreground hover:text-foreground data-[state=active]:border-brand data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-all"
          >
            Analisis Pencocokan
          </TabsTrigger>
          <TabsTrigger
            value="catalog"
            className="rounded-none border-b-[3px] border-transparent px-4 pb-3 pt-2 text-[15.5px] font-bold text-muted-foreground hover:text-foreground data-[state=active]:border-brand data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-all"
          >
            Katalog Produk
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
