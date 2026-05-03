# Rolling Back from Early Access to Paid Mode

Use this when billing is ready to activate. The work is split into three
parts: **flip the flags**, **communicate**, and **handle existing credits**.

## 1. Flip the flags

All Phase 5 gating goes through `NEXT_PUBLIC_*` env vars (read by
[lib/config/feature-flags.ts](../../lib/config/feature-flags.ts)). To return
to paid mode:

| Variable | Early Access value | Paid mode value |
|---|---|---|
| `NEXT_PUBLIC_BILLING_ACTIVE` | `false` | `true` |
| `NEXT_PUBLIC_INVITE_ONLY` | `true` | `false` |
| `NEXT_PUBLIC_EARLY_ACCESS_MODE` | `true` | `false` |
| `NEXT_PUBLIC_FREE_CREDITS_ON_SIGNUP` | `50` | `0` (or whatever you want new signups to start with) |
| `NEXT_PUBLIC_FEEDBACK_WIDGET_ENABLED` | `true` | `true` (keep this on; it's useful in production too) |

Apply the changes on Vercel (or whichever host) and **redeploy** — the
`NEXT_PUBLIC_*` flags are baked into the client bundle at build time, so
restarting alone won't pick them up.

What changes when you redeploy:

- Sidebar replaces "Early Access · X kredit" with the **Beli Kredit** link.
- `/pricing` re-renders the Stripe + Xendit pack grid.
- `/billing` shows Top-Up Kredit buttons again.
- The 🎉 Early Access banner disappears.
- The 3-step Welcome modal stops triggering.
- `/auth/redeem-invite` is no longer hit during the auth callback (new
  signups land in `/onboarding` directly).
- `OutOfCreditsModal` flips its CTA back to "Beli Kredit →" routing to
  `/pricing`.

What does NOT change:

- Existing `invite_codes` rows — left in place. They're harmless once
  `INVITE_ONLY=false` because the redeem RPC is no longer invoked during
  signup.
- Existing `feedback` table — kept; admin dashboard still works.
- The `early_access_seen` column — kept; cheap and useful if you ever
  re-enable Early Access later.

## 2. Communicate to existing users

Send this email to everyone in `auth.users` who has at least one row in
`invite_codes` (i.e. redeemed an Early Access invite). One-liner SQL to get
the list:

```sql
SELECT u.email
  FROM auth.users u
  JOIN invite_codes ic ON ic.used_by = u.id
 WHERE ic.created_by != 'system'        -- exclude the seed bypass row
 ORDER BY u.email;
```

Suggested email (Bahasa Indonesia):

```
Subject: Campfire keluar dari Early Access — kredit kamu aman

Hai [Nama],

Terima kasih sudah mencoba Campfire selama Early Access. Mulai hari ini
kami resmi membuka pembayaran berbasis kredit — pay-as-you-go, tidak ada
subscription bulanan.

Yang berubah untuk kamu:
• Kredit Early Access kamu yang masih tersisa tidak hangus — tetap bisa
  dipakai sampai habis.
• Untuk top-up, klik "Beli Kredit" di sidebar atau buka /pricing.
• Mode invite-only sudah dimatikan — kamu boleh ajak teman langsung
  tanpa kode undangan.

Kalau ada pertanyaan atau masukan, tombol Feedback masih ada di pojok
kanan bawah.

— Tim Campfire
```

In-app: optionally drop a one-time toast or banner pointing existing users
at `/pricing` for their first paid top-up. Not required — the sidebar
change is enough.

## 3. Grandfather existing free credits

The simplest answer: **do nothing.** Early Access credits live in the same
`user_credits.balance` column that paid credits live in. Once a user has
50 (or whatever) free credits in their balance, those credits will continue
to be debited normally — the user never sees a difference between "free"
and "paid" credits.

If you want to be more generous (e.g. give every Early Access user a thank-
you bonus), use the existing `credit_credits()` SQL helper:

```sql
-- Top up every Early Access redeemer by an extra 50 credits.
DO $$
DECLARE
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT DISTINCT ic.used_by AS user_id
      FROM invite_codes ic
     WHERE ic.used_by IS NOT NULL
       AND ic.created_by != 'system'   -- skip the seed bypass row
  LOOP
    PERFORM public.credit_credits(
      v_user.user_id,
      50,
      'grant'::credit_tx_type,
      'Early Access thank-you bonus',
      NULL
    );
  END LOOP;
END $$;
```

If you want to **clawback** unused Early Access credits (don't recommend —
bad founder energy), there is no built-in helper. You'd debit each user
back to zero with a custom SQL script and an entry in `credit_transactions`
typed as `'debit'`. Pre-launch users will notice and complain; budget for
that conversation before running it.

## 4. Verification after rollback

- [ ] Visit `/pricing` while signed in as a user → pack grid renders, not
      the placeholder.
- [ ] Sidebar shows the "Beli Kredit" link, not the Early Access pill.
- [ ] Sign up with a brand-new email → no `/auth/redeem-invite` redirect →
      lands on `/onboarding` directly.
- [ ] New user's `user_credits.balance` is 0 (or whatever
      `FREE_CREDITS_ON_SIGNUP` is set to in paid mode).
- [ ] Hit `/api/admin/usage-stats` — still works for monitoring.
- [ ] One Stripe checkout test purchase (use card `4242 4242 4242 4242`)
      to confirm the gateway flow is alive.

## 5. Re-enabling Early Access later

If you ever want to re-open invite-only access (e.g. for a private beta
of a new feature), just flip the four flags back. The `early_access_seen`
flag is per-user, so existing users won't see the welcome modal a second
time — only fresh signups will. To re-show the modal to everyone:

```sql
UPDATE user_profiles SET early_access_seen = FALSE;
-- and ask users to clear localStorage key 'campfire_eap_seen'
-- (or rev the key name in components/onboarding/OnboardingModal.tsx)
```
