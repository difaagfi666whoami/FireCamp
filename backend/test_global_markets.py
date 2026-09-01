"""
test_global_markets.py — Verifikasi Deteksi & Konfigurasi Pasar Regional ASEAN.

Mencakup:
  1. test_market_detection: Deteksi domain .co.id, .com.sg, .com.my, .com.
  2. test_sg_patterns: Verifikasi pola subpage untuk Singapura (/about-us, /product/).
  3. test_sg: Uji ekstraksi subpage URL asinkron untuk cyberquote.com.sg.
"""

import sys
import os
import asyncio

# Setup sys.path agar mendukung import baik 'backend.app...' maupun 'app...'
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)

for path in [PROJECT_ROOT, CURRENT_DIR]:
    if path not in sys.path:
        sys.path.insert(0, path)

try:
    from backend.app.services.market_service import detect_market, get_market_config, MarketRegion
    from backend.app.services.lane_f_service import select_target_subpage_urls
    from backend.app.services.lane_a_service import analyze_company_context
except ImportError:
    from app.services.market_service import detect_market, get_market_config, MarketRegion
    from app.services.lane_f_service import select_target_subpage_urls
    from app.services.lane_a_service import analyze_company_context


def test_market_detection():
    print("\n--- Test 1: Deteksi Wilayah Pasar (Market Detection) ---")
    assert detect_market("https://example.co.id") == MarketRegion.INDONESIA
    assert detect_market("https://example.com.sg") == MarketRegion.SINGAPORE
    assert detect_market("https://example.com.my") == MarketRegion.MALAYSIA
    assert detect_market("https://example.com") == None  # Unknown

    # Variasi URL
    assert detect_market("cyberquote.com.sg") == MarketRegion.SINGAPORE
    assert detect_market("http://subdomain.company.my/about") == MarketRegion.MALAYSIA
    assert detect_market("https://tech.web.id") == MarketRegion.INDONESIA
    print("  ✓ example.co.id  => MarketRegion.INDONESIA")
    print("  ✓ example.com.sg => MarketRegion.SINGAPORE")
    print("  ✓ example.com.my => MarketRegion.MALAYSIA")
    print("  ✓ example.com    => None (Unknown)")
    print("PASS: Deteksi pasar regional 100% akurat.")


def test_sg_patterns():
    print("\n--- Test 2: Pola Sub-halaman Pasar Singapura (SG Patterns) ---")
    config = get_market_config("https://cyberquote.com.sg")
    assert "/about-us" in config.subpage_patterns["about"]
    assert "/product/" in config.subpage_patterns["products"]
    assert config.language == "English"
    assert config.currency == "SGD"
    assert config.currency_symbol == "S$"
    assert config.currencySymbol == "S$"

    print("  ✓ /about-us terdaftar di pola 'about' Singapura")
    print("  ✓ /product/ terdaftar di pola 'products' Singapura")
    print(f"  ✓ Konfigurasi mata uang: {config.currency} ({config.currency_symbol}) | Bahasa: {config.language}")
    print("PASS: Konfigurasi pasar Singapura sesuai spesifikasi.")


async def test_sg():
    print("\n--- Test 3: Ekstraksi Subpage Cyberquote.com.sg (Async Subpage Selection) ---")
    url = "https://cyberquote.com.sg/"
    sample_homepage = """
    <html>
      <head><title>CyberQuote Singapore - Financial & FinTech Solutions</title></head>
      <body>
        <nav>
          <a href="/about-us/">About Us</a>
          <a href="/product/">Products & Solutions</a>
          <a href="/services">Services</a>
          <a href="/contact-us/">Contact Us</a>
        </nav>
        <div>Welcome to CyberQuote Singapore</div>
      </body>
    </html>
    """
    urls = await select_target_subpage_urls(url, sample_homepage)
    print(f"  Found URLs: {urls}")

    # Expected: Should find /about-us/, /product/, /contact-us/
    has_about = any("about" in u for u in urls)
    has_product = any("product" in u for u in urls)
    has_contact = any("contact" in u for u in urls)

    assert has_about, "Harus menemukan URL about"
    assert has_product, "Harus menemukan URL product"
    assert has_contact, "Harus menemukan URL contact"

    # Uji juga jika homepage kosong (fallback candidates)
    fallback_urls = await select_target_subpage_urls(url, "")
    print(f"  Fallback URLs: {fallback_urls}")
    assert any("about" in u for u in fallback_urls)
    assert any("product" in u for u in fallback_urls)
    assert any("contact" in u for u in fallback_urls)

    print("  ✓ /about-us/, /product/, dan /contact-us/ berhasil ditemukan")
    print("PASS: Subpage discovery untuk Singapura bekerja sempurna.")


def test_market_context_prompt():
    print("\n--- Test 4: Prompt Konteks Pasar Lane A ---")
    prompt_sg = analyze_company_context(
        "https://cyberquote.com.sg",
        "CyberQuote Pte Ltd",
        "cyberquote.com.sg"
    )
    assert "English" in prompt_sg
    assert "S$" in prompt_sg

    prompt_id = analyze_company_context(
        "https://kreasidigital.co.id",
        "Kreasi Digital",
        "kreasidigital.co.id"
    )
    assert "Bahasa Indonesia" in prompt_id
    assert "Rp" in prompt_id

    print("  ✓ Singapura menggunakan prompt English & simbol S$")
    print("  ✓ Indonesia menggunakan prompt Bahasa Indonesia & simbol Rp")
    print("PASS: Prompt intelijen adaptif pasar berfungsi.")


def main():
    print("==================================================")
    print("   VERIFIKASI ASEAN EXPANSION (GLOBAL MARKETS)    ")
    print("==================================================")
    test_market_detection()
    test_sg_patterns()
    asyncio.run(test_sg())
    test_market_context_prompt()
    print("\n🎉 SEMUA TEST PASAR GLOBAL SUKSES (100% PASSED)!")


if __name__ == "__main__":
    main()
