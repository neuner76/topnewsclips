import { Resend } from 'resend'

const SITE_URL = 'https://www.topnewsclips.com'
const FROM = 'TopNewsClips <digest@topnewsclips.com>'

function unsubscribeLink(email: string) {
  return `${SITE_URL}/api/unsubscribe?email=${encodeURIComponent(email)}`
}

function footer(email: string) {
  return `
    <div style="padding:24px 32px;border-top:1px solid #e5e7eb;text-align:center;">
      <a href="${SITE_URL}" style="font-size:13px;font-weight:700;color:#0e7490;text-decoration:none;">topnewsclips.com</a>
      <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;">
        You're receiving this because you subscribed at topnewsclips.com.<br>
        <a href="${unsubscribeLink(email)}" style="color:#9ca3af;">Unsubscribe</a>
      </p>
    </div>`
}

function header() {
  return `
    <div style="background:#ffffff;border-bottom:3px solid #0e7490;padding:20px 32px;">
      <a href="${SITE_URL}" style="text-decoration:none;">
        <div style="font-size:22px;font-weight:900;letter-spacing:-0.03em;color:#111827;">TopNewsClips</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px;">Independent news. No agenda.</div>
      </a>
    </div>`
}

function wrap(body: string, email: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;">
    ${header()}
    <div style="padding:32px;">${body}</div>
    ${footer(email)}
  </div>
</body>
</html>`
}

const p = (text: string) =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#374151;">${text}</p>`

const cta = (text: string, href: string) =>
  `<div style="margin:24px 0;">
    <a href="${href}" style="display:inline-block;background:#0e7490;color:#ffffff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none;">${text}</a>
  </div>`

// ─── Email 1: Welcome (immediate) ────────────────────────────────────────────

function email1Html(email: string) {
  return wrap(`
    ${p("You just subscribed to something different.")}
    ${p("No algorithm deciding what you should be angry about. No cable news narrative. Just the footage, investigations, and global stories that actually happened — verified, curated, and sent every morning.")}
    ${p("Here's what's live right now:")}
    ${cta("Read today's stories →", SITE_URL)}
    ${p("Your first daily briefing arrives tomorrow morning.")}
    <p style="margin:0;font-size:14px;color:#6b7280;">— TopNewsClips</p>
  `, email)
}

function email1Text(email: string) {
  return `You just subscribed to something different.

No algorithm. No cable news narrative. Just the footage, investigations, and global stories that actually happened — verified, curated, sent every morning.

Here's what's live right now:
${SITE_URL}

Your first daily briefing arrives tomorrow morning.

— TopNewsClips

---
Unsubscribe: ${unsubscribeLink(email)}`
}

// ─── Email 2: What MSM Blackout means (day 2) ────────────────────────────────

function email2Html(email: string) {
  return wrap(`
    ${p("You'll notice some stories carry an <strong>MSM Blackout</strong> badge.")}
    ${p("It means this: the story is verified and newsworthy, but fewer than 5 major mainstream outlets have covered it. Real event. Real footage. Corporate media just isn't touching it.")}
    ${p("That's not a conspiracy theory — it's a coverage gap. Advertisers, editorial politics, and the 24-hour cycle all shape what gets airtime. TopNewsClips surfaces what falls through.")}
    ${p("You'll also see <strong>Global Blindspot</strong> — international stories the world is covering that US media is ignoring.")}
    ${cta("Read this morning's digest →", SITE_URL)}
  `, email)
}

function email2Text(email: string) {
  return `You'll notice some stories carry an MSM Blackout badge.

It means this: the story is verified and newsworthy, but fewer than 5 major mainstream outlets have covered it. Real event. Real footage. Corporate media just isn't touching it.

That's not a conspiracy theory — it's a coverage gap. Advertisers, editorial politics, and the 24-hour cycle all shape what gets airtime. TopNewsClips surfaces what falls through.

You'll also see Global Blindspot — international stories the world is covering that US media is ignoring.

Read this morning's digest:
${SITE_URL}

---
Unsubscribe: ${unsubscribeLink(email)}`
}

// ─── Email 3: Refer a friend (day 5) ─────────────────────────────────────────

function email3Html(email: string) {
  return wrap(`
    ${p("Five days in. Hopefully you've seen a few stories that made you think <em>\"I hadn't heard about that.\"</em>")}
    ${p("That's the whole point.")}
    ${p("If TopNewsClips has been worth your morning minute, the one thing that helps most is telling one person — a friend, a group chat, anyone who'd want the same thing.")}
    ${cta("Share TopNewsClips →", SITE_URL)}
    ${p("That's it. See you tomorrow morning.")}
  `, email)
}

function email3Text(email: string) {
  return `Five days in. Hopefully you've seen a few stories that made you think "I hadn't heard about that."

That's the whole point.

If TopNewsClips has been worth your morning minute, the one thing that helps most is telling one person — a friend, a group chat, anyone who'd want the same thing.

Share: ${SITE_URL}

That's it. See you tomorrow morning.

---
Unsubscribe: ${unsubscribeLink(email)}`
}

// ─── Trigger all three ────────────────────────────────────────────────────────

export async function sendWelcomeSequence(email: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const resend = new Resend(resendKey)

  const unsubHeaders = {
    'List-Unsubscribe': `<${unsubscribeLink(email)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }

  const day2 = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
  const day5 = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()

  await Promise.allSettled([
    resend.emails.send({
      from: FROM,
      to: email,
      subject: "You're in. Here's today's briefing.",
      html: email1Html(email),
      text: email1Text(email),
      headers: unsubHeaders,
    }),
    resend.emails.send({
      from: FROM,
      to: email,
      subject: 'What "MSM Blackout" means (and why it matters)',
      html: email2Html(email),
      text: email2Text(email),
      headers: unsubHeaders,
      scheduledAt: day2,
    }),
    resend.emails.send({
      from: FROM,
      to: email,
      subject: "If you've found this useful...",
      html: email3Html(email),
      text: email3Text(email),
      headers: unsubHeaders,
      scheduledAt: day5,
    }),
  ])
}
