"""
xendit_service.py — low-level Xendit API wrappers.

Uses httpx (already in requirements) with Basic-auth using the Xendit secret key.
No Xendit SDK dependency needed — the REST API is straightforward.

Supported payment channels:
  - QRIS  (scan-to-pay via GoPay / OVO / DANA / ShopeePay)
  - Virtual Account — BCA, Mandiri, BNI, BRI, Permata
"""

from __future__ import annotations

import base64
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

XENDIT_API_BASE = "https://api.xendit.co"
QR_EXPIRY_MINUTES = 15
VA_EXPIRY_HOURS   = 24

SUPPORTED_VA_BANKS = {"BCA", "MANDIRI", "BNI", "BRI", "PERMATA"}


# ─── Auth helper ──────────────────────────────────────────────────────────────

def _auth_header() -> dict[str, str]:
    """Basic auth: XENDIT_SECRET_KEY as username, empty password."""
    if not settings.XENDIT_SECRET_KEY:
        raise RuntimeError(
            "XENDIT_SECRET_KEY belum dikonfigurasi. "
            "Set di .env.local lalu restart backend."
        )
    encoded = base64.b64encode(f"{settings.XENDIT_SECRET_KEY}:".encode()).decode()
    return {
        "Authorization": f"Basic {encoded}",
        "Content-Type":  "application/json",
        "api-version":   "2022-07-31",
    }


def new_reference_id() -> str:
    """Generate a unique reference ID for a payment attempt."""
    return f"campfire-{uuid.uuid4().hex}"


# ─── QRIS ─────────────────────────────────────────────────────────────────────

async def create_qris(reference_id: str, amount_idr: int) -> dict[str, Any]:
    """
    Create a QRIS QR code (DYNAMIC type, expires in 15 min).
    Returns the full Xendit QR code object.

    Key fields in response:
      id         — use this as xendit_id in xendit_payments table
      qr_string  — raw QRIS string to render as QR code image
      expires_at — ISO timestamp
      status     — ACTIVE | INACTIVE
    """
    expires_at = (
        datetime.now(timezone.utc) + timedelta(minutes=QR_EXPIRY_MINUTES)
    ).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    payload = {
        "reference_id": reference_id,
        "type":         "DYNAMIC",
        "currency":     "IDR",
        "amount":       amount_idr,
        "expires_at":   expires_at,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{XENDIT_API_BASE}/qr_codes",
            headers=_auth_header(),
            json=payload,
        )
        _raise_for_xendit_error(resp)
        data = resp.json()
        logger.info("[xendit] QRIS created | ref=%s id=%s", reference_id, data.get("id"))
        return data


async def get_qr_status(qr_id: str) -> dict[str, Any]:
    """
    Fetch current status of a QR code.
    Xendit status values: ACTIVE | INACTIVE
    A payment within the QR can be found via payments sub-resource.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{XENDIT_API_BASE}/qr_codes/{qr_id}",
            headers=_auth_header(),
        )
        _raise_for_xendit_error(resp)
        return resp.json()


# ─── Virtual Account ──────────────────────────────────────────────────────────

async def create_va(
    external_id: str,
    bank_code:   str,
    amount_idr:  int,
    name:        str = "Campfire",
) -> dict[str, Any]:
    """
    Create a fixed-amount single-use Virtual Account.
    Returns the full Xendit VA object.

    Key fields in response:
      id             — use this as xendit_id in xendit_payments table
      account_number — the VA number the user should transfer to
      bank_code      — e.g. 'BCA'
      merchant_code  — bank-specific merchant prefix
      expected_amount
      expiration_date
      status         — ACTIVE | INACTIVE
    """
    bank_code = bank_code.upper()
    if bank_code not in SUPPORTED_VA_BANKS:
        raise ValueError(f"Bank '{bank_code}' tidak didukung. Pilih: {SUPPORTED_VA_BANKS}")

    expiration_date = (
        datetime.now(timezone.utc) + timedelta(hours=VA_EXPIRY_HOURS)
    ).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    safe_name = name[:50]  # Xendit enforces 50-char limit on name field
    payload = {
        "external_id":      external_id,
        "bank_code":        bank_code,
        "name":             safe_name,
        "expected_amount":  amount_idr,
        "is_single_use":    True,
        "is_closed":        True,
        "expiration_date":  expiration_date,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{XENDIT_API_BASE}/callback_virtual_accounts",
            headers=_auth_header(),
            json=payload,
        )
        _raise_for_xendit_error(resp)
        data = resp.json()
        logger.info(
            "[xendit] VA created | ref=%s id=%s bank=%s account=%s",
            external_id, data.get("id"), bank_code, data.get("account_number"),
        )
        return data


async def get_va_status(va_id: str) -> dict[str, Any]:
    """Fetch current status of a Virtual Account by its Xendit ID."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{XENDIT_API_BASE}/callback_virtual_accounts/{va_id}",
            headers=_auth_header(),
        )
        _raise_for_xendit_error(resp)
        return resp.json()


# ─── Supabase helpers ─────────────────────────────────────────────────────────

def _sb_headers() -> dict[str, str]:
    from app.core.config import settings as s
    return {
        "apikey":        s.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {s.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
    }


def _sb_url(path: str) -> str:
    base = settings.NEXT_PUBLIC_SUPABASE_URL.rstrip("/")
    return f"{base}/{path.lstrip('/')}"


async def store_payment(
    xendit_id:      str,
    reference_id:   str,
    user_id:        str,
    pack_id:        str,
    credits:        int,
    payment_method: str,
    amount_idr:     int,
    va_number:      str | None,
    qr_string:      str | None,
    expires_at:     str | None,
) -> None:
    """Insert a new xendit_payments row."""
    row = {
        "xendit_id":      xendit_id,
        "reference_id":   reference_id,
        "user_id":        user_id,
        "pack_id":        pack_id,
        "credits":        credits,
        "payment_method": payment_method,
        "amount_idr":     amount_idr,
        "status":         "PENDING",
        "va_number":      va_number,
        "qr_string":      qr_string,
        "expires_at":     expires_at,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            _sb_url("rest/v1/xendit_payments"),
            headers=_sb_headers(),
            json=row,
        )
        resp.raise_for_status()
        logger.info("[xendit] payment stored | id=%s method=%s", xendit_id, payment_method)


async def get_payment_by_id(xendit_id: str) -> dict[str, Any] | None:
    """Fetch a xendit_payments row by xendit_id. Returns None if not found."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(
            _sb_url(f"rest/v1/xendit_payments?xendit_id=eq.{xendit_id}&select=*"),
            headers=_sb_headers(),
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None


async def mark_payment_paid(xendit_id: str) -> dict[str, Any] | None:
    """
    Atomically transition xendit_payments status PENDING → PAID via RPC.
    Returns the payment row (user_id, credits, pack_id) if successful,
    or None if the payment was already processed or not found.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            _sb_url("rest/v1/rpc/mark_xendit_paid"),
            headers=_sb_headers(),
            json={"p_xendit_id": xendit_id},
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _raise_for_xendit_error(resp: httpx.Response) -> None:
    """Raise a descriptive exception on Xendit API errors."""
    if resp.is_success:
        return
    try:
        body = resp.json()
        code    = body.get("error_code", "UNKNOWN")
        message = body.get("message", resp.text)
    except Exception:
        code    = "PARSE_ERROR"
        message = resp.text

    logger.error("[xendit] API error %d | %s: %s", resp.status_code, code, message)
    raise httpx.HTTPStatusError(
        f"Xendit API error [{code}]: {message}",
        request=resp.request,
        response=resp,
    )
