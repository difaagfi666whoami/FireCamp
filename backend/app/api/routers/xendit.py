"""
xendit.py — Xendit payment gateway endpoints.

Endpoints:
  POST /api/billing/xendit/create-payment  — create QRIS or VA payment
  GET  /api/billing/xendit/payment-status/{payment_id} — poll payment status
  POST /api/webhooks/xendit               — Xendit callback (NO auth, token-verified)

Xendit is the primary gateway for Indonesian payment methods (QRIS, Virtual Account).
Stripe remains unchanged as a secondary option for card payments.
"""

from __future__ import annotations

import logging
from typing import Any, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.billing import CREDIT_PACKS, find_pack
from app.core.config import settings
from app.services import credits_service
from app.services import xendit_service as xendit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["xendit"])

# Valid payment method tokens accepted by create-payment
PaymentMethod = Literal[
    "QRIS",
    "VA_BCA", "VA_MANDIRI", "VA_BNI", "VA_BRI", "VA_PERMATA",
]


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CreatePaymentRequest(BaseModel):
    pack_id:        str           # must match a CREDIT_PACKS id
    payment_method: PaymentMethod


class CreatePaymentResponse(BaseModel):
    payment_id:     str           # xendit_id — use for status polling
    payment_method: str
    amount_idr:     int
    credits:        int
    expires_at:     Optional[str]
    # QRIS-specific
    qr_string:      Optional[str] = None
    # VA-specific
    va_number:      Optional[str] = None
    bank_code:      Optional[str] = None
    bank_name:      Optional[str] = None


class PaymentStatusResponse(BaseModel):
    payment_id:     str
    status:         str           # PENDING | PAID | EXPIRED | FAILED
    payment_method: str
    credits_added:  Optional[int] = None


# ─── Bank display names ───────────────────────────────────────────────────────

_BANK_NAMES: dict[str, str] = {
    "BCA":     "Bank Central Asia (BCA)",
    "MANDIRI": "Bank Mandiri",
    "BNI":     "Bank Negara Indonesia (BNI)",
    "BRI":     "Bank Rakyat Indonesia (BRI)",
    "PERMATA": "Bank Permata",
}


# ─── POST /api/billing/xendit/create-payment ─────────────────────────────────

@router.post("/billing/xendit/create-payment", response_model=CreatePaymentResponse)
async def create_xendit_payment(
    payload: CreatePaymentRequest,
    user_id: str = Depends(get_current_user),
) -> CreatePaymentResponse:
    """
    Create a new Xendit QRIS or Virtual Account payment.
    Returns payment details that the frontend renders for the user.
    """
    _ensure_xendit_configured()

    pack = find_pack(payload.pack_id)
    if not pack:
        raise HTTPException(status_code=400, detail=f"Pack '{payload.pack_id}' tidak dikenal.")

    method = payload.payment_method
    ref_id = xendit.new_reference_id()

    try:
        if method == "QRIS":
            return await _create_qris_payment(user_id, pack, ref_id)
        else:
            bank_code = method.removeprefix("VA_")
            return await _create_va_payment(user_id, pack, ref_id, bank_code)

    except httpx.HTTPStatusError as exc:
        logger.error("[xendit] create-payment FAILED user=%s method=%s: %s", user_id, method, exc)
        raise HTTPException(
            status_code=502,
            detail="Gagal membuat pembayaran Xendit. Coba lagi atau pilih metode lain.",
        ) from exc


async def _create_qris_payment(
    user_id: str,
    pack:    Any,
    ref_id:  str,
) -> CreatePaymentResponse:
    xendit_resp = await xendit.create_qris(ref_id, pack["price_idr"])

    xendit_id = xendit_resp["id"]
    qr_string = xendit_resp.get("qr_string")
    expires_at = xendit_resp.get("expires_at")

    await xendit.store_payment(
        xendit_id      = xendit_id,
        reference_id   = ref_id,
        user_id        = user_id,
        pack_id        = pack["id"],
        credits        = pack["credits"],
        payment_method = "QRIS",
        amount_idr     = pack["price_idr"],
        va_number      = None,
        qr_string      = qr_string,
        expires_at     = expires_at,
    )

    return CreatePaymentResponse(
        payment_id     = xendit_id,
        payment_method = "QRIS",
        amount_idr     = pack["price_idr"],
        credits        = pack["credits"],
        expires_at     = expires_at,
        qr_string      = qr_string,
    )


async def _create_va_payment(
    user_id:   str,
    pack:      Any,
    ref_id:    str,
    bank_code: str,
) -> CreatePaymentResponse:
    xendit_resp = await xendit.create_va(
        external_id = ref_id,
        bank_code   = bank_code,
        amount_idr  = pack["price_idr"],
    )

    xendit_id      = xendit_resp["id"]
    va_number      = xendit_resp.get("account_number")
    expiration_date = xendit_resp.get("expiration_date")

    await xendit.store_payment(
        xendit_id      = xendit_id,
        reference_id   = ref_id,
        user_id        = user_id,
        pack_id        = pack["id"],
        credits        = pack["credits"],
        payment_method = f"VA_{bank_code}",
        amount_idr     = pack["price_idr"],
        va_number      = va_number,
        qr_string      = None,
        expires_at     = expiration_date,
    )

    return CreatePaymentResponse(
        payment_id     = xendit_id,
        payment_method = f"VA_{bank_code}",
        amount_idr     = pack["price_idr"],
        credits        = pack["credits"],
        expires_at     = expiration_date,
        va_number      = va_number,
        bank_code      = bank_code,
        bank_name      = _BANK_NAMES.get(bank_code, bank_code),
    )


