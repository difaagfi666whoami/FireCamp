import { CompanyProfile } from "@/types/recon.types"
import { mockData } from "@/lib/mock/mockdata"
import { supabase } from "@/lib/supabase/client"

function stripQuotes(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }
const USE_MOCK = stripQuotes(process.env.NEXT_PUBLIC_USE_MOCK ?? "true") === "true"
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
// -----------------------------------------------------------------------------

export async function generateReconProfile(url: string): Promise<CompanyProfile> {
  if (USE_MOCK) {
    // Simulasi delay sedikit untuk mock mode
    await new Promise(r => setTimeout(r, 500))
    return { ...mockData.company, url } as CompanyProfile
  }

  const res = await fetch(`${API_URL}/api/recon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  return res.json()
}

// -----------------------------------------------------------------------------
// GET company by ID — fetch dari Supabase dengan semua relasi
// -----------------------------------------------------------------------------

export async function getCompanyById(id: string): Promise<CompanyProfile> {
  const { data, error } = await supabase
    .from("companies")
    .select(`
      id, url, name, industry, size, founded, hq, description,
      linkedin_followers, linkedin_employees, linkedin_growth,
      progress_recon, progress_match, progress_craft,
      progress_polish, progress_launch, progress_pulse,
      created_at, cached_at,
      contacts (id, name, title, email, phone, linkedin_url, prospect_score, reasoning),
      pain_points (id, category, issue, severity),
      news (id, title, published_date, source, summary, url)
    `)
    .eq("id", id)
    .single()

  console.log("[Campfire/recon] getCompanyById result:", { data, error })

  if (error) {
    console.error("[Campfire/recon] getCompanyById error:", error)
    throw new Error(error.message)
  }

  return {
    id:          data.id,
    url:         data.url,
    name:        data.name,
    industry:    data.industry,
    size:        data.size        ?? "",
    founded:     data.founded     ?? "",
    hq:          data.hq          ?? "",
    description: data.description ?? "",
    linkedin: {
      followers: data.linkedin_followers ?? "0",
      employees: data.linkedin_employees ?? 0,
      growth:    data.linkedin_growth    ?? "0%",
    },
    contacts: (data.contacts ?? []).map((c: any) => ({
      id:            c.id,
      name:          c.name,
      title:         c.title        ?? "",
      email:         c.email        ?? "",
      phone:         c.phone        ?? "",
      linkedinUrl:   c.linkedin_url ?? null,
      prospectScore: c.prospect_score ?? 0,
      reasoning:     c.reasoning    ?? "",
    })),
    painPoints: (data.pain_points ?? []).map((p: any) => ({
      category: p.category,
      issue:    p.issue,
      severity: p.severity,
    })),
    news: (data.news ?? []).map((n: any) => ({
      title:   n.title,
      date:    n.published_date ?? "",
      source:  n.source         ?? "",
      summary: n.summary        ?? "",
      url:     n.url            ?? "",
    })),
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

  if (!data || data.length === 0) return mockData.researchLibrary as LibraryEntry[]

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
// SAVE company profile (companies + contacts + pain_points + news)
// Returns the new Supabase-generated UUID
// -----------------------------------------------------------------------------

export async function saveCompanyProfile(profile: CompanyProfile): Promise<string> {
  const { data: company, error: companyErr } = await supabase
    .from("companies")
    .insert({
      url:                profile.url,
      name:               profile.name,
      industry:           profile.industry,
      size:               profile.size,
      founded:            profile.founded,
      hq:                 profile.hq,
      description:        profile.description,
      linkedin_followers: profile.linkedin.followers,
      linkedin_employees: profile.linkedin.employees,
      linkedin_growth:    profile.linkedin.growth,
      progress_recon:     true,
      progress_match:     false,
      progress_craft:     false,
      progress_polish:    false,
      progress_launch:    false,
      progress_pulse:     false,
      cached_at:          new Date().toISOString(),
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
        company_id:     companyId,
        name:           c.name,
        title:          c.title,
        email:          c.email,
        phone:          c.phone,
        linkedin_url:   c.linkedinUrl ?? null,
        prospect_score: c.prospectScore,
        reasoning:      c.reasoning,
      }))
    )
    if (error) throw new Error(error.message)
  }

  if (profile.painPoints?.length) {
    const { error } = await supabase.from("pain_points").insert(
      profile.painPoints.map(p => ({
        company_id: companyId,
        category:   p.category,
        issue:      p.issue,
        severity:   p.severity,
      }))
    )
    if (error) throw new Error(error.message)
  }

  if (profile.news?.length) {
    const { error } = await supabase.from("news").insert(
      profile.news.map(n => ({
        company_id:     companyId,
        title:          n.title,
        published_date: n.date,
        source:         n.source,
        summary:        n.summary,
        url:            n.url,
      }))
    )
    if (error) throw new Error(error.message)
  }

  return companyId
}

// -----------------------------------------------------------------------------
// DELETE company profile (CASCADE menghapus contacts, pain_points, news)
// -----------------------------------------------------------------------------

export async function deleteCompanyProfile(id: string): Promise<void> {
  if (USE_MOCK) return

  const { error } = await supabase.from("companies").delete().eq("id", id)
  if (error) {
    console.error("[Campfire/recon] deleteCompanyProfile error:", error)
    throw new Error(error.message)
  }
}
