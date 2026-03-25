import { Resend } from 'resend'

const SITE_URL = 'https://www.topnewsclips.com'
const UTM = 'utm_source=email&utm_medium=email&utm_campaign=welcome'
const SITE_URL_UTM = `${SITE_URL}?${UTM}`
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
    ${p("Every morning, TopNewsClips does four things:")}
    <ol style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.8;color:#374151;">
      <li><strong>Surfaces what mainstream media is underreporting</strong> — verified stories fewer than 3 of the 15 major US outlets are covering.</li>
      <li style="margin-top:8px;"><strong>Covers what the rest of the world is watching</strong> — major international events US outlets have skipped.</li>
      <li style="margin-top:8px;"><strong>Shows how the world frames today's biggest stories</strong> — the same event looks different from Seoul, London, or Lagos.</li>
      <li style="margin-top:8px;"><strong>Makes it digestible</strong> — one briefing, 5 minutes, and you're done. Informed, not anxious.</li>
    </ol>
    ${p("Here's what's live right now:")}
    ${cta("Read today's stories →", SITE_URL_UTM)}
    ${p("Your first daily briefing arrives tomorrow morning.")}
    <p style="margin:0;font-size:14px;color:#6b7280;">— TopNewsClips</p>
  `, email)
}

function email1Text(email: string) {
  return `You just subscribed to something different.

Every morning, TopNewsClips does four things:

1. Surfaces what mainstream media is underreporting — verified stories fewer than 3 of the 15 major US outlets are covering.
2. Covers what the rest of the world is watching — major international events US outlets have skipped.
3. Shows how the world frames today's biggest stories — the same event looks different from Seoul, London, or Lagos.
4. Makes it digestible — one briefing, 5 minutes, and you're done. Informed, not anxious.

Here's what's live right now:
${SITE_URL_UTM}

Your first daily briefing arrives tomorrow morning.

— TopNewsClips

---
Unsubscribe: ${unsubscribeLink(email)}`
}

// ─── Email 2: The two signals (day 2) ────────────────────────────────────────

function email2Html(email: string) {
  return wrap(`
    ${p("You'll notice two badges on some stories. Here's what they mean.")}
    ${p("<strong>Limited Coverage</strong> — the story is verified and newsworthy, but fewer than 3 of the 15 major US outlets we monitor had covered it at the time of publication. Real event. Corporate media just isn't on it yet — or isn't going to be.")}
    ${p("<strong>Global Blindspot</strong> — an international story that the rest of the world considers major news, but US outlets have largely skipped. Not because it isn't significant. Because it doesn't fit the domestic news cycle.")}
    ${p("Neither badge is a conspiracy claim. Both are a coverage measurement. You decide what to make of it.")}
    ${cta("Read this morning's briefing →", SITE_URL_UTM)}
  `, email)
}

function email2Text(email: string) {
  return `You'll notice two badges on some stories. Here's what they mean.

Limited Coverage — the story is verified and newsworthy, but fewer than 3 of the 15 major US outlets we monitor had covered it at the time of publication. Real event. Corporate media just isn't on it yet — or isn't going to be.

Global Blindspot — an international story that the rest of the world considers major news, but US outlets have largely skipped. Not because it isn't significant. Because it doesn't fit the domestic news cycle.

Neither badge is a conspiracy claim. Both are a coverage measurement. You decide what to make of it.

Read this morning's briefing:
${SITE_URL_UTM}

---
Unsubscribe: ${unsubscribeLink(email)}`
}

// ─── Email 3: Refer a friend (day 5) ─────────────────────────────────────────

function email3Html(email: string) {
  return wrap(`
    ${p("Five days in. Hopefully you've seen a few stories that made you think <em>\"I hadn't heard about that.\"</em>")}
    ${p("That's the whole point.")}
    ${p("If TopNewsClips has been worth your morning minute, the one thing that helps most is telling one person — a friend, a group chat, anyone who'd want the same thing.")}
    ${cta("Share TopNewsClips →", SITE_URL_UTM)}
    ${p("That's it. See you tomorrow morning.")}
  `, email)
}

function email3Text(email: string) {
  return `Five days in. Hopefully you've seen a few stories that made you think "I hadn't heard about that."

That's the whole point.

If TopNewsClips has been worth your morning minute, the one thing that helps most is telling one person — a friend, a group chat, anyone who'd want the same thing.

Share: ${SITE_URL_UTM}

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
      subject: 'Two badges, two signals — here\'s what they mean',
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
