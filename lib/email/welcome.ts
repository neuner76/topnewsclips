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
    ${p("Most Americans are making sense of the world with incomplete information.")}
    ${p("US media covers about 5% of global news. Cable news is designed to maximize watch time through outrage and fear. And the stories that don't fit the cycle — bodycam footage, international events, independent investigations — just don't make it through.")}
    ${p("Top News Clips closes that gap.")}
    ${p("Every morning you'll get:")}
    <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.8;color:#374151;">
      <li>Stories verified as real but underreported by mainstream outlets</li>
      <li style="margin-top:6px;">What the rest of the world is watching that US media has skipped</li>
      <li style="margin-top:6px;">How other countries are framing today's biggest stories</li>
      <li style="margin-top:6px;">All of it in 5 minutes — so you can go on with your day informed, not anxious</li>
    </ul>
    ${p("Here's what's live right now:")}
    ${cta("Read today's stories →", `${SITE_URL}/?view=clips&${UTM}`)}
    ${p("Your first daily briefing arrives tomorrow morning.")}
    <p style="margin:0;font-size:14px;color:#6b7280;">— Top News Clips</p>
  `, email)
}

function email1Text(email: string) {
  return `Most Americans are making sense of the world with incomplete information.

US media covers about 5% of global news. Cable news is designed to maximize watch time through outrage and fear. And the stories that don't fit the cycle — bodycam footage, international events, independent investigations — just don't make it through.

Top News Clips closes that gap.

Every morning you'll get:

- Stories verified as real but underreported by mainstream outlets
- What the rest of the world is watching that US media has skipped
- How other countries are framing today's biggest stories
- All of it in 5 minutes — so you can go on with your day informed, not anxious

Here's what's live right now:
${SITE_URL}/?view=clips&${UTM}

Your first daily briefing arrives tomorrow morning.

— Top News Clips

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
    ${cta("Read this morning's briefing →", `${SITE_URL}/?view=clips&${UTM}`)}
    ${p('Browse stories with the Limited Coverage badge: <a href="' + SITE_URL + '/stories?category=all&' + UTM + '" style="color:#0e7490;">See Limited Coverage stories →</a>')}
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

// ─── Email 2.5: Habit reinforcement (day 4) ──────────────────────────────────

function email25Html(email: string) {
  return wrap(`
    ${p("Four days of briefings. Here's what that means in practice.")}
    ${p("You've seen stories this week that didn't make the evening news — bodycam footage that went viral without cable coverage, international events US outlets skipped entirely, independent journalists reporting on things major newsrooms aren't touching.")}
    ${p("That's every day. The pipeline runs overnight. By morning, the stories are curated, verified, and waiting.")}
    ${p("Most people get their news from whatever their feed surfaces. You're now getting a second layer — the one the algorithm doesn't show you.")}
    ${cta("This morning's stories →", `${SITE_URL}/?view=clips&${UTM}`)}
  `, email)
}

function email25Text(email: string) {
  return `Four days of briefings. Here's what that means in practice.

You've seen stories this week that didn't make the evening news — bodycam footage that went viral without cable coverage, international events US outlets skipped entirely, independent journalists reporting on things major newsrooms aren't touching.

That's every day. The pipeline runs overnight. By morning, the stories are curated, verified, and waiting.

Most people get their news from whatever their feed surfaces. You're now getting a second layer — the one the algorithm doesn't show you.

This morning's stories:
${SITE_URL}/?view=clips&${UTM}

---
Unsubscribe: ${unsubscribeLink(email)}`
}

// ─── Email 3: Refer a friend (day 14) ────────────────────────────────────────

function referralUrl(referralCode: string) {
  return `${SITE_URL}?ref=${referralCode}&utm_source=email&utm_medium=referral&utm_campaign=email3`
}

function email3Html(email: string, referralCode: string) {
  const refUrl = referralUrl(referralCode)
  const tweetText = encodeURIComponent(`I've been reading TopNewsClips every morning — stories the mainstream media isn't covering, global events US outlets ignore, and a 5-minute briefing that actually keeps you informed.\n\n${refUrl}`)
  return wrap(`
    ${p("Two weeks in. You've now seen stories that didn't make the evening news — consistently, every morning.")}
    ${p("That's not an accident — it's the point. TopNewsClips surfaces what mainstream media underreports, what the world is watching that US outlets ignore, and packages it so you're done in 5 minutes.")}
    ${p("If it's been worth your morning minute, the most valuable thing you can do is send it to one person who'd want the same thing. They get it free. You help build something independent.")}
    <div style="margin:24px 0;padding:20px;background:#f0fdfc;border:1px solid #99f6e4;border-radius:8px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#0e7490;letter-spacing:0.08em;text-transform:uppercase;">Your personal referral link</p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;word-break:break-all;">${refUrl}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a href="https://twitter.com/intent/tweet?text=${tweetText}" style="display:inline-block;background:#000000;color:#ffffff;font-size:13px;font-weight:700;padding:10px 18px;border-radius:6px;text-decoration:none;">Share on X</a>
        <a href="https://wa.me/?text=${encodeURIComponent(`Stories mainstream media isn't covering — free daily briefing:\n${refUrl}`)}" style="display:inline-block;background:#25d366;color:#ffffff;font-size:13px;font-weight:700;padding:10px 18px;border-radius:6px;text-decoration:none;">Share on WhatsApp</a>
      </div>
    </div>
    ${p("That's it. See you tomorrow morning.")}
  `, email)
}

function email3Text(email: string, referralCode: string) {
  const refUrl = referralUrl(referralCode)
  return `Two weeks in. You've now seen stories that didn't make the evening news — consistently, every morning.

That's not an accident — it's the point. TopNewsClips surfaces what mainstream media underreports, what the world is watching that US outlets ignore, and packages it so you're done in 5 minutes.

If it's been worth your morning minute, send it to one person who'd want the same thing. They get it free.

Your personal referral link:
${refUrl}

That's it. See you tomorrow morning.

---
Unsubscribe: ${unsubscribeLink(email)}`
}

// ─── Trigger all three ────────────────────────────────────────────────────────

export async function sendWelcomeSequence(email: string, referralCode: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const resend = new Resend(resendKey)

  const unsubHeaders = {
    'List-Unsubscribe': `<${unsubscribeLink(email)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }

  const day2  = new Date(Date.now() +  2 * 24 * 60 * 60 * 1000).toISOString()
  const day4  = new Date(Date.now() +  4 * 24 * 60 * 60 * 1000).toISOString()
  const day14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

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
      subject: "Four days in — here's what you've been getting",
      html: email25Html(email),
      text: email25Text(email),
      headers: unsubHeaders,
      scheduledAt: day4,
    }),
    resend.emails.send({
      from: FROM,
      to: email,
      subject: "Know someone who'd want this?",
      html: email3Html(email, referralCode),
      text: email3Text(email, referralCode),
      headers: unsubHeaders,
      scheduledAt: day14,
    }),
  ])
}
