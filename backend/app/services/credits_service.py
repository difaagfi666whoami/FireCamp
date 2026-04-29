"""
credits_service.py — wrapper around Supabase RPC for credit balance ops.

The actual ledger logic lives in two SQL functions (see migration 019):
  - debit_credits(user_id, amount, description)  → bool
  - credit_credits(user_id, amount, type, description, stripe_session_id) → bool

This module is the only place backend code touches credits. Routers call
`debit()` before doing AI work; if it returns False they raise HTTPException.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _headers() -> dict[str, str]:
    return {
        "apikey":        settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type":  "application/json",
    }


def _rpc_url(fn_name: str) -> str:
    base = settings.NEXT_PUBLIC_SUPABASE_URL.rstrip("/")
    return f"{base}/rest/v1/rpc/{fn_name}"


async def get_balance(user_id: str) -> int:
    """Fetch the current credit balance for a user. Returns 0 if no row exists."""
    base = settings.NEXT_PUBLIC_SUPABASE_URL.rstrip("/")
    url = f"{base}/rest/v1/user_credits?user_id=eq.{user_id}&select=balance"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers=_headers())
            resp.raise_for_status()
            rows = resp.json()
            return int(rows[0]["balance"]) if rows else 0
    except Exception as exc:
        logger.error("[credits] get_balance FAILED user=%s: %s", user_id, exc)
        return 0


async def debit(user_id: str, amount: int, description: str) -> bool:
    """
    Deduct `amount` credits atomically. Returns True on success, False if
    balance is insufficient or the call failed (router treats both as 402).
    """
    if amount <= 0:
        return True  # nothing to debit

    payload = {"p_user_id": user_id, "p_amount": amount, "p_description": description}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(_rpc_url("debit_credits"), headers=_headers(), json=payload)
            resp.raise_for_status()
            ok = bool(resp.json())
            logger.info(
                "[credits] debit %s credits (user=%s, %s) → %s",
                amount, user_id, description, "OK" if ok else "INSUFFICIENT",
            )
            return ok
    except Exception as exc:
        logger.error("[credits] debit FAILED user=%s amount=%d: %s", user_id, amount, exc)
        return False


async def grant(
    user_id:           str,
    amount:            int,
    description:       str,
    tx_type:           str = "purchase",
    stripe_session_id: Optional[str] = None,
) -> bool:
    """Add credits. Idempotent on stripe_session_id."""
    payload: dict[str, Any] = {
        "p_user_id":           user_id,
        "p_amount":            amount,
        "p_type":              tx_type,
        "p_description":       description,
        "p_stripe_session_id": stripe_session_id,
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(_rpc_url("credit_credits"), headers=_headers(), json=payload)
            resp.raise_for_status()
            ok = bool(resp.json())
            logger.info(
                "[credits] grant %s credits (user=%s, type=%s, session=%s) → %s",
                amount, user_id, tx_type, stripe_session_id, "OK" if ok else "DUPLICATE",
            )
            return ok
    except Exception as exc:
        logger.error("[credits] grant FAILED user=%s amount=%d: %s", user_id, amount, exc)
        return False
