/**
 * Email compliance footer + List-Unsubscribe headers.
 *
 * Compliance refs:
 *  - CAN-SPAM Act 15 USC §7704 — physical address + opt-out required
 *  - GDPR Art. 21 — right to object
 *  - UU PDP Indonesia Pasal 26 — direct marketing requires opt-out
 *  - RFC 8058 — List-Unsubscribe-Post one-click standard
 *  - Gmail/Yahoo bulk sender requirements (Feb 2024)
 */

const PHYSICAL_ADDRESS =
  process.env.SENDER_PHYSICAL_ADDRESS ??
  "Campfire · Surabaya, Jawa Timur, Indonesia"

export function buildUnsubscribeUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://campfire.web.id"
  return `${baseUrl.replace(/\/$/, "")}/api/unsubscribe/${token}`
}

export function buildEmailHeaders(token: string): Record<string, string> {
  const url = buildUnsubscribeUrl(token)
  return {
    "List-Unsubscribe": `<${url}>, <mailto:unsubscribe@campfire.web.id?subject=unsubscribe-${token}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}

export function injectFooter(htmlBody: string, token: string): string {
  const url = buildUnsubscribeUrl(token)
  const footer = `
<br><br>
<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px;">
<div style="font-size: 12px; color: #9ca3af; line-height: 1.5; font-family: -apple-system, system-ui, sans-serif;">
  <p style="margin: 0 0 8px;">${PHYSICAL_ADDRESS}</p>
  <p style="margin: 0;">
    Email ini disusun dengan bantuan AI dan dikirim sebagai bagian dari outreach B2B.
    Tidak ingin menerima email lagi?
    <a href="${url}" style="color: #6b7280; text-decoration: underline;">Berhenti berlangganan</a>.
  </p>
</div>`
  return htmlBody + footer
}
