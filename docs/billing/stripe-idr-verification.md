# Stripe IDR Currency — Verification Log

## Background

When checking pricing math in [backend/app/core/billing.py](../../backend/app/core/billing.py)
we needed to confirm how Stripe interprets `unit_amount` for IDR:

- Are 100 minor-units = 1 rupiah (2-decimal), or
- Is 1 minor-unit = 1 rupiah (zero-decimal, like JPY/KRW)?

Wrong assumption × 100 = customer charged 100× the intended price.

## Verification (2026-05-16)

Ran [scripts/verify_stripe_idr.py](../../scripts/verify_stripe_idr.py)
against test-mode Stripe with `unit_amount=1000` and `currency=idr`.
Stripe returned:

> `InvalidRequestError: The Checkout Session's total amount must convert
> to at least 200 sen. **Rp10.00** converts to approximately RM0.00.`

Stripe itself reported `unit_amount: 1000` as **Rp 10.00** — i.e. Stripe
treats IDR as **2-decimal**, identical to its handling of USD/EUR.

This contradicts a casual reading of older blog posts (which sometimes
group IDR with JPY/KRW). The authoritative answer is Stripe's runtime
behavior, captured above.

## Conclusion

| Question | Answer |
|---|---|
| Is IDR zero-decimal in Stripe? | **No** — 2-decimal. |
| Is `price_cents = price_idr * 100` correct? | **Yes**. |
| Is the Starter pack (`price_cents: 10_000_000`) overcharging? | **No** — it renders as Rp 100,000.00 (one hundred thousand rupiah), as intended. |
| Action required on code? | **None**. Comment in `billing.py:34` is accurate. |

## Mapping (for future reference)

| Display amount | Code's `price_idr` | Code's `price_cents` (= Stripe `unit_amount`) |
|---|---|---|
| Rp 100,000 (Starter) | 100,000 | 10,000,000 |
| Rp 350,000 (Growth)  | 350,000 | 35,000,000 |
| Rp 750,000 (Scale)   | 750,000 | 75,000,000 |

## How to re-verify

Open the URL printed by `python scripts/verify_stripe_idr.py` in a
browser. Stripe Checkout should display the configured rupiah amount
formatted as `Rp 1.000,00` or `Rp 1,000.00` depending on locale. Mismatch
between the displayed amount and the intended `price_idr` indicates the
math is wrong — investigate `price_cents` math before deploying.
