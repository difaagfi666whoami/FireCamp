import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <p className="text-base font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-2">{actionLabel}</Button>
      )}
    </div>
  )
}
