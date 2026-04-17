export type ReconMode = 'free' | 'pro'

export interface StrategicReport {
  strategicTitle: string
  executiveInsight: string
  internalCapabilities: string
  marketDynamics: string
  strategicRoadmap: string[]
}

export interface CompanyProfile {
  id: string
  url: string
  name: string
  industry: string
  size: string
  founded: string
  hq: string
  description: string
  deepInsights?: string[]
  strategicReport?: StrategicReport
  linkedin: {
    followers: string
    employees: number
    growth: string
  }
  contacts: PicContact[]
  painPoints: PainPoint[]
  news: NewsItem[]
  campaignProgress: CampaignProgress
  reconMode?: ReconMode
  createdAt: string
  cachedAt: string
}

export interface PicContact {
  id: string
  name: string
  title: string
  email: string
  phone: string
  linkedinUrl?: string
  prospectScore: number
  reasoning: string
  source?: 'web' | 'linkedin_public' | 'serper'
  location?: string
  connections?: string
  about?: string
  roleDuration?: string
}

export interface PainPoint {
  category: 'Marketing' | 'Operations' | 'Technology' | 'Growth'
  issue: string
  severity: 'high' | 'medium' | 'low'
  sourceUrl?: string
  sourceTitle?: string
}

export interface NewsItem {
  title: string
  date: string
  source: string
  summary: string
  url: string
  signalType?: string
}

export interface CampaignProgress {
  recon: boolean
  match: boolean
  craft: boolean
  polish: boolean
  launch: boolean
  pulse: boolean
}
