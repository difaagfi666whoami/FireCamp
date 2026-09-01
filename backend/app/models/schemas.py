"""
Pydantic schemas — terjemahan 1-to-1 dari TypeScript interfaces di types/ dan
kontrak JSON yang didefinisikan di api-contract.md.

Catatan:
- Field yang `Optional` di TS (tandai `?`) → `Optional[T] = None` di sini.
- Array di TS → `list[T]` (default `[]` agar response selalu valid JSON).
- Literal / Union type di TS → `Literal` atau `Enum`.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, HttpUrl, Field


# ── Enums ─────────────────────────────────────────────────────────────────────

class ReconMode(str, Enum):
    free = "free"
    pro  = "pro"

class ContactSource(str, Enum):
    web             = "web"
    linkedin_public = "linkedin_public"
    serper          = "serper"


class PainCategory(str, Enum):
    marketing   = "Marketing"
    operations  = "Operations"
    technology  = "Technology"
    growth      = "Growth"


class PainSeverity(str, Enum):
    high   = "high"
    medium = "medium"
    low    = "low"


class CampaignTone(str, Enum):
    profesional  = "profesional"
    friendly     = "friendly"
    direct       = "direct"
    storytelling = "storytelling"


class ProductSource(str, Enum):
    manual = "manual"
    pdf    = "pdf"


# ── Sub-models ─────────────────────────────────────────────────────────────────

class Citation(BaseModel):
    url:    str = ""
    title:  str = ""
    source: str = ""
    date:   str = ""


class Anomaly(BaseModel):
    title:        str = ""
    observation:  str = ""
    implication:  str = ""
    evidenceUrl:  str = ""


class SalesTriggers(BaseModel):
    """3 Sudut Penjualan Kunci (Executive Sales Triggers) — The 3 Sales Triggers."""
    reality: str = Field(
        default="",
        description="The Reality: Model bisnis nyata, produk utama, dan target pasar terbukti dari website target"
    )
    bottleneck: str = Field(
        default="",
        description="The Bottleneck: Masalah operasional, hambatan skalabilitas, atau gap teknologi konkret yang terbukti dari data"
    )
    entryHook: str = Field(
        default="",
        description="The Entry Hook: Sudut penawaran terbaik dan alasan kenapa prospek butuh solusi sekarang (Why Now)"
    )


class VerifiedCapabilities(BaseModel):
    """Bukti Kemampuan & Footprint Terverifikasi dari Website Resmi Target."""
    coreOfferings: list[str] = Field(default_factory=list, description="Layanan & produk nyata dari subpage /services")
    verifiedClients: list[str] = Field(default_factory=list, description="Daftar klien atau portofolio nyata dari subpage /clients")
    hiringSignals: list[str] = Field(default_factory=list, description="Posisi tim yang sedang direkrut dari subpage /careers")


class BattlePlan(BaseModel):
    """
    Rencana Serangan Outreach — aset PALING berharga untuk tim sales.
    5 jawaban langsung yang bisa dipakai sales untuk bertindak, bukan laporan pasif.
    Setiap field HARUS berbasis fakta dari data riset; kosong jika tidak ada data.
    """
    whoToContact: str = Field(
        default="",
        description="Siapa yang dihubungi: nama + jabatan terbaik dari data kontak, dan kenapa dia (mandat/jabatan)."
    )
    whatToSay: str = Field(
        default="",
        description="Apa yang disampaikan: inti pesan 1 kalimat yang menjawab pain point spesifik perusahaan ini."
    )
    openingLine: str = Field(
        default="",
        description="Kalimat pembuka: 1 kalimat konkret siap kirim, menyebut fakta spesifik perusahaan. Bukan sapaan generik."
    )
    whyNow: str = Field(
        default="",
        description="Kenapa sekarang: trigger event dari data (hiring/ekspansi/berita/regulasi) yang membuat timing tepat."
    )
    fit: str = Field(
        default="",
        description="Kecocokan: apa yang mereka pakai sekarang (tech stack/tools) dan gap yang relevan dengan penawaran produk B2B."
    )
    evidenceUrls: list[str] = Field(default_factory=list, description="URL dari evidence_list yang mendukung klaim di atas.")


class FitSignals(BaseModel):
    """Sinyal kecocokan produk — tech stack & tools terdeteksi eksplisit dari website/job posting."""
    techStack: list[str] = Field(default_factory=list, description="Teknologi yang disebut eksplisit di website/job posting (contoh: Nuxt.js, AWS).")
    toolsDetected: list[str] = Field(default_factory=list, description="Tools/marketing stack yang disebut di data (contoh: Salesforce, HubSpot).")
    missingTools: list[str] = Field(default_factory=list, description="Kategori tools yang TIDAK terdeteksi padahal umum untuk industri/ukuran mereka — celah pitch.")
    assessment: str = Field(default="", description="Satu kalimat penilaian kesiapan teknologi mereka.")


class StrategicReport(BaseModel):
    """Laporan intelijen strategis bergaya konsultan BCG/McKinsey."""
    strategicTitle:        str            = ""
    executiveInsight:      str            = ""
    internalCapabilities:  str            = ""
    marketDynamics:        str            = ""
    strategicRoadmap:      list[str]      = []
    citations:             list[Citation] = []
    situationalSummary:    str            = ""
    confidenceScore:       str            = "HIGH"
    salesTriggers:         Optional[SalesTriggers] = None
    verifiedCapabilities:  Optional[VerifiedCapabilities] = None
    battlePlan:            Optional[BattlePlan] = None
    fitSignals:            Optional[FitSignals] = None


class LinkedInInfo(BaseModel):
    """Representasi data LinkedIn singkat dari sebuah perusahaan."""
    followers: str
    employees: int
    growth:    str


class PicContact(BaseModel):
    """Kontak PIC (Person In Charge) yang ditemukan dalam proses recon."""
    id:            str
    name:          str
    title:         str
    email:         str
    phone:         str
    linkedinUrl:   Optional[str]   = None
    prospectScore: int             = Field(default=0, ge=0, le=100)
    reasoning:     str             = ""
    source:        Optional[ContactSource] = None
    # Rich LinkedIn fields — disalin 1:1 dari Apify LinkedIn scraper
    location:      Optional[str]   = None
    connections:   Optional[str]   = None
    about:         Optional[str]   = None
    roleDuration:  Optional[str]   = None


class PainPoint(BaseModel):
    """Satu item pain point yang teridentifikasi dari riset perusahaan."""
    category:    PainCategory
    issue:       str
    severity:    PainSeverity
    sourceUrl:   str = ""
    sourceTitle: str = ""
    matchAngle:  str = ""


class NewsSignal(BaseModel):
    """Sinyal pain bisnis yang diekstrak dari satu artikel berita."""
    event_summary: str     # Apa yang terjadi (1 kalimat ringkas)
    implied_challenge: str # Implikasi bisnis untuk perusahaan target (1 kalimat)
    pain_category: str     # "Marketing" | "Operations" | "Technology" | "Growth"
    source_url: str        # URL artikel asal
    signal_type: str       # "direct" | "regulatory" | "competitive" | "technology"

class NewsItem(BaseModel):
    """Artikel berita / sinyal bisnis terkait perusahaan target."""
    title:   str
    date:    str   # format "DD Mon YYYY", e.g. "15 Feb 2026"
    source:  str
    summary: str
    url:     str
    signal_type: Optional[str] = None


class IntentSignal(BaseModel):
    """Sinyal actionable yang sangat spesifik (e.g. lowongan kerja, pendanaan)."""
    title:          str
    date:           str
    source:         str
    summary:        str
    url:            str
    signal_type:    str  # "hiring", "money", dll.
    verifiedAmount: Optional[str] = None
    verifiedDate:   Optional[str] = None


class CampaignProgress(BaseModel):
    """Status penyelesaian setiap milestone campaign (dikelola oleh Frontend)."""
    recon:   bool = False
    match:   bool = False
    craft:   bool = False
    polish:  bool = False
    launch:  bool = False
    pulse:   bool = False


# ── Core domain models ─────────────────────────────────────────────────────────

class CompanyProfile(BaseModel):
    """
    Profil lengkap perusahaan target — ini adalah objek utama yang dikembalikan
    endpoint POST /api/recon dan dikirim sebagai input ke /api/match & /api/craft.
    """
    id:           str
    url:          str
    name:         str
    industry:     str
    size:         str  = ""
    founded:      str  = ""
    hq:           str  = ""
    description:    str  = ""
    confidenceScore: str = "HIGH"
    marketRegion: Optional[str] = Field(None, description="Detected market region (id, sg, my)")
    salesTriggers: Optional[SalesTriggers] = None
    verifiedCapabilities: Optional[VerifiedCapabilities] = None
    deepInsights:   list[str]               = []
    strategicReport: Optional[StrategicReport] = None
    reconMode:      Optional[ReconMode]     = None
    linkedin:     LinkedInInfo
    contacts:    list[PicContact]  = []
    painPoints:  list[PainPoint]   = []
    news:        list[NewsItem]    = []
    intentSignals: list[IntentSignal] = []
    anomalies:          list[Anomaly] = []
    situationalSummary: str           = ""
    campaignProgress: CampaignProgress = Field(default_factory=CampaignProgress)
    createdAt:   str = ""
    cachedAt:    str = ""


# ── Request / Response payloads ────────────────────────────────────────────────

class ReconRequest(BaseModel):
    """POST /api/recon — request body dari Frontend.

    Note: user_id is NOT accepted from the body. Identity is derived from the
    JWT via get_current_user dependency to prevent cross-user impersonation.
    """
    url:  str
    mode: ReconMode = ReconMode.free


class ReconResponse(CompanyProfile):
    """
    POST /api/recon — response body.
    Identik dengan CompanyProfile; alias ini memperjelas kontrak di router.
    `cache_hit=True` artinya profil diambil dari recon_cache, bukan dari
    pipeline AI baru — credit tidak dipotong.
    """
    tokens_used: Optional[int] = None
    cache_hit:   bool = False


# ── Match ──────────────────────────────────────────────────────────────────────

class ProductCatalogItem(BaseModel):
    """Satu item produk dalam katalog internal."""
    id:             str
    name:           str
    tagline:        str
    description:    str
    price:          str
    painCategories: list[PainCategory] = []
    usp:            list[str]          = []
    source:         ProductSource      = ProductSource.manual
    createdAt:      str = ""
    updatedAt:      str = ""


class ProductMatch(ProductCatalogItem):
    """Hasil AI matching — extends ProductCatalogItem dengan skor dan reasoning."""
    matchScore:           int  = Field(default=0, ge=0, le=100)
    addressedPainIndices: list[int] = []
    reasoning:            str  = ""
    isRecommended:        bool = False


class MatchRequest(BaseModel):
    """POST /api/match — request body dari Frontend."""
    companyProfile: CompanyProfile
    campaign_id:    Optional[str] = None
    user_id:        Optional[str] = None


class MatchResponse(BaseModel):
    """
    POST /api/match — response body.

    Wrapping matches di dalam object agar bisa membawa `tokens_used` untuk
    frontend (campaign_id belum ada saat Match, jadi backend belum bisa
    menulis langsung ke campaign_analytics).
    """
    matches:     list[ProductMatch]
    tokens_used: int = 0


# ── Craft ──────────────────────────────────────────────────────────────────────

class CampaignEmail(BaseModel):
    """Satu draft email dalam sequence campaign."""
    id:             Optional[str] = None
    sequenceNumber: int
    dayLabel:       str
    scheduledDay:   int
    subject:        str
    body:           str
    tone:           CampaignTone = CampaignTone.profesional
    isApproved:     bool         = False


class Campaign(BaseModel):
    """Hasil generate campaign dari endpoint POST /api/craft."""
    reasoning:     str
    targetCompany: str
    createdAt:     str           = ""
    emails:        list[CampaignEmail] = []


class CraftRequest(BaseModel):
    """POST /api/craft — request body dari Frontend."""
    companyProfile:  CompanyProfile
    selectedProduct: ProductMatch
    token_recon:     Optional[int] = 0
    token_match:     Optional[int] = 0
    campaign_id:     Optional[str] = None
    user_id:         Optional[str] = None


class CraftResponse(Campaign):
    """
    POST /api/craft — response body.
    Identik dengan Campaign; alias ini memperjelas kontrak di router.
    """
    pass


class RewriteRequest(BaseModel):
    """POST /api/craft/rewrite — request body dari Frontend."""
    targetCompany:     str
    originalSubject:   str
    originalBody:      str
    campaignReasoning: str
    newTone:           str
    sequenceNumber:    int
    campaign_id:       Optional[str] = None
    user_id:           Optional[str] = None


class RewriteResponse(BaseModel):
    """POST /api/craft/rewrite — response body."""
    subject: str
    body:    str
    tone:    str


# ── Error ──────────────────────────────────────────────────────────────────────

class ErrorDetail(BaseModel):
    """Standar error payload — ditangkap oleh Frontend sebagai Alert."""
    detail: str
