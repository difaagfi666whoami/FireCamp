export type RedeemResult =
  | { success: true; credits_granted: number }
  | { success: false; error: string }

export async function redeemInviteCode(code: string): Promise<RedeemResult> {
  const res = await fetch("/api/invite-codes/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  })
  return (await res.json()) as RedeemResult
}
