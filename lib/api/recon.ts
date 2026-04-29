import { CompanyProfile } from "@/types/recon.types"
import { mockData } from "@/lib/mock/mockdata"
import { supabase, getCurrentUserId, getCurrentSessionToken } from "@/lib/supabase/client"
import { isMockMode } from "@/lib/demoMode"

function stripQuotes(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }
const API_URL = stripQuotes(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")

// -----------------------------------------------------------------------------
// Shared type — shape yang dibutuhkan ProfileCard & research-library page
// -----------------------------------------------------------------------------

export interface LibraryEntry {
  id: string
  name: string
  industry: string
  hq: string
  savedAt: string
  painPointsCount: number
  progress: {
    recon:   boolean
    match:   boolean
    craft:   boolean
    polish:  boolean
    launch:  boolean
    pulse:   boolean
  }
}

// -----------------------------------------------------------------------------
// GENERATE — panggil FastAPI backend untuk AI recon
// FIX BUG 4: tambah parameter mode dan kirim ke backend
// -----------------------------------------------------------------------------

export async function generateReconProfile(
  url: string,
  mode: 'free' | 'pro' = 'free'
): Promise<CompanyProfile> {
  if (isMockMode()) {
    await new Promise(r => setTimeout(r, 500))
    return { ...mockData.company, url } as CompanyProfile
  }

  const token = await getCurrentSessionToken()
  const res = await fetch(`${API_URL}/api/recon`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ url, mode }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  return res.json()
}

// -----------------------------------------------------------------------------
// GET company by ID — fetch dari Supabase dengan semua relasi
// FIX BUG 2: map signalType pada news
// FIX BUG 5: map match_angle pada pain_points
// FIX BUG 6: select intent_signals + anomalies + citations + tech_stack
// -----------------------------------------------------------------------------

export async function getCompanyById(id: string): Promise<CompanyProfile> {
  const { data, error } = await supabase
    .from("companies")
    .select(`
      id, url, name, industry, size, founded, hq, description,
      deep_insights, strategic_report, recon_mode,
      tavily_report, situational_summary, anomalies, citations,
      linkedin_followers, linkedin_employees, linkedin_growth,
      progress_recon, progress_match, progress_craft,
      progress_polish, progress_launch, progress_pulse,
      created_at, cached_at,
      contacts (
        id, name, title, email, phone, linkedin_url, location,
        prospect_score, reasoning, connections, about, role_duration, source
      ),
      pain_points (
        id, category, issue, severity, source_url, source_title, match_angle
      ),
      news (
        id, title, published_date, source, summary, url, signal_type
      ),
      intent_signals (
        id, title, date, source, summary, url,
        signal_type, verified_amount, verified_date
      )
    `)
    .eq("id", id)
    .single()

  console.log("[Campfire/recon] getCompanyById result:", { data, error })

  if (error) {
    console.error("[Campfire/recon] getCompanyById error:", error)
    throw new Error(error.message)
  }

  return {
    id:             data.id,
    url:            data.url,
    name:           data.name,
    industry:       data.industry,
    size:           data.size           ?? "",
    founded:        data.founded        ?? "",
    hq:             data.hq             ?? "",
    description:    data.description    ?? "",
    deepInsights:   data.deep_insights  ?? [],
    strategicReport: data.strategic_report ? {
      ...data.strategic_report,
      citations:          data.citations
                            ? (typeof data.citations === 'string'
                                ? JSON.parse(data.citations)
                                : data.citations)
                            : [],
      situationalSummary: data.situational_summary ?? '',
    } : undefined,
    reconMode:      (data.recon_mode as 'free' | 'pro') ?? 'free',
    tavilyReport:   data.tavily_report  ?? undefined,
    linkedin: {
      followers: data.linkedin_followers ?? "0",
      employees: data.linkedin_employees ?? 0,
      growth:    data.linkedin_growth    ?? "0%",
    },
    contacts: (data.contacts ?? []).map((c: any) => ({
      id:            c.id,
      name:          c.name,
      title:         c.title          ?? "",
      email:         c.email          ?? "",
      phone:         c.phone          ?? "",
      linkedinUrl:   c.linkedin_url   ?? null,
      prospectScore: c.prospect_score ?? 0,
      reasoning:     c.reasoning      ?? "",
      location:      c.location       ?? undefined,
      connections:   c.connections    ?? undefined,
      about:         c.about          ?? undefined,
      roleDuration:  c.role_duration  ?? undefined,
      source:        c.source         ?? undefined,
    })),
    painPoints: (data.pain_points ?? []).map((p: any) => ({
      category:    p.category,
      issue:       p.issue,
      severity:    p.severity,
      sourceUrl:   p.source_url   ?? undefined,
      sourceTitle: p.source_title ?? undefined,
      matchAngle:  p.match_angle  ?? undefined,  // Fix BUG 5
    })),
    news: (data.news ?? []).map((n: any) => ({
      title:      n.title,
      date:       n.published_date ?? "",
      source:     n.source         ?? "",
      summary:    n.summary        ?? "",
      url:        n.url            ?? "",
      signalType: n.signal_type    ?? undefined,  // Fix BUG 2
    })),
    intentSignals: (data.intent_signals ?? []).map((s: any) => ({
      title:          s.title,
      date:           s.date           ?? '',
      source:         s.source         ?? '',
      summary:        s.summary        ?? '',
      url:            s.url            ?? '',
      signalType:     s.signal_type,
      verifiedAmount: s.verified_amount ?? undefined,
      verifiedDate:   s.verified_date   ?? undefined,
    })),
    situationalSummary: data.situational_summary ?? undefined,
    anomalies:          typeof data.anomalies === 'string'
                          ? JSON.parse(data.anomalies)
                          : (data.anomalies ?? []),
    campaignProgress: {
      recon:   data.progress_recon,
      match:   data.progress_match,
      craft:   data.progress_craft,
      polish:  data.progress_polish,
      launch:  data.progress_launch,
      pulse:   data.progress_pulse,
    },
    createdAt: data.created_at,
    cachedAt:  data.cached_at ?? data.created_at,
  }
}

// -----------------------------------------------------------------------------
// UPDATE company progress di Supabase
// -----------------------------------------------------------------------------

export async function updateCompanyProgress(
  companyId: string,
  stage: "match" | "craft" | "polish" | "launch" | "pulse"
): Promise<void> {
  if (!companyId) return

  const { error } = await supabase
    .from("companies")
    .update({ [`progress_${stage}`]: true })
    .eq("id", companyId)

  if (error) {
    console.error(`[Campfire/recon] updateCompanyProgress ${stage}:`, error)
  }
}

// -----------------------------------------------------------------------------
// GET research library
// -----------------------------------------------------------------------------

export async function getResearchLibrary(): Promise<LibraryEntry[]> {
  const { data, error } = await supabase
    .from("companies")
    .select(`
      id, name, industry, hq, created_at,
      progress_recon, progress_match, progress_craft,
      progress_polish, progress_launch, progress_pulse,
      pain_points(id)
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[Campfire/recon] getResearchLibrary error:", error)
    throw new Error(error.message)
  }

  if (!data || data.length === 0) {
    if (isMockMode()) return mockData.researchLibrary as LibraryEntry[]
    return []
  }

  return data.map((row: any) => ({
    id:             row.id,
    name:           row.name,
    industry:       row.industry,
    hq:             row.hq ?? "",
    savedAt:        row.created_at,
    painPointsCount: row.pain_points?.length ?? 0,
    progress: {
      recon:   row.progress_recon,
      match:   row.progress_match,
      craft:   row.progress_craft,
      polish:  row.progress_polish,
      launch:  row.progress_launch,
      pulse:   row.progress_pulse,
    },
  }))
}

// -----------------------------------------------------------------------------
// SAVE company profile (companies + contacts + pain_points + news + intent_signals)
// FIX BUG 1: save intent_signals
// FIX BUG 3: save tech_stack + anomalies + citations + situational_summary
// -----------------------------------------------------------------------------

export async function saveCompanyProfile(profile: CompanyProfile): Promise<string> {
  const userId = await getCurrentUserId()
  const { data: company, error: companyErr } = await supabase
    .from("companies")
    .insert({
      user_id:             userId,
      url:                 profile.url,
      name:                profile.name,
      industry:            profile.industry,
      size:                profile.size,
      founded:             profile.founded,
      hq:                  profile.hq,
      description:         profile.description,
      deep_insights:       profile.deepInsights     ?? [],
      strategic_report:    profile.strategicReport  ?? null,
      recon_mode:          profile.reconMode        ?? null,
      situational_summary: profile.strategicReport?.situationalSummary ?? null,
      anomalies:           profile.anomalies ?? [],
      citations:           profile.strategicReport?.citations ?? [],
      linkedin_followers:  profile.linkedin.followers,
      linkedin_employees:  profile.linkedin.employees,
      linkedin_growth:     profile.linkedin.growth,
      progress_recon:      true,
      progress_match:      false,
      progress_craft:      false,
      progress_polish:     false,
      progress_launch:     false,
      progress_pulse:      false,
      cached_at:           new Date().toISOString(),
    })
    .select("id")
    .single()

  if (companyErr) {
    console.error("[Campfire/recon] insert company error:", companyErr)
    throw new Error(companyErr.message)
  }

  const companyId: string = company.id

  if (profile.contacts?.length) {
    const { error } = await supabase.from("contacts").insert(
      profile.contacts.map(c => ({
        user_id:        userId,
        company_id:     companyId,
        name:           c.name,
        title:          c.title,
        email:          c.email,
        phone:          c.phone,
        linkedin_url:   c.linkedinUrl   ?? null,
        prospect_score: c.prospectScore,
        reasoning:      c.reasoning,
        location:       c.location      ?? null,
        connections:    c.connections   ?? null,
        about:          c.about         ?? null,
        role_duration:  c.roleDuration  ?? null,
        source:         c.source        ?? null,
      }))
    )
    if (error) throw new Error(error.message)
  }

  if (profile.painPoints?.length) {
    const { error } = await supabase.from("pain_points").insert(
      profile.painPoints.map(p => ({
        user_id:      userId,
        company_id:   companyId,
        category:     p.category,
        issue:        p.issue,
        severity:     p.severity,
        source_url:   p.sourceUrl   ?? null,
        source_title: p.sourceTitle ?? null,
        match_angle:  p.matchAngle  ?? null,  // Fix BUG 5
      }))
    )
    if (error) throw new Error(error.message)
  }

  if (profile.news?.length) {
    const { error } = await supabase.from("news").insert(
      profile.news.map(n => ({
        user_id:        userId,
        company_id:     companyId,
        title:          n.title,
        published_date: n.date,
        source:         n.source,
        summary:        n.summary,
        url:            n.url,
        signal_type:    n.signalType ?? null,
      }))
    )
    if (error) throw new Error(error.message)
  }

  // Fix BUG 1: save intent_signals
  if (profile.intentSignals && profile.intentSignals.length > 0) {
    const intentSignalRows = profile.intentSignals.map(s => ({
      user_id:         userId,
      company_id:      companyId,
      title:           s.title,
      date:            s.date           ?? null,
      source:          s.source         ?? null,
      summary:         s.summary        ?? null,
      url:             s.url            ?? null,
      signal_type:     s.signalType,
      verified_amount: s.verifiedAmount ?? null,
      verified_date:   s.verifiedDate   ?? null,
    }))
    const { error: intentError } = await supabase
      .from('intent_signals')
      .insert(intentSignalRows)
    if (intentError) {
      console.error('[recon] intent_signals insert error:', intentError.message)
      // Non-fatal: lanjut meski gagal
    }
  }

  return companyId
}

// -----------------------------------------------------------------------------
// DELETE company profile (CASCADE menghapus contacts, pain_points, news)
// -----------------------------------------------------------------------------

export async function deleteCompanyProfile(id: string): Promise<void> {
  if (isMockMode()) return

  const { error } = await supabase.from("companies").delete().eq("id", id)
  if (error) {
    console.error("[Campfire/recon] deleteCompanyProfile error:", error)
    throw new Error(error.message)
  }
}

// -----------------------------------------------------------------------------
// PRO MODE — call Tavily Research API via backend, server saves to Supabase
// -----------------------------------------------------------------------------

export async function runProRecon(query: string): Promise<{ id: string; name: string }> {
  if (isMockMode()) {
    await new Promise(r => setTimeout(r, 2000))
    return { id: mockData.company.id, name: mockData.company.name }
  }
  const token = await getCurrentSessionToken()
  const res = await fetch(`${API_URL}/api/recon/pro`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? "Tavily Research gagal")
  }
  const data = await res.json()
  return { id: data.company_id, name: data.name }
}
