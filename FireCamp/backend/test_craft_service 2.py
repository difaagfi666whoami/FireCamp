import asyncio
from app.services.craft_service import generate_campaign_emails

async def main():
    company_data = {
        "name": "Indoinfo CyberQuote Indonesia",
        "industry": "Fintech",
        "hq": "Jakarta",
        "description": "Provider data keuangan",
        "painPoints": [{"issue": "Test pain point", "severity": "high", "category": "Operations"}],
        "deepInsights": ["Test insight"],
        "strategicReport": {
            "strategicTitle": "Test title",
            "executiveInsight": "Test executive insight",
            "internalCapabilities": "Test capabilities",
            "marketDynamics": "Test dynamics",
            "strategicRoadmap": ["Test roadmap"]
        }
    }
    product_data = {
        "name": "Test Product",
        "tagline": "Best product",
        "description": "Test description",
        "price": "100",
        "usp": ["USP 1", "USP 2"],
        "matchScore": 90,
        "reasoning": "Because it is good",
        "addressedPainIndices": [0]
    }
    try:
        res = await generate_campaign_emails(company_data, product_data)
        print("RESULT:")
        import json
        print(json.dumps(res, indent=2))
    except Exception as e:
        print("ERROR:", e)

if __name__ == "__main__":
    asyncio.run(main())
