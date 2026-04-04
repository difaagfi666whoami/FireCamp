"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ProductCatalogItem } from "@/types/match.types"

type PainCategory = "Marketing" | "Operations" | "Technology" | "Growth"
const PAIN_CATEGORIES: PainCategory[] = ["Marketing", "Operations", "Technology", "Growth"]

type ProductInput = Omit<ProductCatalogItem, "id" | "createdAt" | "updatedAt">

interface ProductFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: ProductInput) => void
  editingProduct?: ProductCatalogItem | null
}

export function ProductFormModal({ isOpen, onClose, onSave, editingProduct }: ProductFormModalProps) {
  const [formData, setFormData] = useState<Partial<ProductCatalogItem>>({
    name: "",
    tagline: "",
    description: "",
    usp: [],
    price: "",
    painCategories: [],
    source: "manual"
  })

  const [uspInput, setUspInput] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (editingProduct) {
      setFormData(editingProduct)
      setUspInput(editingProduct.usp?.join("\n") || "")
    } else {
      setFormData({ name: "", tagline: "", description: "", usp: [], price: "", painCategories: [], source: "manual" })
      setUspInput("")
    }
    setErrors({})
  }, [editingProduct, isOpen])

  const toggleCategory = (cat: PainCategory) => {
    const current = formData.painCategories || []
    const updated = current.includes(cat)
      ? current.filter(c => c !== cat)
      : [...current, cat]
    setFormData({ ...formData, painCategories: updated })
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!formData.name?.trim()) e.name = "Nama produk wajib diisi"
    if ((formData.description?.trim().length ?? 0) < 50)
      e.description = "Deskripsi minimal 50 karakter"
    if ((formData.painCategories?.length ?? 0) === 0)
      e.painCategories = "Pilih minimal 1 kategori pain point"
    return e
  }

  const handleSave = () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    const usp = uspInput.split("\n").map(f => f.trim()).filter(Boolean)
    onSave({
      name:           formData.name!.trim(),
      tagline:        formData.tagline?.trim()     || "",
      description:    formData.description!.trim(),
      usp,
      price:          formData.price               || "",
      painCategories: formData.painCategories      || [],
      source:         formData.source              || "manual",
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingProduct ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
          <DialogDescription>
            Masukkan detail produk atau layanan untuk dicocokkan dengan pain points target perusahaan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Nama */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Produk/Layanan <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: Cloud ERP System"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Tagline */}
          <div className="space-y-1.5">
            <Label htmlFor="tagline">Tagline <span className="text-muted-foreground text-xs">(maks. 60 karakter)</span></Label>
            <Input
              id="tagline"
              value={formData.tagline}
              onChange={e => setFormData({ ...formData, tagline: e.target.value.slice(0, 60) })}
              placeholder="Contoh: Otomasi laporan keuangan tanpa coding"
            />
            <p className="text-xs text-muted-foreground text-right">{formData.tagline?.length ?? 0}/60</p>
          </div>

          {/* Deskripsi */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Deskripsi <span className="text-destructive">*</span> <span className="text-muted-foreground text-xs">(min. 50 karakter)</span></Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Jelaskan secara singkat kegunaannya..."
              className="resize-none h-20"
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          {/* Harga */}
          <div className="space-y-1.5">
            <Label htmlFor="price">Harga</Label>
            <Input
              id="price"
              value={formData.price}
              onChange={e => setFormData({ ...formData, price: e.target.value })}
              placeholder="Contoh: Rp 5.000.000/bulan"
            />
          </div>

          {/* Pain Categories */}
          <div className="space-y-2">
            <Label>Kategori Pain Point <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 gap-2">
              {PAIN_CATEGORIES.map((cat) => (
                <div key={cat} className="flex items-center gap-2">
                  <Checkbox
                    id={`cat-${cat}`}
                    checked={(formData.painCategories || []).includes(cat as PainCategory)}
                    onCheckedChange={() => toggleCategory(cat as PainCategory)}
                  />
                  <Label htmlFor={`cat-${cat}`} className="font-normal cursor-pointer">{cat}</Label>
                </div>
              ))}
            </div>
            {errors.painCategories && <p className="text-xs text-destructive">{errors.painCategories}</p>}
          </div>

          {/* USP */}
          <div className="space-y-1.5">
            <Label htmlFor="usp">Fitur Utama/USP <span className="text-muted-foreground text-xs">(satu per baris)</span></Label>
            <Textarea
              id="usp"
              value={uspInput}
              onChange={e => setUspInput(e.target.value)}
              placeholder={"Integrasi API\nDashboard Analytics\nAutomated Reporting"}
              className="resize-none h-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave}>
            {editingProduct ? "Simpan Perubahan" : "Simpan Produk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
