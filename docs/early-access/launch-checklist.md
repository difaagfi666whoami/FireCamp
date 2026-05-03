# Early Access — Launch Checklist

Run through this top-to-bottom on launch day. Every checkbox is a thing
that has to be true before you send the first invite.

## 1. Database migrations

Apply (or confirm applied) the three Phase 5 migrations against production
Supabase:

- [ ] `supabase/migrations/024_invite_codes.sql`
- [ ] `supabase/migrations/025_feedback.sql`
- [ ] `supabase/migrations/026_early_access_seen.sql`

Verify after applying:

```sql
SELECT to_regclass('public.invite_codes'),
       to_regclass('public.feedback');
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'user_profiles' AND column_name = 'early_access_seen';
SELECT * FROM invite_codes WHERE code = 'CAMP-SEED';   -- seed-user bypass row
```

The `CAMP-SEED` row must exist; the seed user (`difaagfi1998@gmail.com`)
relies on it to bypass the invite gate.

## 2. Production environment variables

Set on Vercel (or wherever the Next.js app is deployed):

- [ ] `NEXT_PUBLIC_EARLY_ACCESS_MODE=true`
- [ ] `NEXT_PUBLIC_BILLING_ACTIVE=false`
- [ ] `NEXT_PUBLIC_FREE_CREDITS_ON_SIGNUP=50`
- [ ] `NEXT_PUBLIC_INVITE_ONLY=true`
- [ ] `NEXT_PUBLIC_FEEDBACK_WIDGET_ENABLED=true`
- [ ] `ADMIN_EMAILS=<your_admin_email_csv>` (e.g. `founder@campfire.id`)
- [ ] `ADMIN_SECRET_KEY=<random_32+_chars>` (generate via `openssl rand -hex 32`)

Existing prod env vars that must already be set (from earlier phases):

- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `RESEND_API_KEY`
- [ ] `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (kept set even though
      billing is gated off — the rollback doc relies on them being ready)
- [ ] `XENDIT_SECRET_KEY` and `XENDIT_WEBHOOK_TOKEN` (same rationale)

After changes are saved, **redeploy** so the `NEXT_PUBLIC_*` flags are baked
into the new client bundle.

## 3. Generate the first 10 invite codes

```bash
export APP_URL=https://your-app.vercel.app
export ADMIN_SECRET_KEY=<the-secret-you-set-above>

curl -X POST "$APP_URL/api/admin/invite-codes/generate" \
  -H "X-Admin-Secret: $ADMIN_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"count": 10, "maxUses": 1}'
```

Save the returned `codes[]` somewhere safe (1Password, Notion). Each code
is single-use unless you raise `maxUses`.

To list all codes (used + unused):

```bash
curl "$APP_URL/api/admin/invite-codes" -H "X-Admin-Secret: $ADMIN_SECRET_KEY" | jq
```

- [ ] 10 codes generated and saved.

## 4. End-to-end smoke tests

Use a fresh email (e.g. `+test1@gmail.com`):

- [ ] Visit `$APP_URL/login` → enter test email → click magic link.
- [ ] Auth callback redirects to `/auth/redeem-invite` (NOT `/research-library`).
- [ ] Enter one of the generated codes → confirmation screen → redirects to
      `/onboarding`.
- [ ] Complete the existing 3-step business-identity onboarding → lands on
      `/research-library`.
- [ ] Welcome modal pops with "Selamat datang di Early Access!" and shows
      `50 kredit`. Click through all 3 steps.
- [ ] 🎉 Early Access banner is visible at the top of the shell.
- [ ] Click the green **Feedback** pill (bottom-right) → submit a test message
      → toast confirms.
- [ ] Check Supabase: `SELECT balance FROM user_credits WHERE user_id = ...`
      → returns `50`.

## 5. Admin dashboard

- [ ] Visit `$APP_URL/admin/usage` while signed in as an `ADMIN_EMAILS` email.
- [ ] Page loads — no "Tidak terautentikasi" error.
- [ ] User Overview shows your test signup.
- [ ] Feedback Summary shows the test feedback row from step 4.
- [ ] API Burn section renders (numbers may be 0; that's fine on day 1).

## 6. Billing UI is hidden

- [ ] Visit `/pricing` → renders "Pembelian Kredit Segera Hadir" placeholder
      (NOT the pack grid).
- [ ] Sidebar shows "Early Access · 50 kredit" pill (NOT "Beli Kredit").
- [ ] Visit `/billing` → transaction history renders without Top-Up button.

## 7. Distribute invites

Suggested email template (Bahasa Indonesia):

```
Subject: Kamu diundang ke Early Access Campfire

Hai [Nama],

Kamu termasuk yang pertama kami undang untuk mencoba Campfire — alat
otomasi outreach B2B "Research. Match. Send.".

Klik link ini: https://your-app.vercel.app/login
Saat diminta kode undangan, gunakan: CAMP-XXXX

Kamu akan dapat 50 kredit gratis untuk dijelajahi. Kalau ada masukan,
tombol Feedback selalu ada di pojok kanan bawah aplikasi.

— Tim Campfire
```

- [ ] First batch of invites sent.
- [ ] Date and recipient list logged somewhere internal.

## 8. Post-launch monitoring (first 72 hours)

- Check `/admin/usage` every 12 hours for the first 3 days.
- Watch for `negative` sentiment feedback — respond within 24 hours.
- Alert thresholds in API Burn — if any provider drops below 20% remaining,
  pause invite distribution and either upgrade the provider plan or wait
  for the monthly reset.
