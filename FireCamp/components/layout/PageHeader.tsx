interface PageHeaderProps {
  title: string
  subtitle?: string
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}
