# Prompt: Phase 2 — Webhook Infrastructure Hardening

## Konteks Sistem
Campfire adalah aplikasi B2B outreach berbasis Next.js 14 + Supabase + Resend.
Infrastruktur Webhook Phase 1 sudah live (opens, clicks, inbound reply).
Phase 2 bertujuan menguatkan perlindungan reputasi domain dan visibilitas operasional.

## File Kritis yang Harus Dipahami Sebelum Mengeksekusi
- `app/api/webhooks/resend/route.ts` — Webhook receiver utama (sudah ada Svix verification)
- `supabase/migrations/008_resend_rpc.sql` — RPC functions untuk increment analytics
- `supabase/migrations/011_auto_initialize_analytics.sql` — Auto-init trigger
- `lib/api/analytics.ts` — Frontend data fetcher Pulse
- `app/pulse/page.tsx` — Dashboard UI dengan STATUS_CONFIG

---

## TASK 1 — Database: Buat Migration `012_bounce_complaint_rpc.sql`

Buat file `supabase/migrations/012_bounce_complaint_rpc.sql` dengan isi berikut:

```sql
-- =============================================================================
-- 012: Bounce & Complaint RPC
--
-- Menangani email.bounced dan email.complained dari Resend Webhook.
-- Bounce: update status kampanye jadi 'bounced', catat alasan.
-- Complaint: update engagement_status jadi 'complained', flag untuk suppression.
-- =============================================================================

-- Fungsi untuk menangani bounce
CREATE OR REPLACE FUNCTION handle_email_bounced(
  p_campaign_email_id uuid,
  p_bounce_reason text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_campaign_analytics_id uuid;
BEGIN
  -- Update campaign_emails status menjadi 'bounced'
  UPDATE campaign_emails
  SET status = 'bounced', updated_at = now()
  WHERE id = p_campaign_email_id;

  -- Update email_analytics engagement_status
  UPDATE email_analytics
  SET engagement_status = 'bounced', updated_at = now()
  WHERE campaign_email_id = p_campaign_email_id
  RETURNING campaign_analytics_id INTO v_campaign_analytics_id;

  -- Kurangi emails_sent di campaign_analytics (email ini gagal terkirim)
  IF v_campaign_analytics_id IS NOT NULL THEN
    UPDATE campaign_analytics
    SET
      emails_sent = GREATEST(emails_sent - 1, 0),
      updated_at  = now()
    WHERE id = v_campaign_analytics_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Fungsi untuk menangani spam complaint
CREATE OR REPLACE FUNCTION handle_email_complained(p_campaign_email_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE email_analytics
  SET engagement_status = 'complained', updated_at = now()
  WHERE campaign_email_id = p_campaign_email_id;

  UPDATE campaign_emails
  SET status = 'complained', updated_at = now()
  WHERE id = p_campaign_email_id;
END;
$$ LANGUAGE plpgsql;
```

**Setelah membuat file, jalankan SQL ini di Supabase SQL Editor.**

---

## TASK 2 — Backend: Update `app/api/webhooks/resend/route.ts`

Di dalam file ini, lakukan 3 perubahan:

### 2a. Perluas `ResendWebhookEvent` interface
Tambahkan field `bounce` opsional di dalam `data`:
```typescript
interface ResendWebhookEvent {
  type: string
  data: {
    email_id?: string
    tags?: Record<string, string>
    bounce?: {
      type?: string
      message?: string
    }
  }
}
```

### 2b. Tambahkan penanganan `email.bounced` dan `email.complained`
Setelah blok `if (!campaignEmailId)` dan sebelum blok `const rpcMap`, tambahkan handler khusus untuk kedua event ini:

```typescript
// --- Special handlers: bounced & complained ---
if (eventType === "email.bounced") {
  try {
    const sb = buildSupabase()
    const bounceReason = event.data?.bounce?.message ?? null
    const { error } = await sb.rpc("handle_email_bounced", {
      p_campaign_email_id: campaignEmailId,
      p_bounce_reason: bounceReason,
    })
    if (error) {
      console.error("[Webhook/resend] handle_email_bounced error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.warn(`[Webhook/resend] BOUNCE detected for campaign_email_id: ${campaignEmailId}`)
    return NextResponse.json({ ok: true, event: eventType, action: "bounced" })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

if (eventType === "email.complained") {
  try {
    const sb = buildSupabase()
    const { error } = await sb.rpc("handle_email_complained", {
      p_campaign_email_id: campaignEmailId,
    })
    if (error) {
      console.error("[Webhook/resend] handle_email_complained error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.warn(`[Webhook/resend] SPAM COMPLAINT for campaign_email_id: ${campaignEmailId}`)
    return NextResponse.json({ ok: true, event: eventType, action: "complained" })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

### 2c. Tambahkan `email.failed` ke rpcMap — log only (tidak ada RPC)
Tambahkan case eksplisit sebelum `const rpcName = rpcMap[eventType]`:
```typescript
if (eventType === "email.failed") {
  console.error(`[Webhook/resend] EMAIL FAILED for campaign_email_id: ${campaignEmailId}`, event.data)
  return NextResponse.json({ ok: true, event: eventType, action: "logged" })
}
```

---

## TASK 3 — UI: Update `app/pulse/page.tsx` STATUS_CONFIG

Tambahkan dua entry baru di dalam objek `STATUS_CONFIG`:

```typescript
bounced: {
  label: "Bounced",
  color: "text-red-700",
  bg: "bg-red-100 border-red-200",
  icon: <AlertTriangle className="w-3 h-3" />,
},
complained: {
  label: "Spam Complained",
  color: "text-rose-800",
  bg: "bg-rose-100 border-rose-200",
  icon: <ShieldAlert className="w-3 h-3" />,
},
```

Import `AlertTriangle` dan `ShieldAlert` dari `lucide-react`.

---

## TASK 4 — Dashboard Resend: Daftarkan Event Baru di Webhook

Setelah semua kode dieksekusi:
1. Buka Resend Dashboard → Webhooks → klik Webhook utama (yang mengarah ke `/api/webhooks/resend`).
2. Klik **Edit** → centang tambahan events: `email.bounced`, `email.complained`, `email.failed`.
3. Simpan.

---

## Verification Checklist

Setelah implementasi selesai, pastikan:
- [ ] `tsc --noEmit` pass tanpa error
- [ ] Migration SQL sudah dijalankan di Supabase (function `handle_email_bounced` dan `handle_email_complained` muncul di SQL Editor)
- [ ] Resend Webhook Dashboard sudah mencantumkan 5 events: `email.opened`, `email.clicked`, `email.bounced`, `email.complained`, `email.failed`
- [ ] UI Pulse memiliki badge merah untuk status "Bounced" dan "Spam Complained"
