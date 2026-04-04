export interface Campaign {
  reasoning: string
  targetCompany: string
  createdAt: string
  emails: CampaignEmail[]
}

export interface CampaignEmail {
  id: string
  sequenceNumber: number
  dayLabel: string
  scheduledDay: number
  subject: string
  body: string
  tone: 'profesional' | 'friendly' | 'direct' | 'storytelling'
  isApproved: boolean
}
