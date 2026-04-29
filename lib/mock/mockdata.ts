import mockDataRaw from '@/data/mockdata.json'
import { CompanyProfile } from '@/types/recon.types'
import { ProductCatalogItem, ProductMatch, PdfExtractionResult } from '@/types/match.types'
import { Campaign } from '@/types/craft.types'
import { TokenUsage } from '@/types/analytics.types'

export const mockData = {
  researchLibrary: mockDataRaw.researchLibrary as any[],
  company: mockDataRaw.company as unknown as CompanyProfile,
  reconModePro: mockDataRaw.reconModePro as unknown as CompanyProfile,
  productCatalog: mockDataRaw.productCatalog as unknown as ProductCatalogItem[],
  matchingResults: mockDataRaw.matchingResults as unknown as ProductMatch[],
  pdfExtractionMock: mockDataRaw.pdfExtractionMock as unknown as PdfExtractionResult,
  campaign: mockDataRaw.campaign as unknown as Campaign,
  schedule: mockDataRaw.schedule as any,
  analytics: {
    summary: mockDataRaw.analytics.summary as any,
    perEmail: mockDataRaw.analytics.perEmail as any[],
    timeline: mockDataRaw.analytics.timeline as any[],
    tokenUsage: mockDataRaw.analytics.tokenUsage as unknown as TokenUsage
  }
}
