import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatRupiah } from "@/lib/utils"
import { ProductCatalogItem } from "@/types/match.types"

interface ProductListItemProps {
  product: ProductCatalogItem
  onEdit: (product: ProductCatalogItem) => void
  onDelete: (product: ProductCatalogItem) => void
}

export function ProductListItem({ product, onEdit, onDelete }: ProductListItemProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border rounded-lg bg-white hover:bg-muted/30 transition-colors">
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground truncate">{product.name}</span>
          {product.tagline && (
            <span className="text-xs text-muted-foreground truncate">— {product.tagline}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {product.price && (
            <span className="text-xs text-muted-foreground">
              {product.price.startsWith("Rp") ? product.price : formatRupiah(Number(product.price))}
            </span>
          )}
          {product.painCategories?.map(cat => (
            <Badge key={cat} variant="secondary" className="text-[10px] px-1.5 py-0">
              {cat}
            </Badge>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => onEdit(product)}
          title="Edit produk"
        >
          <Pencil className="w-3.5 h-3.5"  strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(product)}
          title="Hapus produk"
        >
          <Trash2 className="w-3.5 h-3.5"  strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  )
}
