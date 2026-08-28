import asyncio
import os
import sys

# Add the backend folder to PYTHONPATH
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services import apify_service
from app.core.config import settings

async def test():
    print(f"APIFY_API_TOKEN: {'SET' if settings.APIFY_API_TOKEN else 'MISSING'}")
    try:
        contacts = await apify_service.search_by_domain("ruangguru.com")
        print("\n=== HASIL APIFY GOOGLE SNIPPET ===")
        for c in contacts:
            print(c)
    except Exception as e:
        print(f"Error: {e}")

    print("\n--- Langsung panggil Apify API untuk debug ---")
    import httpx
    import json
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items",
            params={"token": settings.APIFY_API_TOKEN, "timeout": 45},
            json={
                "queries": 'site:linkedin.com/in "ruangguru.com" (VP OR "Head of" OR Director OR Manager OR CMO OR CTO OR COO)',
                "maxPagesPerQuery": 1,
                "resultsPerPage": 5,
            },
        )
        print("Status", resp.status_code)
        try:
            items = resp.json()
            for item in items:
                print("RAW ITEM KEYS:", list(item.keys()))
                if "organicResults" in item:
                    print("ORGANIC RESULTS:", len(item["organicResults"]))
                    for org in item["organicResults"]:
                        print("  =>", org.get("title"), org.get("url"))
                else:
                    print("- No organicResults, instead got:", item)
        except Exception as e:
            print("Failed to parse JSON:", e, resp.text[:200])

if __name__ == "__main__":
    asyncio.run(test())
