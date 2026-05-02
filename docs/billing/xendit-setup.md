# Xendit Payment Gateway Setup

## Overview

Xendit is the **primary payment gateway** for Campfire. It supports Indonesian
payment methods: QRIS, Virtual Account (BCA / Mandiri / BNI / BRI / Permata),
and e-wallets.

Stripe remains available for card payments. Users choose their method on the
pricing page before checkout.

---

## 1. Create a Xendit Account

1. Go to [dashboard.xendit.co](https://dashboard.xendit.co) and sign up.
2. Complete business verification (takes 1–3 days for full production access).
3. For development you can use the **test/development environment** immediately.

---

## 2. Get API Keys

In Xendit Dashboard → **Settings → API Keys**:

- Copy the **Secret API Key** (starts with `xnd_development_...` in test mode,
  `xnd_production_...` in production mode).
- Set it as `XENDIT_SECRET_KEY` in `.env.local`.

> **Never commit your API key.** Development and production keys are separate.

---

## 3. Set Up Webhooks

Xendit pushes payment confirmations to your server. You need to configure:

1. In Xendit Dashboard → **Settings → Callbacks**:
   - **QR Code**: `https://your-domain.com/api/webhooks/xendit`
   - **Virtual Account Paid**: `https://your-domain.com/api/webhooks/xendit`

2. Note the **Callback Verification Token** shown on the same page.
   Set it as `XENDIT_WEBHOOK_TOKEN` in `.env.local`.

**For local development** use a tunnel:
```bash
# Option A: ngrok
ngrok http 8000
# → set https://abc123.ngrok.io/api/webhooks/xendit in Xendit dashboard

# Option B: localtunnel
npx localtunnel --port 8000
```

---

## 4. Test Payments

### QRIS (test mode)
In Xendit test mode, QRIS payments are simulated. After creating a QRIS
payment via the API, use the **Xendit Dashboard → Test → Simulate Payment**
to mark it as paid. The webhook will fire and credits will be added.

### Virtual Account (test mode)
Xendit provides test VA numbers. Use the Simulate Payment tool in the
dashboard to trigger the payment webhook.

**Test bank codes:** BCA, MANDIRI, BNI, BRI, PERMATA  
No special test card numbers are needed — use the Xendit simulator instead.

---

## 5. Environment Variables

```dotenv
XENDIT_SECRET_KEY=xnd_development_...    # from Xendit Dashboard → API Keys
XENDIT_WEBHOOK_TOKEN=...                 # from Xendit Dashboard → Callbacks
```

---

## 6. Going Live

1. Complete Xendit KYB (Know Your Business) verification.
2. Switch to **production mode** in Xendit Dashboard.
3. Copy the production Secret API Key (`xnd_production_...`).
4. Update `XENDIT_SECRET_KEY` in your production environment.
5. Update webhook URLs in Xendit Dashboard to your production domain.
6. Copy the production Callback Verification Token → update `XENDIT_WEBHOOK_TOKEN`.

---

## Payment Flow Reference

### QRIS

```
1. User selects QRIS on /pricing
2. Frontend → POST /api/billing/xendit/create-payment { pack_id, payment_method: "QRIS" }
3. Backend → POST https://api.xendit.co/qr_codes
4. Backend stores payment in xendit_payments table (status: PENDING)
5. Backend returns { payment_id, qr_string, expires_at, ... }
6. Frontend renders QR code image from qr_string (via qrserver.com)
7. User scans QR with their e-wallet app and pays
8. Xendit → POST https://your-domain.com/api/webhooks/xendit
9. Backend: verify X-CALLBACK-TOKEN header
10. Backend: mark_xendit_paid(xendit_id) — atomic PENDING → PAID
11. Backend: credits_service.grant(user_id, credits) → credits added
12. Frontend polls GET /api/billing/xendit/payment-status/{id} every 5s
13. Frontend detects PAID status → shows success screen
```

### Virtual Account

```
1. User selects VA_BCA (or other bank) on /pricing
2. Frontend → POST /api/billing/xendit/create-payment { pack_id, payment_method: "VA_BCA" }
3. Backend → POST https://api.xendit.co/callback_virtual_accounts
4. Backend stores payment in xendit_payments table (status: PENDING)
5. Backend returns { payment_id, va_number, bank_name, expires_at, ... }
6. Frontend shows VA number + transfer instructions + countdown
7. User transfers exact amount to VA number via bank app/ATM
8. Xendit → POST https://your-domain.com/api/webhooks/xendit
9. Backend: verify X-CALLBACK-TOKEN header
10. Backend: mark_xendit_paid(xendit_id) — atomic PENDING → PAID
11. Backend: credits_service.grant(user_id, credits) → credits added
12. Frontend polls → detects PAID → shows success
```

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| 503 on create-payment | `XENDIT_SECRET_KEY` not set | Add to `.env.local`, restart backend |
| 401 on webhook | `XENDIT_WEBHOOK_TOKEN` mismatch | Check token matches Xendit Dashboard |
| Credits not added after payment | Webhook not reaching backend | Check tunnel URL, check backend logs |
| QR code not showing | `qr_string` empty | Xendit test mode: check API key type |
| VA number not returned | `account_number` missing | Log full Xendit API response |
