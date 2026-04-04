"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { ProductCatalogItem } from "@/types/match.types"
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProducts,
} from "@/lib/api/catalog"

type ProductInput = Omit<ProductCatalogItem, "id" | "createdAt" | "updatedAt">

export function useCatalog() {
  const [products, setProducts]   = useState<ProductCatalogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // ── LOAD ──────────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setProducts(await getProducts())
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      setError(msg)
      toast.error("Gagal memuat katalog produk.", { description: msg })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // ── CREATE ─────────────────────────────────────────────────────────────────

  const add = useCallback(async (input: ProductInput): Promise<ProductCatalogItem | null> => {
    try {
      const created = await createProduct(input)
      setProducts(prev => [created, ...prev])
      toast.success(`"${created.name}" berhasil ditambahkan.`)
      return created
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      console.error("[useCatalog] add failed:", msg)
      toast.error("Gagal menambahkan produk.", { description: msg })
      return null
    }
  }, [])

  // ── UPDATE ─────────────────────────────────────────────────────────────────

  const edit = useCallback(async (id: string, input: ProductInput): Promise<ProductCatalogItem | null> => {
    try {
      const updated = await updateProduct(id, input)
      setProducts(prev => prev.map(p => p.id === id ? updated : p))
      toast.success(`"${updated.name}" berhasil diperbarui.`)
      return updated
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      console.error("[useCatalog] edit failed:", msg)
      toast.error("Gagal memperbarui produk.", { description: msg })
      return null
    }
  }, [])

  // ── DELETE single ──────────────────────────────────────────────────────────

  const remove = useCallback(async (id: string): Promise<void> => {
    try {
      await deleteProduct(id)
      setProducts(prev => prev.filter(p => p.id !== id))
      toast.success("Produk dihapus.")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      console.error("[useCatalog] remove failed:", msg)
      toast.error("Gagal menghapus produk.", { description: msg })
    }
  }, [])

  // ── DELETE bulk ────────────────────────────────────────────────────────────

  const removeBulk = useCallback(async (ids: string[]): Promise<void> => {
    try {
      await deleteProducts(ids)
      setProducts(prev => prev.filter(p => !ids.includes(p.id)))
      toast.success(`${ids.length} produk dihapus.`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      console.error("[useCatalog] removeBulk failed:", msg)
      toast.error("Gagal menghapus produk.", { description: msg })
    }
  }, [])

  return { products, isLoading, error, refresh, add, edit, remove, removeBulk }
}
