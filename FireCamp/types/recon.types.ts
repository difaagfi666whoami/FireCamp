export interface CompanyProfile {
  id: string
  url: string
  name: string
  industry: string
  size: string
  founded: string
  hq: string
  description: string
  linkedin: {
    followers: string
    employees: number
    growth: string
  }
  contacts: PicContact[]
  painPoints: PainPoint[]
  news: NewsItem[]
  campaignProgress: CampaignProgress
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
}

export interface PainPoint {
  category: 'Marketing' | 'Operations' | 'Technology' | 'Growth'
  issue: string
  severity: 'high' | 'medium' | 'low'
}

export interface NewsItem {
  title: string
  date: string
  source: string
  summary: string
  url: string
}

export interface CampaignProgress {
  recon: boolean
  match: boolean
  craft: boolean
  polish: boolean
  launch: boolean
  pulse: boolean
}
