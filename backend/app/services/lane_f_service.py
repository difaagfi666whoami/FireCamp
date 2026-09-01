"""
lane_f_service.py — Deep Site Crawl via Dynamic Link Discovery & Multi-URL Extract.

Homepage saja seringkali tidak cukup. Halaman /about, /products, /services,
/careers, /clients membawa sinyal jauh lebih kaya: tim manajemen,
katalog produk lengkap, daftar klien, posisi yang sedang dibuka.

Arsitektur:
  1. Link Discovery: Parse internal links dari homepage raw HTML/markdown.
  2. Bucket Classification: Petakan URL ke 5 kategori intelijen (about, services, clients, careers, contact).
  3. Smart Fallback Probing: Jika link tidak ditemukan di HTML, probe candidate paths terpopuler.
  4. Batch Extraction: Extract multi-URL secara efisien via Tavily API.
  5. Deep Cleaning: Bersihkan nav/footer/script noise, simpan hingga 5.000 karakter per sub-halaman.
  6. Ground Truth Compilation: Hasilkan kompilasi teks terstruktur yang siap dikonsumsi LLM.
"""

from __future__ import annotations

import logging
import re
from urllib.parse import urljoin, urlparse
from typing import Any

logger = logging.getLogger(__name__)


class AwaitableList(list):
    """
    Subclass list yang dapat digunakan baik secara synchronous (seperti list biasa)
    maupun di-await: `urls = await select_target_subpage_urls(...)`.
    Memastikan 100% backward compatibility.
    """
    def __await__(self):
        async def _coro():
            return self
        return _coro().__await__()


try:
    from app.services.market_service import get_market_config
except ImportError:
    try:
        from backend.app.services.market_service import get_market_config
    except ImportError:
        get_market_config = None


# Kategori & kata kunci URL untuk klasifikasi sub-halaman
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "about": [
        "about", "about-us", "tentang", "tentang-kami", "company", "perusahaan",
        "our-story", "who-we-are", "profil", "profile", "team", "leadership",
        "direksi", "manajemen", "management"
    ],
    "services": [
        "services", "layanan", "products", "produk", "solutions", "solusi",
        "offerings", "features", "fitur", "pricing", "harga", "plans"
    ],
    "clients": [
        "clients", "klien", "portfolio", "portofolio", "case-studies", "studi-kasus",
        "customers", "pelanggan", "projects", "proyek", "our-work", "works",
        "testimonials", "testimoni"
    ],
    "careers": [
        "careers", "karir", "jobs", "lowongan", "lowongan-kerja", "join-us",
        "work-with-us", "we-are-hiring", "rekrutmen", "hiring"
    ],
    "contact": [
        "contact", "hubungi-kami", "contact-us", "kontak", "location", "lokasi",
        "address", "alamat"
    ],
}

# Fallback path kandidat jika link tidak terdeteksi dari homepage
CANDIDATE_PATHS: dict[str, list[str]] = {
    "about": ["/about", "/about-us", "/tentang-kami", "/tentang", "/company"],
    "services": ["/services", "/layanan", "/products", "/solutions", "/produk"],
    "clients": ["/clients", "/portfolio", "/portofolio", "/case-studies", "/klien"],
    "careers": ["/careers", "/karir", "/jobs", "/lowongan"],
    "contact": ["/contact", "/contact-us", "/hubungi-kami"],
}


def _strip_noise(text: str) -> str:
    """
    Bersihkan markdown, HTML, nav, cookie banners, script noise dari raw_content Tavily.
    Menghasilkan teks murni yang padat informasi bisnis.
    """
    if not text:
        return ""
    # Hapus tag script & style
    text = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # Hapus gambar markdown & tag HTML
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"<[^>]+>", " ", text)
    # Hapus cookie banner / privacy policy boilerplate umum
    text = re.sub(r"(?i)(we use cookies|cookie policy|all rights reserved|privacy policy|syarat dan ketentuan).*?\n", "", text)
    # Normalisasi spasi dan baris baru
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def _normalize_domain(url: str) -> str:
    """Ambil domain bersih dari URL."""
    parsed = urlparse(url if "://" in url else f"https://{url}")
    return re.sub(r"^www\.", "", (parsed.netloc or parsed.path).lower())


def _extract_links_from_content(raw_content: str, base_url: str) -> list[str]:
    """
    Ekstrak seluruh URL internal dari raw HTML / markdown homepage.
    """
    target_domain = _normalize_domain(base_url)
    discovered: set[str] = set()

    # 1. Regex untuk <a href="...">
    html_links = re.findall(r'<a\s+(?:[^>]*?\s+)?href=["\']([^"\']+)["\']', raw_content, re.IGNORECASE)
    # 2. Regex untuk markdown [text](url)
    md_links = re.findall(r'\[(?:[^\]]*)\]\((https?://[^\s\)]+|/[^\s\)]+)\)', raw_content)

    all_raw_links = html_links + md_links

    for link in all_raw_links:
        link = link.strip()
        if not link or link.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
            continue

        # Abaikan file non-webpage
        if re.search(r"\.(png|jpg|jpeg|gif|svg|webp|pdf|zip|mp4|css|js)$", link, re.IGNORECASE):
            continue

        full_url = urljoin(base_url, link)
        parsed = urlparse(full_url)
        link_domain = _normalize_domain(parsed.netloc)

        # Hanya ambil internal domain link
        if link_domain == target_domain and parsed.path and parsed.path != "/":
            clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path.rstrip('/')}"
            discovered.add(clean_url)

    return list(discovered)


