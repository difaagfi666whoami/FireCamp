import asyncio
from app.services.supabase_client import get_supabase
import json

async def main():
    try:
        supabase = get_supabase()
        camp = supabase.table("campaigns").select("*").order("created_at", desc=True).limit(1).execute()
        print("CAMPAIGNS:")
        print(json.dumps(camp.data, indent=2))
        
        if camp.data:
            c_id = camp.data[0]["id"]
            emails = supabase.table("campaign_emails").select("*").eq("campaign_id", c_id).execute()
            print("EMAILS:")
            print(json.dumps(emails.data, indent=2))
    except Exception as e:
        print("ERROR:", e)

if __name__ == "__main__":
    asyncio.run(main())
