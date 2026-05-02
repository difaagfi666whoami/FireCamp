# Payment Flow — End-to-End Diagrams

## Common entry point

```
User on /pricing
  │
  ├─ Clicks "Beli sekarang" on any pack
  │
  └─ Dialog opens: PaymentMethodSelector
       │
       ├─ QRIS selected ──────────────────────────────────► [QRIS Flow]
       │
       ├─ VA_BCA / VA_MANDIRI / VA_BNI / VA_BRI / VA_PERMATA ► [VA Flow]
       │
       └─ Kartu Kredit/Debit ────────────────────────────► [Stripe Flow]
```

---

## QRIS Flow

```
PaymentMethodSelector (click QRIS)
  │
  └─ createXenditPayment(packId, "QRIS")
       │
       └─ POST /api/billing/xendit/create-payment
            │
            ├─ find_pack(pack_id)               — validate pack
            ├─ xendit.create_qris(ref, price)   — call Xendit API
            ├─ xendit.store_payment(...)         — save to xendit_payments (PENDING)
            └─ return { payment_id, qr_string, expires_at }
                 │
                 └─ QRISPayment component renders:
                      • QR code image (from qr_string via qrserver.com)
                      • 15-minute countdown timer
                      • "Sudah Bayar? Cek Status" button
                      • Auto-poll every 5s in background

User scans QR with GoPay / OVO / DANA / bank app → pays

Xendit receives payment confirmation
  │
  └─ POST /api/webhooks/xendit
       │
       ├─ verify X-CALLBACK-TOKEN header
       ├─ extract qr_id from body.data.qr_id
       ├─ check body.data.status == "SUCCEEDED"
       ├─ mark_xendit_paid(qr_id)              — atomic PENDING→PAID (idempotent)
       └─ credits_service.grant(user_id, credits, "purchase")
            │
            └─ SQL: credit_credits() — upserts user_credits + ledger row

Frontend polling detects status == "PAID"
  │
  └─ Shows success screen → user sees updated balance
```

---

## Virtual Account Flow

```
PaymentMethodSelector (click e.g. VA_BCA)
  │
  └─ createXenditPayment(packId, "VA_BCA")
       │
       └─ POST /api/billing/xendit/create-payment
            │
            ├─ find_pack(pack_id)
            ├─ xendit.create_va(ref, "BCA", price)  — call Xendit API
            ├─ xendit.store_payment(...)             — save (PENDING)
            └─ return { payment_id, va_number, bank_name, expires_at }
                 │
                 └─ VAPayment component renders:
                      • Bank name + VA number (with copy button)
                      • Step-by-step transfer instructions
                      • 24-hour countdown timer
                      • "Sudah Transfer? Cek Status" button
                      • Auto-poll every 5s in background

User opens their bank app → transfer exact amount to VA number

Xendit receives bank transfer notification
  │
  └─ POST /api/webhooks/xendit
       │
       ├─ verify X-CALLBACK-TOKEN header
       ├─ extract va_id from body.callback_virtual_account_id
       ├─ check presence of body.payment_id (VA success indicator)
       ├─ mark_xendit_paid(va_id)              — atomic PENDING→PAID
       └─ credits_service.grant(user_id, credits, "purchase")

Frontend polling detects status == "PAID" → shows success
```

---

## Stripe Flow (unchanged — card payments)

```
PaymentMethodSelector (click Kartu Kredit)
  │
  └─ Dialog closes immediately
       │
       └─ createCheckout(packId)
            │
            └─ POST /api/billing/checkout
                 │
                 ├─ stripe.checkout.Session.create()  — with metadata
                 └─ return { url }
                      │
                      └─ window.location.href = url   (redirect to Stripe)

User pays on Stripe's hosted page

Stripe sends webhook
  │
  └─ POST /api/webhooks/stripe
       │
       ├─ verify stripe-signature header
       ├─ extract metadata (user_id, pack_id, credits)
       └─ credits_service.grant(user_id, credits, "purchase", stripe_session_id)

User lands on /billing/success → polls balance
```

---

## Database state transitions

```
xendit_payments.status:
  PENDING ──(webhook: SUCCEEDED/payment_id)──► PAID
  PENDING ──(expires_at reached)───────────► EXPIRED  [handled client-side only]
  PENDING ──(Xendit error)─────────────────► FAILED   [not yet implemented]
```

## Idempotency guarantees

- **QRIS / VA**: `mark_xendit_paid()` SQL function uses `WHERE status = 'PENDING'`
  — second webhook delivery returns 0 rows → no duplicate credit grant.
- **Stripe**: `credit_credits()` SQL function uses unique index on `stripe_session_id`
  — idempotent at the database level.
