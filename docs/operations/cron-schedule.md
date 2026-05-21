# Cron Schedule — Current State + Required Action

## Current state (vercel.json)

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

So the schedule is intentionally daily until one of the options below is
chosen.

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

### B2. GitHub Actions

`.github/workflows/cron.yml`:

```yaml
name: Campfire dispatcher cron
on:
  schedule:
    - cron: "*/15 * * * *"
jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
               https://campfire.web.id/api/cron/dispatch
      - run: |
          curl -fsS -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
               https://campfire.web.id/api/cron/recover-stuck-locks
        if: github.event_name == 'schedule'
```

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

This requires the `pg_net` extension to be enabled.

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
| B2 — GitHub Actions | $0 | 15 min | Minimal moving parts; depends on GH availability |
| B3 — Supabase pg_cron | $0 | 20 min | Closest to data, but requires pg_net extension |
