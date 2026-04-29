export interface ProductCatalogItem {
  id: string
  name: string
  tagline: string
  description: string
  price: string
  painCategories: Array<'Marketing' | 'Operations' | 'Technology' | 'Growth'>
  usp: string[]
  source: 'manual' | 'pdf'
  createdAt: string
  updatedAt: string
}

export interface ProductMatch extends ProductCatalogItem {
  matchScore: number
  addressedPainIndices: number[]
  reasoning: string
  isRecommended: boolean
}

export interface PdfExtractionResult {
  extractedName: string
  extractedTagline: string
  extractedDescription: string
  extractedPrice: string
  extractedUsp: string[]
  confidence: number
}
