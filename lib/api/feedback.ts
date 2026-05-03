export type Sentiment = "positive" | "neutral" | "negative"

export type FeedbackInput = {
  sentiment: Sentiment
  message: string
  path: string
}

export type FeedbackResult = { ok: true } | { ok: false; error: string }

export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    return { ok: false, error: json?.error ?? `HTTP ${res.status}` }
  }
  return { ok: true }
}
