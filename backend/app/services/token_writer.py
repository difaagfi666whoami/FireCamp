"""
token_writer.py — Shared helper untuk menulis token usage ke Supabase.

Semua router memanggil write_token() setelah AI call selesai.
Non-fatal: jika gagal, hanya log warning — pipeline tetap berjalan.
"""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_IDR_PER_TOKEN = 0.000163  # ~Rp per token (GPT-4o $10/1M tokens, kurs Rp 16.300)


async def write_token(
    campaign_id: str,
    field: str,      # "token_recon" | "token_match" | "token_craft" | "token_polish"
    tokens: int,
) -> None:
    """
    Tulis atau AKUMULASI token ke campaign_analytics.

    Untuk token_polish, nilainya di-increment (karena user bisa rewrite
    beberapa kali). Untuk field lain, nilainya di-overwrite.

    Jika campaign_id tidak ditemukan di campaign_analytics, skip silently.
    """
    supabase_url = settings.NEXT_PUBLIC_SUPABASE_URL
    supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY

    if not supabase_url or not supabase_key:
        logger.warning("[token_writer] SKIP — SUPABASE_URL atau SERVICE_ROLE_KEY kosong")
        return

    if not campaign_id or tokens <= 0:
        return

    rest_url = f"{supabase_url}/rest/v1/campaign_analytics"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            rest_url,
            params={
                "campaign_id": f"eq.{campaign_id}",
                "select": "token_recon,token_match,token_craft,token_polish,estimated_cost_idr",
            },
            headers=headers,
        )
        resp.raise_for_status()
        rows = resp.json()

        if not rows:
            logger.warning("[token_writer] campaign_id=%s not found in campaign_analytics", campaign_id)
            return

        current = rows[0]

        if field == "token_polish":
            new_value = (current.get("token_polish") or 0) + tokens
        else:
            new_value = tokens

        token_recon  = new_value if field == "token_recon"  else (current.get("token_recon")  or 0)
        token_match  = new_value if field == "token_match"  else (current.get("token_match")  or 0)
        token_craft  = new_value if field == "token_craft"  else (current.get("token_craft")  or 0)
        token_polish = new_value if field == "token_polish" else (current.get("token_polish") or 0)
        total = token_recon + token_match + token_craft + token_polish

        update_resp = await client.patch(
            rest_url,
            params={"campaign_id": f"eq.{campaign_id}"},
            headers={**headers, "Prefer": "return=minimal"},
            json={
                field: new_value,
                "estimated_cost_idr": round(total * _IDR_PER_TOKEN),
            },
        )
        update_resp.raise_for_status()

    logger.info(
        "[token_writer] OK | campaign=%s field=%s tokens=%d total=%d idr=%d",
        campaign_id, field, new_value, total, round(total * _IDR_PER_TOKEN),
    )
