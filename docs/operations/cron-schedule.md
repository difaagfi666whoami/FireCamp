# Cron Schedule — Current State + Active Configuration

## Active configuration — B2 (GitHub Actions) ✓

Two workflow files trigger the cron endpoints externally, bypassing the
Vercel Hobby plan's daily-only restriction:

| Workflow | Schedule | Endpoint |
|---|---|---|
| `.github/workflows/cron-dispatch.yml` | `*/15 * * * *` | `/api/cron/dispatch` |
| `.github/workflows/cron-recover.yml` | `*/30 * * * *` | `/api/cron/recover-stuck-locks` |

Both use `CRON_SECRET` stored as a GitHub repository secret
(Settings → Secrets and variables → Actions → `CRON_SECRET`).
The value must match `CRON_SECRET` in Vercel's production environment.

`vercel.json` retains its daily `0 0 * * *` dispatch cron as a cold
fallback — it fires once/day if GitHub Actions is unavailable.

### Setup checklist (one-time)

1. Add `CRON_SECRET` as a GitHub repository secret (same value as in Vercel)
2. Push `.github/workflows/cron-dispatch.yml` and `cron-recover.yml` to `main`
3. Verify via GitHub Actions → "Run workflow" button (manual trigger)
4. Expected response: `{"dispatched":0}` or `{"dispatched":N}` — both are correct

---

## Background — why Vercel cron is daily-only

```json
{
  "crons": [
    { "path": "/api/cron/dispatch", "schedule": "0 0 * * *" }
  ]
}
```

Vercel runs `/api/cron/dispatch` **once per day at 00:00 UTC** (07:00 WIB).
That means an email scheduled for 10:00 WIB today actually goes out the
next day at 07:00 WIB — a delay of up to **21 hours**.

The dispatcher's code comment says "runs every 15 min" — accurate only if
the schedule below is changed to a 15-minute crontab. Doing that on the
Vercel **Hobby** plan fails at deploy with:

> Hobby accounts are limited to daily cron jobs. This cron expression
> (\*/15 \* \* \* \*) would run more than once per day.

---

## Option A — Vercel Pro ($20/mo)

Switch the project to Pro, then change vercel.json to:

```json
{
  "crons": [
    { "path": "/api/cron/dispatch",            "schedule": "*/15 * * * *" },
    { "path": "/api/cron/recover-stuck-locks", "schedule": "*/30 * * * *" }
  ]
}
```

`/api/cron/recover-stuck-locks` already exists in the codebase and will
work as soon as the schedule is wired up.

## Option B — External scheduler (free)

Keep Vercel Hobby; trigger the cron endpoints from outside Vercel.

### B1. Upstash QStash (free: 500 msgs/day)

```bash
curl -X POST https://qstash.upstash.io/v2/schedules \
  -H "Authorization: Bearer $QSTASH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "https://campfire.web.id/api/cron/dispatch",
    "cron": "*/15 * * * *",
    "headers": { "Authorization": "Bearer YOUR_CRON_SECRET" }
  }'
```

### B2. GitHub Actions — ACTIVE ✓

Two separate workflows with independent schedules. See
`.github/workflows/cron-dispatch.yml` and `.github/workflows/cron-recover.yml`.

### B3. Supabase pg_cron

Inside the database, run:

```sql
SELECT cron.schedule(
  'campfire_dispatcher',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://campfire.web.id/api/cron/dispatch',
      headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
    );
  $$
);
```

This requires the `pg_net` extension to be enabled in Supabase Dashboard →
Database → Extensions.

## Why this matters

Email scheduling is the entire point of the Launch milestone. With
daily cron the product currently honors send times only at midnight UTC.
For real customer use, 15-minute cadence is the minimum acceptable
granularity.

## Decision matrix

| Option | Cost | Setup time | Notes |
|---|---|---|---|
| A — Vercel Pro | $20/mo | 5 min | Cleanest; cron lives next to code |
| B1 — QStash | $0 (within 500/day) | 30 min | Most production-ready outside Vercel |
| **B2 — GitHub Actions** | **$0** | **DONE** | **ACTIVE — workflows in .github/workflows/** |
| B3 — Supabase pg_cron | $0 | 20 min | Closest to data, but requires pg_net extension |