def _classify_url(url: str, custom_patterns: dict[str, list[str]] | None = None) -> str | None:
    """Klasifikasikan URL ke salah satu kategori intelijen."""
    path_lower = urlparse(url).path.lower()
    patterns = custom_patterns or CATEGORY_KEYWORDS
    for category, keywords in patterns.items():
        for kw in keywords:
            clean_kw = kw.strip("/").lower()
            if not clean_kw:
                continue
            if (
                f"/{clean_kw}" in path_lower
                or f"-{clean_kw}" in path_lower
                or f"_{clean_kw}" in path_lower
                or path_lower.endswith(f"/{clean_kw}")
                or path_lower.endswith(f"/{clean_kw}/")
                or path_lower == f"/{clean_kw}"
            ):
                return category
    return None


def select_target_subpage_urls(
    base_url: str,
    homepage_raw_content: str = "",
    max_urls: int = 6,
) -> AwaitableList:
    """
    Pilih 4-6 URL sub-halaman paling bernilai tinggi dengan pemahaman konteks pasar regional:
    1. Deteksi konfigurasi pasar (Indonesia, Singapura, Malaysia, Global).
    2. Mencari link internal nyata dari homepage.
    3. Jika ada kategori kosong, probe path kandidat terpopuler sesuai pasar.
    
    Returns:
        AwaitableList yang dapat dipanggil sinkron atau di-await (100% backward compatible).
    """
    base = base_url.rstrip("/")
    if not base.startswith("http"):
        base = f"https://{base}"

    # Deteksi pola pasar regional
    market_cfg = get_market_config(base_url) if get_market_config else None
    effective_candidates = market_cfg.subpage_patterns if (market_cfg and market_cfg.subpage_patterns) else CANDIDATE_PATHS

    discovered_links = _extract_links_from_content(homepage_raw_content, base) if homepage_raw_content else []
    
    selected_by_category: dict[str, str] = {}

    # 1. Klasifikasikan link internal yang ditemukan
    for link in discovered_links:
        category = _classify_url(link, effective_candidates)
        if category and category not in selected_by_category:
            selected_by_category[category] = link

    # 2. Untuk kategori penting yang belum ada, gunakan fallback kandidat terpopuler per pasar
    for category, candidates in effective_candidates.items():
        if category not in selected_by_category and candidates:
            # Format candidate path
            cand_path = candidates[0]
            if not cand_path.startswith("/"):
                cand_path = f"/{cand_path}"
            selected_by_category[category] = f"{base}{cand_path}"

    # Prioritaskan urutan intelijen: products -> services -> about -> clients -> careers -> contact
    priority_order = ["products", "services", "about", "clients", "careers", "contact"]
    final_urls: list[str] = []

    for cat in priority_order:
        if cat in selected_by_category and selected_by_category[cat] not in final_urls:
            final_urls.append(selected_by_category[cat])
            if len(final_urls) >= max_urls:
                break

    return AwaitableList(final_urls)


async def deep_site_crawl(
    base_url: str,
    homepage_raw_content: str = "",
    *,
    max_urls: int = 6,
    snippet_chars: int = 5000,
) -> dict[str, Any]:
    """
    Ekstraksi mendalam multi-URL sub-halaman pada domain target.

    Args:
        base_url:             URL homepage target.
        homepage_raw_content: Raw HTML / Markdown homepage dari Step 0 (jika ada).
        max_urls:             Maksimal subpage yang diekstrak (default 6).
        snippet_chars:        Maksimal karakter per subpage yang disimpan (default 5000).

    Returns:
        Dict berisi: about, services, clients, careers, contact, raw_pages, ground_truth_text.
    """
    logger.info("[lane_f] START | base=%r", base_url)

    target_urls = select_target_subpage_urls(base_url, homepage_raw_content, max_urls=max_urls)
    logger.info("[lane_f] Selected %d subpage URLs: %s", len(target_urls), target_urls)

    output: dict[str, Any] = {
        "about":              "",
        "services":           "",
        "clients":            "",
        "careers":            "",
        "contact":            "",
        "raw_pages":          [],
        "ground_truth_text":  "",
    }

    if not target_urls:
        return output

    try:
        from app.services import tavily_service
        resp = await tavily_service.extract(target_urls)
    except Exception as exc:
        logger.warning("[lane_f] Tavily extract FAILED: %s", exc)
        return output

    results = resp.get("results", []) or []
    pages_found = 0
    ground_truth_blocks: list[str] = []

    for r in results:
        url = r.get("url", "")
        content = r.get("raw_content") or ""
        if not content:
            continue

        clean = _strip_noise(content)
        if len(clean) < 80:  # Abaikan halaman kosong / 404 text pendek
            continue

        category = _classify_url(url) or "other"
        snippet = clean[:snippet_chars]

        output["raw_pages"].append({
            "url": url,
            "category": category,
            "content": snippet,
        })

        # Simpan ke bucket kategori yang sesuai jika belum terisi
        if category in output and not output[category]:
            output[category] = snippet
            pages_found += 1

        # Tambahkan ke kompilasi ground truth
        header_label = category.upper() if category != "other" else "SUBPAGE"
        ground_truth_blocks.append(f"### [SUMBER RESMI: {header_label}] ({url})\n{snippet}")

    output["ground_truth_text"] = "\n\n".join(ground_truth_blocks)

    logger.info(
        "[lane_f] DONE | categorized=%d total_pages=%d ground_truth_chars=%d",
        pages_found, len(output["raw_pages"]), len(output["ground_truth_text"]),
    )
    return output