# ─── GET /api/billing/xendit/payment-status/{payment_id} ─────────────────────

@router.get("/billing/xendit/payment-status/{payment_id}", response_model=PaymentStatusResponse)
async def xendit_payment_status(
    payment_id: str,
    user_id:    str = Depends(get_current_user),
) -> PaymentStatusResponse:
    """
    Poll the status of a pending Xendit payment.
    Frontend calls this every 5 seconds while the user pays.
    """
    row = await xendit.get_payment_by_id(payment_id)

    if not row:
        raise HTTPException(status_code=404, detail="Pembayaran tidak ditemukan.")

    if row["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Akses ditolak.")

    return PaymentStatusResponse(
        payment_id     = payment_id,
        status         = row["status"],
        payment_method = row["payment_method"],
        credits_added  = row["credits"] if row["status"] == "PAID" else None,
    )


# ─── POST /api/webhooks/xendit ────────────────────────────────────────────────

@router.post("/webhooks/xendit")
async def xendit_webhook(request: Request) -> dict:
    """
    Xendit payment callback. Xendit sends this when a payment is confirmed.
    Auth is via X-CALLBACK-TOKEN header (compared against XENDIT_WEBHOOK_TOKEN).

    Handles both QRIS and Virtual Account webhook formats.
    On success: marks payment as PAID and grants credits to user.
    """
    _verify_xendit_token(request)

    body = await request.json()
    logger.info("[xendit] webhook received | keys=%s", list(body.keys()))

    # Detect payment type and extract xendit_id
    xendit_id = _extract_xendit_id(body)
    if not xendit_id:
        logger.warning("[xendit] webhook: could not extract xendit_id from payload")
        return {"received": True, "handled": False, "reason": "unrecognized_format"}

    # Determine if this webhook indicates a successful payment
    if not _is_payment_successful(body):
        logger.info("[xendit] webhook: payment not successful | xendit_id=%s", xendit_id)
        return {"received": True, "handled": False, "reason": "not_paid"}

    # Atomically transition PENDING → PAID (idempotent: returns None if already PAID)
    paid_row = await xendit.mark_payment_paid(xendit_id)
    if not paid_row:
        logger.info("[xendit] webhook: already processed | xendit_id=%s", xendit_id)
        return {"received": True, "handled": False, "reason": "already_processed"}

    user_id  = paid_row["user_id"]
    credits  = paid_row["credits"]
    pack_id  = paid_row["pack_id"]

    granted = await credits_service.grant(
        user_id     = user_id,
        amount      = credits,
        description = f"Pembelian {pack_id} via Xendit",
        tx_type     = "purchase",
    )

    logger.info(
        "[xendit] webhook handled | user=%s pack=%s credits=%d xendit_id=%s granted=%s",
        user_id, pack_id, credits, xendit_id, granted,
    )
    return {"received": True, "handled": True, "granted": granted}


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _ensure_xendit_configured() -> None:
    if not settings.XENDIT_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "Xendit belum dikonfigurasi. Set XENDIT_SECRET_KEY di .env.local "
                "lalu restart backend."
            ),
        )


def _verify_xendit_token(request: Request) -> None:
    """Raise 401 if the incoming webhook token doesn't match our stored secret."""
    if not settings.XENDIT_WEBHOOK_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="XENDIT_WEBHOOK_TOKEN belum dikonfigurasi.",
        )
    incoming = request.headers.get("x-callback-token", "")
    if incoming != settings.XENDIT_WEBHOOK_TOKEN:
        logger.warning("[xendit] webhook token mismatch — possible spoofed request")
        raise HTTPException(status_code=401, detail="Invalid webhook token")


def _extract_xendit_id(body: dict) -> str | None:
    """
    Extract the Xendit resource ID from either a QR or VA webhook payload.

    QR webhook shape:  { "event": "qr.payment", "data": { "qr_id": "qr_xxx", ... } }
    VA webhook shape:  { "callback_virtual_account_id": "va_xxx", ... }
    """
    # QR payment webhook
    if body.get("event") == "qr.payment":
        return body.get("data", {}).get("qr_id")

    # Virtual Account payment webhook
    if "callback_virtual_account_id" in body:
        return body["callback_virtual_account_id"]

    return None


def _is_payment_successful(body: dict) -> bool:
    """
    Return True only when the webhook payload indicates a completed payment.

    QR: data.status == "SUCCEEDED"
    VA: presence of payment_id (VA webhooks are only sent on successful payment)
    """
    if body.get("event") == "qr.payment":
        return body.get("data", {}).get("status") == "SUCCEEDED"

    # VA webhooks don't have an explicit status field — receiving the callback
    # itself means the transfer was received by Xendit.
    if "callback_virtual_account_id" in body and "payment_id" in body:
        return True

    return False
