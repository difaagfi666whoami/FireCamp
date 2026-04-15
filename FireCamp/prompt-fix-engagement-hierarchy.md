# Prompt: Fix Engagement Status Hierarchy — Supabase RPC

## Konteks Masalah
Di aplikasi Campfire (B2B outreach), setiap email yang dikirim memiliki satu baris
di tabel `email_analytics` dengan kolom `engagement_status`.

Saat ini ada **bug degradasi status**: RPC function `increment_email_opens` dan
`increment_email_clicks` selalu mengoverwrite `engagement_status` tanpa memperhatikan
nilai sebelumnya. Akibatnya:

**Skenario bug:**
1. Resend tembak `email.opened` → `engagement_status = 'opened'` ✅
2. Resend tembak `email.replied` → `engagement_status = 'replied'` ✅
3. Resend tembak `email.opened` (Google Image Proxy re-opens) → `engagement_status = 'opened'` ❌ MUNDUR!

Dashboard Pulse menunjukkan "Opened" padahal seharusnya "Replied".

## Hirarki Status yang Benar
```
pending(0) → sent(1) → opened(2) → clicked(3) → replied(4)
Terminal states (satu arah, tidak boleh di-overwrite): bounced, complained, failed
```
**Aturan: status hanya boleh NAIK, tidak boleh TURUN.**

---

## TASK 1 — Perbarui RPC via MCP Supabase

Gunakan MCP Supabase untuk menjalankan query SQL berikut langsung ke database.
Buat juga file migration baru `supabase/migrations/013_fix_engagement_status_hierarchy.sql`
dengan konten yang sama.

```sql
-- =============================================================================
-- 013: Fix Engagement Status Hierarchy
-- Status hanya boleh naik dalam hirarki, tidak boleh turun.
-- Hirarki: pending → sent → opened → clicked → replied
-- Terminal: bounced, complained, failed — tidak bisa dioverwrite apapun.
-- =============================================================================

CREATE OR REPLACE FUNCTION increment_email_opens(p_campaign_email_id uuid)
RETURNS void AS $$
DECLARE
  v_campaign_analytics_id uuid;
  v_total_sent integer;
  v_total_opens integer;
  v_current_status text;
BEGIN
  SELECT engagement_status INTO v_current_status
  FROM email_analytics
  WHERE campaign_email_id = p_campaign_email_id;

  UPDATE email_analytics
  SET
    opens = opens + 1,
    updated_at = now(),
    engagement_status = CASE
      WHEN v_current_status IN ('bounced', 'complained', 'failed', 'clicked', 'replied')
        THEN v_current_status  -- jangan turunkan status yang lebih tinggi
      ELSE 'opened'
    END
  WHERE campaign_email_id = p_campaign_email_id
  RETURNING campaign_analytics_id INTO v_campaign_analytics_id;

  IF v_campaign_analytics_id IS NOT NULL THEN
    SELECT emails_sent INTO v_total_sent
    FROM campaign_analytics WHERE id = v_campaign_analytics_id;

    IF COALESCE(v_total_sent, 0) > 0 THEN
      SELECT sum(opens) INTO v_total_opens
      FROM email_analytics WHERE campaign_analytics_id = v_campaign_analytics_id;

      UPDATE campaign_analytics
      SET open_rate = ROUND(LEAST((v_total_opens::numeric / v_total_sent::numeric) * 100, 100.0), 2)
      WHERE id = v_campaign_analytics_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION increment_email_clicks(p_campaign_email_id uuid)
RETURNS void AS $$
DECLARE
  v_campaign_analytics_id uuid;
  v_total_sent integer;
  v_total_clicks integer;
  v_current_status text;
BEGIN
  SELECT engagement_status INTO v_current_status
  FROM email_analytics
  WHERE campaign_email_id = p_campaign_email_id;

  UPDATE email_analytics
  SET
    clicks = clicks + 1,
    updated_at = now(),
    engagement_status = CASE
      WHEN v_current_status IN ('bounced', 'complained', 'failed', 'replied')
        THEN v_current_status  -- 'replied' tidak boleh diturunkan ke 'clicked'
      ELSE 'clicked'
    END
  WHERE campaign_email_id = p_campaign_email_id
  RETURNING campaign_analytics_id INTO v_campaign_analytics_id;

  IF v_campaign_analytics_id IS NOT NULL THEN
    SELECT emails_sent INTO v_total_sent
    FROM campaign_analytics WHERE id = v_campaign_analytics_id;

    IF COALESCE(v_total_sent, 0) > 0 THEN
      SELECT sum(clicks) INTO v_total_clicks
      FROM email_analytics WHERE campaign_analytics_id = v_campaign_analytics_id;

      UPDATE campaign_analytics
      SET click_rate = ROUND(LEAST((v_total_clicks::numeric / v_total_sent::numeric) * 100, 100.0), 2)
      WHERE id = v_campaign_analytics_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

## TASK 2 — Perbaiki Data yang Sudah Terdegradasi via MCP Supabase

Setelah RPC diperbarui, jalankan query perbaikan data ini.
Cari baris `email_analytics` yang `engagement_status`-nya sudah terdegradasi
(status = 'opened' tapi kolom `replies` > 0):

```sql
-- Fix: Kembalikan status ke 'replied' untuk semua email yang punya replies > 0
-- tapi statusnya terdegradasi menjadi 'opened' atau 'clicked'
UPDATE email_analytics
SET
  engagement_status = 'replied',
  updated_at = now()
WHERE
  replies > 0
  AND engagement_status IN ('opened', 'clicked', 'sent', 'pending');

-- Verifikasi hasil fix
SELECT
  campaign_email_id,
  email_number,
  opens,
  clicks,
  replies,
  engagement_status,
  updated_at
FROM email_analytics
ORDER BY updated_at DESC
LIMIT 10;
```

---

## TASK 3 — Verifikasi

Setelah kedua task selesai, lakukan verifikasi berikut:

1. Jalankan query check via MCP:
```sql
SELECT
  ce.sequence_number,
  ce.status AS dispatch_status,
  ea.engagement_status,
  ea.opens,
  ea.clicks,
  ea.replies
FROM campaign_emails ce
LEFT JOIN email_analytics ea ON ea.campaign_email_id = ce.id
ORDER BY ce.sequence_number;
```

2. Konfirmasi bahwa:
   - Email 1 (yang punya replies > 0) → `engagement_status = 'replied'`
   - Email 2 & Email 3 (belum dikirim) → `engagement_status = 'pending'`

3. Laporkan hasil SELECT tersebut setelah selesai.
