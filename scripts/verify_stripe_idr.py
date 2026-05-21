"""
verify_stripe_idr.py — Verify Stripe IDR currency handling.

Stripe documents IDR as a zero-decimal currency:
  https://docs.stripe.com/currencies#zero-decimal
That means `unit_amount: 1000` should render as **Rp 1.000** in Checkout
(NOT Rp 10).

If the current code in backend/app/core/billing.py multiplies price_idr by
100, customers would be charged 100× the intended amount. This script
creates a Rp 1.000 test session against the **test-mode** Stripe key, prints
the Checkout URL, and waits for you to confirm the displayed amount.

Run:
    python scripts/verify_stripe_idr.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Load .env.local so the script Just Works without exporting env vars.
env_path = Path(__file__).parent.parent / ".env.local"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

try:
    import stripe  # type: ignore
except ImportError:
    print("ERROR: pip install stripe")
    sys.exit(1)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
if not stripe.api_key.startswith("sk_test_"):
    print("ERROR: refusing to run outside test mode. STRIPE_SECRET_KEY must start with sk_test_")
    sys.exit(1)

print("Creating test Checkout Session: amount_idr=1000 (one thousand rupiah)...")
session = stripe.checkout.Session.create(
    mode="payment",
    payment_method_types=["card"],
    line_items=[
        {
            "price_data": {
                "currency":     "idr",
                "product_data": {"name": "IDR-verification — one thousand rupiah"},
                "unit_amount":  1000,  # Stripe IDR should be zero-decimal
            },
            "quantity": 1,
        }
    ],
    success_url="https://example.com/success",
    cancel_url="https://example.com/cancel",
)

print()
print(f"Checkout URL:     {session.url}")
print(f"amount_total:     {session.amount_total}")
print()
print("Expected:  Stripe Checkout displays 'Rp 1.000' (one thousand rupiah).")
print("If wrong:  Stripe Checkout displays 'Rp 10' or 'Rp 100.000', then")
print("           billing.py price_cents math is broken — current * 100 is")
print("           overcharging customers by 100x.")
print()
print("Open the URL above in a browser and screenshot the displayed total.")
print("Record outcome in: docs/billing/stripe-idr-verification.md")
