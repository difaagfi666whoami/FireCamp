import { ExternalLink } from 'lucide-react'

interface CitationLinkProps {
  href: string
  label?: string
}

export function CitationLink({ href, label = "Baca artikel" }: CitationLinkProps) {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-info hover:text-info/80 hover:underline transition-colors mt-1 font-medium text-xs"
      title="Buka artikel di tab baru"
    >
      <span>{label}</span>
      <ExternalLink className="w-3 h-3"  strokeWidth={1.5} />
    </a>
  )
}
