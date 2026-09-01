"""
market_service.py — Deteksi & Konfigurasi Pasar Regional ASEAN (Indonesia, Singapura, Malaysia).

Mendukung ekspansi platform Campfire B2B Outreach ke pasar regional dengan:
  1. Deteksi wilayah pasar (MarketRegion) berdasarkan domain / TLD.
  2. Konfigurasi pasar (MarketConfig): bahasa prompt AI, simbol mata uang,
     platform sosial populer, batas keyakinan (confidence thresholds),
     serta pola sub-halaman lokal.
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Optional
from urllib.parse import urlparse
from dataclasses import dataclass, field


class MarketRegion(str, Enum):
    INDONESIA = "id"
    SINGAPORE = "sg"
    MALAYSIA  = "my"
    THAILAND  = "th"
    VIETNAM   = "vn"
    GLOBAL    = "global"


@dataclass
class MarketConfig:
    region: MarketRegion
    tlds: list[str] = field(default_factory=list)
    language: str = "Bahasa Indonesia"
    currency: str = "IDR"
    currency_symbol: str = "Rp"
    social_platforms: list[str] = field(default_factory=lambda: ["LinkedIn", "Instagram", "Facebook"])
    confidence_thresholds: dict[str, int] = field(
        default_factory=lambda: {"high": 80, "medium": 50, "low": 20}
    )
    subpage_patterns: dict[str, list[str]] = field(default_factory=dict)
    deep_search_domains: list[str] = field(default_factory=list)

    @property
    def currencySymbol(self) -> str:
        return self.currency_symbol

    @property
    def socialPlatforms(self) -> list[str]:
        return self.social_platforms

    @property
    def confidenceThresholds(self) -> dict[str, int]:
        return self.confidence_thresholds


# ─── Registry Konfigurasi Pasar Regional ──────────────────────────────────────

MARKET_CONFIGS: dict[MarketRegion, MarketConfig] = {
    MarketRegion.INDONESIA: MarketConfig(
        region=MarketRegion.INDONESIA,
        tlds=[".co.id", ".id", ".web.id", ".biz.id", ".or.id", ".ac.id", ".go.id"],
        language="Bahasa Indonesia",
        currency="IDR",
        currency_symbol="Rp",
        social_platforms=["LinkedIn", "Instagram", "WhatsApp", "Facebook"],
        confidence_thresholds={"high": 80, "medium": 50, "low": 20},
        subpage_patterns={
            "about": [
                "/tentang-kami", "/tentang", "/about", "/about-us", "/company",
                "/profil", "/profile", "/direksi", "/manajemen"
            ],
            "products": [
                "/produk", "/products", "/product/"
            ],
            "services": [
                "/layanan", "/services", "/solutions", "/solusi", "/offerings",
                "/harga", "/pricing"
            ],
            "clients": [
                "/klien", "/klien-kami", "/portfolio", "/portofolio",
                "/studi-kasus", "/case-studies", "/pelanggan", "/testimoni"
            ],
            "careers": [
                "/karir", "/lowongan", "/lowongan-kerja", "/careers", "/jobs",
                "/rekrutmen", "/join-us"
            ],
            "contact": [
                "/hubungi-kami", "/kontak", "/contact", "/contact-us", "/alamat"
            ],
        },
        deep_search_domains=["idx.co.id", "bisnis.com", "kontan.co.id", "katadata.co.id"],
    ),

    MarketRegion.SINGAPORE: MarketConfig(
        region=MarketRegion.SINGAPORE,
        tlds=[".com.sg", ".sg", ".org.sg", ".edu.sg", ".gov.sg", ".net.sg"],
        language="English",
        currency="SGD",
        currency_symbol="S$",
        social_platforms=["LinkedIn", "WhatsApp", "Twitter", "Facebook"],
        confidence_thresholds={"high": 85, "medium": 55, "low": 25},
        subpage_patterns={
            "about": [
                "/about-us", "/about-us/", "/about", "/company", "/who-we-are",
                "/our-story", "/leadership", "/team"
            ],
            "products": [
                "/product/", "/products", "/platform"
            ],
            "services": [
                "/services", "/solutions", "/offerings", "/capabilities",
                "/pricing"
            ],
            "clients": [
                "/clients", "/case-studies", "/our-work", "/customers", "/portfolio",
                "/testimonials"
            ],
            "careers": [
                "/careers", "/jobs", "/join-us", "/work-with-us", "/openings"
            ],
            "contact": [
                "/contact-us", "/contact-us/", "/contact", "/get-in-touch", "/location"
            ],
        },
        deep_search_domains=["sgx.com", "businesstimes.com.sg", "straitstimes.com"],
    ),

    MarketRegion.MALAYSIA: MarketConfig(
        region=MarketRegion.MALAYSIA,
        tlds=[".com.my", ".my", ".org.my", ".edu.my", ".gov.my", ".net.my"],
        language="English",
        currency="MYR",
        currency_symbol="RM",
        social_platforms=["LinkedIn", "WhatsApp", "Facebook", "Instagram"],
        confidence_thresholds={"high": 80, "medium": 50, "low": 20},
        subpage_patterns={
            "about": [
                "/about-us", "/about-us/", "/about", "/company", "/tentang-kami",
                "/who-we-are", "/our-story", "/management"
            ],
            "services": [
                "/services", "/products", "/solutions", "/perkhidmatan", "/offerings"
            ],
            "products": [
                "/product/", "/products", "/solutions", "/services"
            ],
            "clients": [
                "/clients", "/customers", "/portfolio", "/case-studies", "/projek"
            ],
            "careers": [
                "/careers", "/jobs", "/jawatan-kosong", "/join-us", "/kerjaya"
            ],
            "contact": [
                "/contact-us", "/contact-us/", "/contact", "/hubungi-kami"
            ],
        },
        deep_search_domains=["bursamalaysia.com", "theedgemarkets.com", "thestar.com.my"],
    ),
}

# Default / Fallback configuration untuk domain global (.com, .io, dsb.)
GLOBAL_CONFIG = MarketConfig(
    region=MarketRegion.GLOBAL,
    tlds=[".com", ".io", ".co", ".ai", ".net", ".org"],
    language="English",
    currency="USD",
    currency_symbol="$",
    social_platforms=["LinkedIn", "Twitter", "Facebook"],
    confidence_thresholds={"high": 80, "medium": 50, "low": 20},
    subpage_patterns={
        "about": ["/about-us", "/about", "/company", "/who-we-are", "/our-story"],
        "services": ["/services", "/solutions", "/products", "/offerings", "/pricing"],
        "products": ["/product/", "/products", "/solutions", "/services"],
        "clients": ["/clients", "/case-studies", "/customers", "/portfolio"],
        "careers": ["/careers", "/jobs", "/join-us", "/work-with-us"],
        "contact": ["/contact-us", "/contact", "/get-in-touch"],
    },
    deep_search_domains=["reuters.com", "bloomberg.com", "techcrunch.com"],
)


def _extract_netloc(url: str) -> str:
    """Ambil hostname bersih dari URL."""
    if not url:
        return ""
    parsed = urlparse(url if "://" in url else f"https://{url}")
    return (parsed.netloc or parsed.path.split("/")[0]).lower().strip()


def detect_market(url: str) -> Optional[MarketRegion]:
    """
    Deteksi wilayah pasar (MarketRegion) berdasarkan akhiran TLD pada domain.
    
    Contoh:
      detect_market("https://example.co.id")   -> MarketRegion.INDONESIA
      detect_market("https://example.com.sg")  -> MarketRegion.SINGAPORE
      detect_market("https://example.com.my")  -> MarketRegion.MALAYSIA
      detect_market("https://example.com")     -> None (Unknown)
    """
    if not url:
        return None

    hostname = _extract_netloc(url)
    if not hostname:
        return None

    # Hapus prefix www.
    hostname = re.sub(r"^www\.", "", hostname)

    # 1. Cek Singapura (.com.sg, .sg, .org.sg, .edu.sg, dsb.)
    if re.search(r"(?:\.(?:com|org|edu|gov|net))?\.sg$", hostname):
        return MarketRegion.SINGAPORE

    # 2. Cek Malaysia (.com.my, .my, .org.my, .edu.my, dsb.)
    if re.search(r"(?:\.(?:com|org|edu|gov|net))?\.my$", hostname):
        return MarketRegion.MALAYSIA

    # 3. Cek Indonesia (.co.id, .id, .web.id, .biz.id, .or.id, .ac.id, dsb.)
    if re.search(r"(?:\.(?:co|web|biz|or|ac|go|sch|mil))?\.id$", hostname):
        return MarketRegion.INDONESIA

    # 4. Cek Thailand (.co.th, .th, dsb.)
    if re.search(r"(?:\.(?:co|ac|or|go|in|mi|net))?\.th$", hostname):
        return MarketRegion.THAILAND

    # 5. Cek Vietnam (.vn, .com.vn, dsb.)
    if re.search(r"(?:\.(?:com|net|org|edu|gov))?\.vn$", hostname):
        return MarketRegion.VIETNAM

    return None


def get_market_config(url_or_region: str | MarketRegion | None) -> MarketConfig:
    """
    Ambil konfigurasi pasar berdasarkan URL atau MarketRegion.
    Jika URL tidak terdeteksi negaranya, mengembalikan konfigurasi default global.
    """
    if isinstance(url_or_region, MarketRegion):
        return MARKET_CONFIGS.get(url_or_region, GLOBAL_CONFIG)

    if isinstance(url_or_region, str):
        # Jika string berupa code region langsung ("id", "sg", "my")
        for region in MarketRegion:
            if url_or_region.lower() == region.value:
                return MARKET_CONFIGS.get(region, GLOBAL_CONFIG)

        detected = detect_market(url_or_region)
        if detected and detected in MARKET_CONFIGS:
            return MARKET_CONFIGS[detected]

    return GLOBAL_CONFIG
