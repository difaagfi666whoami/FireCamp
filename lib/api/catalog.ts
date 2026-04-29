import { ProductCatalogItem } from "@/types/match.types"
import { mockData } from "@/lib/mock/mockdata"
import { supabase, getCurrentUserId } from "@/lib/supabase/client"
import { isMockMode } from "@/lib/demoMode"

// Debug log saat modul pertama kali di-load (tampil di browser console)
if (typeof window !== "undefined") {
  console.info(
    `[Campfire/catalog] mode = ${isMockMode() ? "MOCK" : "SUPABASE"} | NEXT_PUBLIC_USE_MOCK = "${process.env.NEXT_PUBLIC_USE_MOCK}"`
  )
}

// -----------------------------------------------------------------------------
// DB row type (snake_case dari Supabase) → TS type (camelCase)
// -----------------------------------------------------------------------------

type ProductRow = {
  id: string
  name: string
  tagline: string | null
  description: string | null
  price: string | null
  pain_categories: string[]
  usp: string[]
  source: string
  created_at: string
  updated_at: string
}

function rowToItem(row: ProductRow): ProductCatalogItem {
  return {
    id:             row.id,
    name:           row.name,
    tagline:        row.tagline        ?? "",
    description:    row.description   ?? "",
    price:          row.price          ?? "",
    painCategories: (row.pain_categories ?? []) as ProductCatalogItem["painCategories"],
    usp:            row.usp            ?? [],
    source:         row.source as "manual" | "pdf",
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  }
}

type ProductInput = Omit<ProductCatalogItem, "id" | "createdAt" | "updatedAt">

// -----------------------------------------------------------------------------
// READ
// -----------------------------------------------------------------------------

export async function getProducts(): Promise<ProductCatalogItem[]> {
  if (isMockMode()) return mockData.productCatalog

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[Campfire/catalog] getProducts error:", error)
    throw new Error(error.message)
  }
  return (data as ProductRow[]).map(rowToItem)
}

// -----------------------------------------------------------------------------
// CREATE
// -----------------------------------------------------------------------------

export async function createProduct(input: ProductInput): Promise<ProductCatalogItem> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from("products")
    .insert({
      user_id:         userId,
      name:            input.name,
      tagline:         input.tagline,
      description:     input.description,
      price:           input.price,
      pain_categories: input.painCategories,
      usp:             input.usp,
      source:          input.source,
    })
    .select()
    .single()

  if (error) {
    console.error("[Campfire/catalog] createProduct error:", error)
    throw new Error(error.message)
  }
  return rowToItem(data as ProductRow)
}

// -----------------------------------------------------------------------------
// UPDATE
// -----------------------------------------------------------------------------

export async function updateProduct(id: string, input: ProductInput): Promise<ProductCatalogItem> {
  const { data, error } = await supabase
    .from("products")
    .update({
      name:            input.name,
      tagline:         input.tagline,
      description:     input.description,
      price:           input.price,
      pain_categories: input.painCategories,
      usp:             input.usp,
      source:          input.source,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("[Campfire/catalog] updateProduct error:", error)
    throw new Error(error.message)
  }
  return rowToItem(data as ProductRow)
}

// -----------------------------------------------------------------------------
// DELETE (single)
// -----------------------------------------------------------------------------

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id)
  if (error) {
    console.error("[Campfire/catalog] deleteProduct error:", error)
    throw new Error(error.message)
  }
}

// -----------------------------------------------------------------------------
// GET by ID
// -----------------------------------------------------------------------------

export async function getProductById(id: string): Promise<ProductCatalogItem | null> {
  if (isMockMode()) {
    return mockData.productCatalog.find((p: any) => p.id === id) as ProductCatalogItem | undefined ?? null
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    console.error("[Campfire/catalog] getProductById error:", error)
    return null
  }
  return rowToItem(data as ProductRow)
}

// -----------------------------------------------------------------------------
// DELETE (bulk)
// -----------------------------------------------------------------------------

export async function deleteProducts(ids: string[]): Promise<void> {
  if (!ids.length) return

  const { error } = await supabase.from("products").delete().in("id", ids)
  if (error) {
    console.error("[Campfire/catalog] deleteProducts error:", error)
    throw new Error(error.message)
  }
}
