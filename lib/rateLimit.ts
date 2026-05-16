// In-process sliding-window rate limiter keyed by an arbitrary string
// (typically a Supabase user_id). Zero dependencies.
//
// NOTE: in-process state does not coordinate across Vercel serverless
// instances. This is a "best-effort" defense-in-depth layer until Redis/
// Upstash can be wired in. It still raises the cost of abuse meaningfully
// because individual instances are warm for tens of minutes per region.

interface Bucket {
  events: number[]
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

export function checkRateLimit(
  key: string,
  maxEvents: number,
  windowMs: number,
): RateLimitResult {
  if (!key) {
    // Fail open — callers should auth before calling this
    return { allowed: true, retryAfterSeconds: 0 }
  }

  const now = Date.now()
  const cutoff = now - windowMs

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { events: [] }
    buckets.set(key, bucket)
  }

  // Drop expired events
  while (bucket.events.length && bucket.events[0] < cutoff) {
    bucket.events.shift()
  }

  if (bucket.events.length >= maxEvents) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.events[0] + windowMs - now) / 1000),
    )
    return { allowed: false, retryAfterSeconds }
  }

  bucket.events.push(now)
  return { allowed: true, retryAfterSeconds: 0 }
}
