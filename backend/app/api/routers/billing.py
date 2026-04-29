"""
billing.py — Stripe checkout + webhook + balance + package catalog.

Endpoints:
  GET  /api/billing/packages    — public list of credit packs (used by /pricing UI)
  GET  /api/billing/balance     — current user's credit balance
  POST /api/billing/checkout    — create Stripe Checkout Session, return URL
  POST /api/webhooks/stripe     — Stripe webhook receiver (NO auth, signature-verified)

Stripe is required to import successfully but operations only work when
STRIPE_SECRET_KEY is configured. If not configured, checkout/webhook routes
return a clear setup error.
"""

from __future__ import annotations

import logging
from typing import Optional

import stripe
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.billing import CREDIT_PACKS, CreditPack, find_pack
from app.core.config import settings
from app.services import credits_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["billing"])


def _ensure_stripe_configured() -> None:
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "Billing belum dikonfigurasi. Set STRIPE_SECRET_KEY di .env.local "
                "lalu restart backend."
            ),
        )
    stripe.api_key = settings.STRIPE_SECRET_KEY


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    pack_id: str  # one of CREDIT_PACKS[].id


class CheckoutResponse(BaseModel):
    url: str


class BalanceResponse(BaseModel):
    balance: int


class PackagesResponse(BaseModel):
    packs: list[CreditPack]


# ─── Public endpoints ────────────────────────────────────────────────────────

@router.get("/billing/packages", response_model=PackagesResponse)
async def list_packages() -> PackagesResponse:
    """List credit packs sold via Stripe. Public — used by /pricing UI."""
    return PackagesResponse(packs=CREDIT_PACKS)


@router.get("/billing/balance", response_model=BalanceResponse)
async def get_balance(user_id: str = Depends(get_current_user)) -> BalanceResponse:
    """Current credit balance for the authenticated user."""
    bal = await credits_service.get_balance(user_id)
    return BalanceResponse(balance=bal)


# ─── Checkout ────────────────────────────────────────────────────────────────

@router.post("/billing/checkout", response_model=CheckoutResponse)
async def create_checkout(
    payload: CheckoutRequest,
    user_id: str = Depends(get_current_user),
) -> CheckoutResponse:
    """Create a Stripe Checkout Session and return the redirect URL."""
    _ensure_stripe_configured()

    pack = find_pack(payload.pack_id)
    if not pack:
        raise HTTPException(status_code=400, detail=f"Pack '{payload.pack_id}' tidak dikenal.")

    app_url = settings.NEXT_PUBLIC_APP_URL.rstrip("/")
    success_url = f"{app_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url  = f"{app_url}/pricing?status=canceled"

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency":     "idr",
                        "product_data": {
                            "name":        f"Campfire — {pack['name']} ({pack['credits']} credits)",
                            "description": pack["description"],
                        },
                        "unit_amount":  pack["price_cents"],
                    },
                    "quantity": 1,
                }
            ],
            metadata={
                "user_id":     user_id,
                "pack_id":     pack["id"],
                "credits":     str(pack["credits"]),
            },
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except stripe.error.StripeError as exc:
        logger.error("[billing] Stripe Checkout create FAILED: %s", exc)
        raise HTTPException(status_code=502, detail="Gagal membuat sesi checkout. Coba lagi.") from exc

    if not session.url:
        raise HTTPException(status_code=502, detail="Stripe tidak mengembalikan URL checkout.")

    logger.info("[billing] checkout created | user=%s pack=%s session=%s", user_id, pack["id"], session.id)
    return CheckoutResponse(url=session.url)


# ─── Webhook ─────────────────────────────────────────────────────────────────

@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """
    Stripe webhook receiver. Verifies signature using STRIPE_WEBHOOK_SECRET.
    Handles `checkout.session.completed` → grants credits to user.

    NOTE: this endpoint deliberately does NOT use get_current_user — Stripe
    is the caller, auth is via signature.
    """
    if not settings.STRIPE_SECRET_KEY or not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Webhook belum dikonfigurasi. Set STRIPE_SECRET_KEY dan STRIPE_WEBHOOK_SECRET.",
        )
    stripe.api_key = settings.STRIPE_SECRET_KEY

    payload = await request.body()
    sig_header: Optional[str] = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=settings.STRIPE_WEBHOOK_SECRET,
        )
    except (stripe.error.SignatureVerificationError, ValueError) as exc:
        logger.error("[billing] webhook signature verification FAILED: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid webhook signature") from exc

    if event["type"] != "checkout.session.completed":
        logger.info("[billing] webhook ignored event type=%s", event["type"])
        return {"received": True, "handled": False}

    session = event["data"]["object"]
    metadata = session.get("metadata") or {}
    user_id      = metadata.get("user_id")
    pack_id      = metadata.get("pack_id")
    credits_str  = metadata.get("credits")
    session_id   = session.get("id")

    if not user_id or not pack_id or not credits_str:
        logger.error("[billing] webhook missing metadata | session=%s metadata=%s", session_id, metadata)
        raise HTTPException(status_code=400, detail="Webhook missing required metadata")

    try:
        credits_amount = int(credits_str)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid credits metadata") from exc

    granted = await credits_service.grant(
        user_id=user_id,
        amount=credits_amount,
        description=f"Pembelian {pack_id}",
        tx_type="purchase",
        stripe_session_id=session_id,
    )
    logger.info(
        "[billing] webhook handled | user=%s pack=%s credits=%d session=%s granted=%s",
        user_id, pack_id, credits_amount, session_id, granted,
    )
    return {"received": True, "handled": True, "granted": granted}
