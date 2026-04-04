"use client"

import { useState, useRef, useMemo } from "react"
import { Plus, MoreVertical, FileText, LayoutGrid, Folder, Search, Loader2, Trash2, AlertCircle } from "lucide-react"
import { ProductCatalogItem } from "@/types/match.types"
import { mockData } from "@/lib/mock/mockdata"
import { useCatalog } from "@/hooks/use-catalog"
import { ProductFormModal } from "./ProductFormModal"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

type ProductInput = Omit<ProductCatalogItem, "id" | "createdAt" | "updatedAt">

const IS_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true"

export function ProductCatalogTab() {
  const catalog = useCatalog()

  const [isModalOpen, setIsModalOpen]       = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductCatalogItem | null>(null)
  const [isExtracting, setIsExtracting]     = useState(false)
  const [checkedIds, setCheckedIds]         = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery]       = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return catalog.products
    return catalog.products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.tagline?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.painCategories?.some(c => c.toLowerCase().includes(q))
    )
  }, [catalog.products, searchQuery])

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setCheckedIds(
      checkedIds.size === filteredProducts.length
        ? new Set()
        : new Set(filteredProducts.map(p => p.id))
    )
  }

  const handleDeleteSelected = async () => {
    const ids = Array.from(checkedIds)
    await catalog.removeBulk(ids)
    setCheckedIds(new Set())
  }

  const handleAddClick = () => { setEditingProduct(null); setIsModalOpen(true) }
  const handleEditClick = (product: ProductCatalogItem) => { setEditingProduct(product); setIsModalOpen(true) }

  const handleSaveProduct = async (data: ProductInput) => {
    if (editingProduct) {
      await catalog.edit(editingProduct.id, data)
    } else {
      await catalog.add(data)
    }
  }

  const triggerPdfUpload = () => fileInputRef.current?.click()

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return
    setIsExtracting(true)
    await new Promise(r => setTimeout(r, 2000))
    const mock = mockData.pdfExtractionMock
    await catalog.add({
      name:           mock.extractedName,
      tagline:        mock.extractedTagline,
      description:    mock.extractedDescription,
      price:          mock.extractedPrice,
      usp:            mock.extractedUsp,
      painCategories: [],
      source:         "pdf",
    })
    setIsExtracting(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const recentProducts = catalog.products.slice(0, 2)
  const allChecked = filteredProducts.length > 0 && checkedIds.size === filteredProducts.length
  const someChecked = checkedIds.size > 0

  // ── Loading state ──────────────────────────────────────────────────────────

  if (catalog.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground animate-in fade-in">
        <Loader2 className="w-7 h-7 animate-spin" />
        <p className="text-[14px] font-medium">Memuat katalog produk...</p>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (catalog.error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 animate-in fade-in">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex flex-col items-center gap-3 max-w-sm text-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="font-bold text-[15px] text-red-800">Gagal memuat katalog</p>
          <p className="text-[13px] text-red-700">{catalog.error}</p>
          <Button onClick={catalog.refresh} variant="outline" size="sm" className="mt-1 rounded-xl">
            Coba Lagi
          </Button>
        </div>
      </div>
    )
  }

  // ── Main UI ────────────────────────────────────────────────────────────────

  return (
    <div className="animate-in fade-in py-2 duration-500 w-full mx-auto max-w-5xl">
      {/* Mode indicator — hapus setelah selesai testing */}
      <div className={`mb-5 inline-flex items-center gap-2 text-[12px] font-bold px-3 py-1.5 rounded-full border ${
        IS_MOCK
          ? "bg-amber-50 border-amber-200 text-amber-700"
          : "bg-emerald-50 border-emerald-200 text-emerald-700"
      }`}>
        <span className={`w-2 h-2 rounded-full ${IS_MOCK ? "bg-amber-400" : "bg-emerald-500"}`} />
        {IS_MOCK ? "MOCK MODE — data tidak disimpan ke Supabase" : "SUPABASE MODE — data tersimpan ke database"}
      </div>

      <h2 className="text-xl font-bold tracking-tight mb-6">Katalog Produk</h2>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div onClick={handleAddClick} className="group cursor-pointer rounded-2xl bg-secondary/30 hover:bg-secondary/50 p-4 pb-5 border border-transparent transition-colors flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <div className="bg-foreground text-background p-2.5 rounded-xl self-start"><FileText className="w-5 h-5" /></div>
            <Plus className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors mt-0.5" />
          </div>
          <div className="font-semibold text-[15px] mt-4 tracking-tight">Tambah Manual</div>
        </div>

        <div onClick={triggerPdfUpload} className="group cursor-pointer rounded-2xl border border-border/80 p-4 pb-5 hover:border-border hover:bg-muted/20 transition-colors flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <div className="bg-foreground text-background p-2.5 rounded-xl self-start">
              {isExtracting ? <Loader2 className="w-5 h-5 animate-spin" /> : <LayoutGrid className="w-5 h-5" />}
            </div>
            {!isExtracting && <Plus className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors mt-0.5" />}
          </div>
          <div className="font-semibold text-[15px] mt-4 tracking-tight">{isExtracting ? "Mengekstrak AI..." : "Ekstrak PDF Brosur"}</div>
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handlePdfUpload} />
        </div>

        <div className="group cursor-not-allowed rounded-2xl border border-border/80 p-4 pb-5 bg-muted/10 opacity-60 flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <div className="bg-foreground text-background p-2.5 rounded-xl self-start"><Folder className="w-5 h-5" /></div>
          </div>
          <div className="font-semibold text-[15px] mt-4 tracking-tight">Import CSV (Segera)</div>
        </div>
      </div>

      {/* Recently Added */}
      <h2 className="text-[17px] font-bold tracking-tight mb-4">Baru ditambahkan</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {recentProducts.map(p => (
          <div key={p.id} className="flex items-center justify-between p-4 border border-border/70 rounded-[14px] hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-3">
              <div className="bg-muted/50 p-2.5 rounded-xl border border-border/40"><FileText className="w-5 h-5 text-muted-foreground" /></div>
              <div>
                <div className="font-semibold text-[14px] leading-tight mb-1">{p.name || "Untitled"}</div>
                <div className="text-[13px] text-muted-foreground flex gap-2">
                  <span>{p.painCategories?.length || 0} Target Pains</span>
                  <span className="capitalize">{p.source}</span>
                </div>
              </div>
            </div>
            <button onClick={() => handleEditClick(p)} className="p-1 hover:bg-muted rounded-md text-muted-foreground flex items-center gap-1 -mr-2">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      {/* All Products header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[17px] font-bold tracking-tight">Semua Produk</h2>
        {someChecked && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteSelected}
            className="rounded-xl font-bold text-[12.5px] h-9 gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hapus {checkedIds.size} item
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative w-full sm:w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari produk..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border text-[13.5px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-border/80 rounded-2xl overflow-hidden mb-12 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow className="border-border/80">
              <TableHead className="w-[50px] pl-4">
                <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead className="font-medium text-xs text-muted-foreground">Nama Produk</TableHead>
              <TableHead className="font-medium text-xs text-muted-foreground text-right pr-6">Ditambahkan oleh</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-10 text-muted-foreground text-[13.5px]">
                  {searchQuery ? `Tidak ada produk yang cocok dengan "${searchQuery}"` : "Belum ada produk."}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map(p => (
                <TableRow key={p.id} className="border-border/60 hover:bg-muted/10" data-checked={checkedIds.has(p.id)}>
                  <TableCell className="pl-4 h-16">
                    <Checkbox checked={checkedIds.has(p.id)} onCheckedChange={() => toggleCheck(p.id)} />
                  </TableCell>
                  <TableCell className="h-16 py-0">
                    <div className="flex items-center gap-3">
                      <div className="bg-secondary/40 p-2 rounded-lg border border-border/20">
                        <FileText className="w-4 h-4 text-foreground/70" />
                      </div>
                      <div>
                        <div className="font-semibold text-[14px] leading-tight mb-0.5">{p.name}</div>
                        <div className="text-[13px] text-muted-foreground">
                          {p.price || "Rp 0"}
                          <span className="capitalize text-muted-foreground/60"> · {p.source}</span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6 h-16 py-0">
                    <div className="flex items-center justify-end gap-3">
                      <div className="flex flex-col items-end">
                        <span className="text-[13px] font-semibold">{p.source === "pdf" ? "AI Extractor" : "Admin Campfire"}</span>
                        <span className="text-[12px] text-muted-foreground">{p.painCategories?.[0]?.toLowerCase() || "general"}@campfire.com</span>
                      </div>
                      <Avatar className="w-8 h-8 rounded-full border bg-muted">
                        <AvatarFallback className="text-xs bg-brand/10 text-brand font-semibold">
                          {p.source === "pdf" ? "AI" : "AD"}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
        editingProduct={editingProduct}
      />
    </div>
  )
}
