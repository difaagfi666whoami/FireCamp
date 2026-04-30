"""
billing.py — Pricing constants for Phase 2 commercialization.

These are the source of truth for credit cost per AI operation and the
credit packages that users can purchase via Stripe Checkout.

Tweak the constants below to change pricing — no other code changes needed.
The frontend `/pricing` page also reads these values via the
`/api/billing/packages` endpoint to stay in sync.
"""

from __future__ import annotations

from typing_extensions import TypedDict


# ── Cost per operation (in credits) ──────────────────────────────────────────

class OpCost:
    RECON_FREE = 1
    RECON_PRO  = 5
    MATCH      = 1
    CRAFT      = 2
    POLISH     = 1   # used for tone rewrite — tracked separately because it can repeat


# ── Credit packages sold via Stripe Checkout ─────────────────────────────────

class CreditPack(TypedDict):
    id:          str   # internal id used as Stripe metadata + URL slug
    name:        str   # display name
    credits:     int   # credits granted on purchase
    price_idr:   int   # display price in IDR (whole rupiah)
    price_cents: int   # Stripe charge amount = price_idr * 100 (Stripe treats IDR as 2-decimal per ISO 4217)
    highlight:   bool  # show "Recommended" badge on /pricing
    description: str   # one-liner shown on the pricing card


CREDIT_PACKS: list[CreditPack] = [
    {
        "id":          "starter",
        "name":        "Starter",
        "credits":     50,
        "price_idr":   100_000,
        "price_cents": 10_000_000,
        "highlight":   False,
        "description": "Coba dulu — sekitar 10 Recon Pro atau 50 Match.",
    },
    {
        "id":          "growth",
        "name":        "Growth",
        "credits":     200,
        "price_idr":   350_000,
        "price_cents": 35_000_000,
        "highlight":   True,
        "description": "Hemat 12.5%. Cocok untuk 1 sales rep aktif per bulan.",
    },
    {
        "id":          "scale",
        "name":        "Scale",
        "credits":     500,
        "price_idr":   750_000,
        "price_cents": 75_000_000,
        "highlight":   False,
        "description": "Hemat 25%. Untuk tim sales kecil-menengah.",
    },
]


def find_pack(pack_id: str) -> CreditPack | None:
    return next((p for p in CREDIT_PACKS if p["id"] == pack_id), None)
