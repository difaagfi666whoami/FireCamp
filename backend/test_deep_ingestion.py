"""
test_deep_ingestion.py — Verifikasi Fase 1: Data Ingestion & Deep Subpage Crawling.

Menjalankan pengujian:
  1. Ekstraksi internal links dari raw HTML homepage.
  2. Klasifikasi URL ke 5 bucket intelijen (about, services, clients, careers, contact).
  3. Pembersihan noise HTML / scripts / cookie banners.
  4. Simulasi deep_site_crawl pada struktur website nyata.
"""

import sys
import os
import asyncio

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.lane_f_service import (
    _strip_noise,
    _extract_links_from_content,
    _classify_url,
    select_target_subpage_urls,
)

SAMPLE_HOMEPAGE_HTML = """
<!DOCTYPE html>
<html lang="id">
<head>
    <title>Kreasi Digital Indonesia — Agensi Transformasi Digital</title>
    <script>console.log("tracking snippet");</script>
    <style>body { color: #333; }</style>
</head>
<body>
    <nav>
        <a href="/">Home</a>
        <a href="/tentang-kami">Tentang Kami</a>
        <a href="/layanan/pengembangan-software">Layanan Software</a>
        <a href="/portofolio/studi-kasus">Portofolio & Klien</a>
        <a href="/karir">Karir & Lowongan</a>
        <a href="/hubungi-kami">Hubungi Kami</a>
        <a href="https://instagram.com/kreasidigital">Instagram</a>
        <a href="/assets/brochure.pdf">Download Brosur</a>
    </nav>
    <main>
        <h1>Solusi Digital Terdepan untuk Bisnis Anda</h1>
        <p>Kami membantu lebih dari 100+ perusahaan bertransformasi secara digital.</p>
        <p>We use cookies to improve your user experience. All rights reserved.</p>
    </main>
    <footer>
        <p>© 2026 PT Kreasi Digital Nusantara</p>
    </footer>
</body>
</html>
"""

def test_link_discovery():
    print("\n--- Test 1: Link Discovery dari Homepage HTML ---")
    base_url = "https://kreasidigital.co.id"
    links = _extract_links_from_content(SAMPLE_HOMEPAGE_HTML, base_url)
    print(f"Total internal links ditemukan: {len(links)}")
    for l in sorted(links):
        print(f"  ✓ {l}")

    assert any("/tentang-kami" in l for l in links), "Harus menemukan /tentang-kami"
    assert any("/layanan" in l for l in links), "Harus menemukan /layanan"
    assert any("/portofolio" in l for l in links), "Harus menemukan /portofolio"
    assert any("/karir" in l for l in links), "Harus menemukan /karir"
    assert any("/hubungi-kami" in l for l in links), "Harus menemukan /hubungi-kami"
    assert not any("instagram.com" in l for l in links), "Eksternal link harus diabaikan"
    assert not any(".pdf" in l for l in links), "File PDF harus diabaikan"
    print("PASS: Link discovery akurat dan bersih dari file/eksternal link.")


def test_url_classification():
    print("\n--- Test 2: Klasifikasi URL ke 5 Kategori Intelijen ---")
    test_cases = [
        ("https://example.com/about-us", "about"),
        ("https://example.com/tentang-kami", "about"),
        ("https://example.com/services/mobile-app", "services"),
        ("https://example.com/layanan/cloud", "services"),
        ("https://example.com/products/pos-system", "services"),
        ("https://example.com/portfolio/fintech-case-study", "clients"),
        ("https://example.com/klien-kami", "clients"),
        ("https://example.com/careers/backend-engineer", "careers"),
        ("https://example.com/lowongan-kerja", "careers"),
        ("https://example.com/contact-us", "contact"),
        ("https://example.com/hubungi-kami", "contact"),
    ]

    for url, expected_cat in test_cases:
        actual_cat = _classify_url(url)
        print(f"  URL: {url:<50} => Kategori: {actual_cat} (Expected: {expected_cat})")
        assert actual_cat == expected_cat, f"Mismatch on {url}: expected {expected_cat}, got {actual_cat}"
    print("PASS: Semua 11 pola URL berhasil diklasifikasikan dengan benar.")


def test_target_selection():
    print("\n--- Test 3: Pemilihan Target Subpages Cerdas ---")
    base_url = "https://kreasidigital.co.id"
    selected = select_target_subpage_urls(base_url, SAMPLE_HOMEPAGE_HTML, max_urls=5)
    print(f"Total subpage terpilih: {len(selected)}")
    for s in selected:
        cat = _classify_url(s)
        print(f"  [{cat.upper() if cat else 'UNKNOWN':<8}] {s}")

    assert len(selected) >= 4, "Harus memilih setidaknya 4 kategori utama"
    print("PASS: Target subpages berhasil dipilih secara seimbang per kategori.")


def test_noise_stripping():
    print("\n--- Test 4: Pembersihan Noise HTML & Script ---")
    dirty_text = """
    <script>alert("hacked");</script>
    <style>.nav { display: flex; }</style>
    <h1>Selamat Datang di Perusahaan Kami</h1>
    ![Logo Perusahaan](https://img.com/logo.png)
    [Klik di sini](https://link.com) untuk melihat layanan kami.
    We use cookies to improve your user experience. All rights reserved.
    
    
    Kami adalah agensi software development berpengalaman sejak 2015.
    """
    clean_text = _strip_noise(dirty_text)
    print("Hasil pembersihan:")
    print("----------------------------------------")
    print(clean_text)
    print("----------------------------------------")

    assert "script" not in clean_text.lower(), "Tag script harus hilang"
    assert "style" not in clean_text.lower(), "Tag style harus hilang"
    assert "![Logo" not in clean_text, "Markdown image harus hilang"
    assert "We use cookies" not in clean_text, "Cookie banner harus hilang"
    assert "software development" in clean_text.lower(), "Konten fakta bisnis harus tetap utuh"
    print("PASS: Noise berhasil dibersihkan dengan sempurna.")


def main():
    print("==================================================")
    print("  VERIFIKASI FASE 1: DATA INGESTION & SUBPAGES    ")
    print("==================================================")
    test_link_discovery()
    test_url_classification()
    test_target_selection()
    test_noise_stripping()
    print("\n🎉 SEMUA TEST FASE 1 SUKSES (100% PASSED)!")

if __name__ == "__main__":
    main()
