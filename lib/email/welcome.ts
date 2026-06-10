import { Resend } from 'resend'
import { unsubscribeLink } from '@/lib/unsubscribe'

const SITE_URL = 'https://www.topnewsclips.com'
const UTM = 'utm_source=email&utm_medium=email&utm_campaign=welcome'

const FROM = 'TopNewsClips <digest@topnewsclips.com>'

function footer(unsubUrl: string) {
  return `
    <div style="padding:24px 32px;border-top:1px solid #e5e7eb;text-align:center;">
      <a href="${SITE_URL}" style="font-size:13px;font-weight:700;color:#0e7490;text-decoration:none;">topnewsclips.com</a>
      <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;">
        You're receiving this because you subscribed at topnewsclips.com.<br>
        <a href="${unsubUrl}" style="color:#9ca3af;">Unsubscribe</a>
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

function wrap(body: string, unsubUrl: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;">
    ${header()}
    <div style="padding:32px;">${body}</div>
    ${footer(unsubUrl)}
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

function email1Html(unsubUrl: string) {
  return wrap(`
    ${p("Welcome to Top News Clips.")}
    ${p("You just joined a daily briefing that does something simple but surprisingly rare: it shows you what's actually happening.")}
    ${p("US mainstream media covers fewer than 5% of global news stories. Cable networks are built to keep you watching, not keep you informed. And the stories that don't fit — independent investigations, international crises, bodycam footage, institutional accountability reporting — just don't make it through.")}
    ${p("Starting tomorrow morning, they will.")}
    ${p("Here's what your briefing includes:")}
    <ul style="margin:0 0 20px;padding-left:0;list-style:none;font-size:15px;line-height:1.8;color:#374151;">
      <li style="margin-bottom:10px;">→ <strong>Underreported stories</strong> — verified as real, flagged when fewer than 3 of the 15 major US newsrooms we track have covered them. You'll see the exact count.</li>
      <li style="margin-bottom:10px;">→ <strong>Global Blindspots</strong> — international events the rest of the world considers urgent that American media has skipped entirely.</li>
      <li style="margin-bottom:10px;">→ <strong>Global Lens</strong> — how journalists in Seoul, Berlin, Doha, and Lagos are framing the same stories US outlets are covering, so you see what one newsroom can't show you.</li>
      <li style="margin-bottom:10px;">→ <strong>Mainstream Pulse</strong> — what NPR, NYT, AP, Reuters, WSJ, and Fox News are each leading with today, side by side, so you can see the full spectrum in ten seconds.</li>
      <li style="margin-bottom:10px;">→ <strong>Every source labeled by credibility tier</strong> — from Pulitzer-winning nonprofits like ProPublica to public broadcasters like DW News to independent commentators. You always know who's behind what you're reading.</li>
    </ul>
    ${p("All of it in 5 minutes. No spin. No outrage. Just what happened, who it affects, and why it matters to your life.")}
    ${cta("Read today's stories →", `${SITE_URL}/?${UTM}`)}
    ${p("Your first daily briefing arrives tomorrow morning.")}
    <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">— Top News Clips<br><em>Independent News. No Agenda.</em></p>
    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;padding-top:16px;border-top:1px solid #f3f4f6;">P.S. Curious how we classify our sources? We publish a 10-tier Source Credibility Taxonomy so you never have to guess. <a href="${SITE_URL}/taxonomy?${UTM}" style="color:#0e7490;">See how it works →</a></p>
  `, unsubUrl)
}

function email1Text(unsubUrl: string) {
  return `Welcome to Top News Clips.

You just joined a daily briefing that does something simple but surprisingly rare: it shows you what's actually happening.

US mainstream media covers fewer than 5% of global news stories. Cable networks are built to keep you watching, not keep you informed. And the stories that don't fit — independent investigations, international crises, bodycam footage, institutional accountability reporting — just don't make it through.

Starting tomorrow morning, they will.

Here's what your briefing includes:

→ Underreported stories — verified as real, flagged when fewer than 3 of the 15 major US newsrooms we track have covered them. You'll see the exact count.

→ Global Blindspots — international events the rest of the world considers urgent that American media has skipped entirely.

→ Global Lens — how journalists in Seoul, Berlin, Doha, and Lagos are framing the same stories US outlets are covering, so you see what one newsroom can't show you.

→ Mainstream Pulse — what NPR, NYT, AP, Reuters, WSJ, and Fox News are each leading with today, side by side, so you can see the full spectrum in ten seconds.

→ Every source labeled by credibility tier — from Pulitzer-winning nonprofits like ProPublica to public broadcasters like DW News to independent commentators. You always know who's behind what you're reading.

All of it in 5 minutes. No spin. No outrage. Just what happened, who it affects, and why it matters to your life.

Read today's stories:
${SITE_URL}/?${UTM}

Your first daily briefing arrives tomorrow morning.

— Top News Clips
Independent News. No Agenda.

P.S. Curious how we classify our sources? We publish a 10-tier Source Credibility Taxonomy so you never have to guess. See how it works: ${SITE_URL}/taxonomy?${UTM}

---
Unsubscribe: ${unsubUrl}`
}

// ─── Email 2: How to read your briefing (day 2) ──────────────────────────────

function email2Html(unsubUrl: string) {
  return wrap(`
    ${p("Quick guide to reading Top News Clips — takes 60 seconds.")}
    ${p("<strong>Source tier badges</strong> tell you who produced the story and what kind of outlet they are. A story from ProPublica carries a \"Nonprofit Investigative\" badge. A story from DW News carries \"Public Broadcaster.\" A story from Johnny Harris carries \"Independent Commentary.\" You're never guessing where the information comes from.")}
    ${p("<strong>Limited Coverage</strong> means the story is verified and newsworthy, but fewer than 3 of the 15 major US outlets we monitor had covered it at publication time. You'll often see the exact count — \"0 of 15 outlets\" or \"2 of 15 outlets.\" This isn't a conspiracy claim. It's a coverage measurement. You decide what to make of it.")}
    ${p("<strong>Global Blindspot</strong> means the rest of the world considers this story significant, but US media has largely skipped it. Not because it isn't important — because it doesn't fit the domestic news cycle.")}
    ${p("<strong>Global Lens</strong> shows you how international journalists are framing the same stories US outlets are covering. Same event, different perspective. This is where you see what one country's media can't show you.")}
    ${p("<strong>Mainstream Pulse</strong> shows you what NPR, NYT, AP, Reuters, WSJ, and Fox News are each leading with — left to right, side by side. Ten seconds to see the full mainstream spectrum.")}
    ${p("That's it. Now you know how to read every section.")}
    ${cta("Read this morning's briefing →", `${SITE_URL}/?${UTM}`)}
    <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">— Top News Clips<br><em>Independent News. No Agenda.</em></p>
  `, unsubUrl)
}

function email2Text(unsubUrl: string) {
  return `Quick guide to reading Top News Clips — takes 60 seconds.

Source tier badges tell you who produced the story and what kind of outlet they are. A story from ProPublica carries a "Nonprofit Investigative" badge. A story from DW News carries "Public Broadcaster." A story from Johnny Harris carries "Independent Commentary." You're never guessing where the information comes from.

Limited Coverage means the story is verified and newsworthy, but fewer than 3 of the 15 major US outlets we monitor had covered it at publication time. You'll often see the exact count — "0 of 15 outlets" or "2 of 15 outlets." This isn't a conspiracy claim. It's a coverage measurement. You decide what to make of it.

Global Blindspot means the rest of the world considers this story significant, but US media has largely skipped it. Not because it isn't important — because it doesn't fit the domestic news cycle.

Global Lens shows you how international journalists are framing the same stories US outlets are covering. Same event, different perspective. This is where you see what one country's media can't show you.

Mainstream Pulse shows you what NPR, NYT, AP, Reuters, WSJ, and Fox News are each leading with — left to right, side by side. Ten seconds to see the full mainstream spectrum.

That's it. Now you know how to read every section.

Read this morning's briefing:
${SITE_URL}/?${UTM}

— Top News Clips
Independent News. No Agenda.

---
Unsubscribe: ${unsubUrl}`
}

// ─── Email 2.5: Four days in (day 4) ─────────────────────────────────────────

function email25Html(unsubUrl: string) {
  return wrap(`
    ${p("Four days in. Here's what just happened.")}
    ${p("This week your briefing included stories from ProPublica, Bellingcat, Al Jazeera, DW News, The Intercept, Drop Site News, the Associated Press, and a dozen independent journalists — all labeled by credibility tier so you knew exactly what you were reading.")}
    ${p("You saw what NPR, the New York Times, AP, Reuters, the Wall Street Journal, and Fox News were each leading with — side by side — and then you saw what none of them were covering.")}
    ${p("You read stories flagged \"0 of 15 outlets\" that later showed up in mainstream coverage days later. You saw international events through the eyes of journalists in Doha, Seoul, Berlin, and Nairobi — perspectives that never made it into a US broadcast.")}
    ${p("That's every day. Here's what that actually involves. Overnight, the pipeline pulls from hundreds of RSS feeds and two dozen YouTube channels, deduplicates ~300 candidates, and runs each one through a pre-filter that quietly rejects LIVE streams, gaming videos, Cyrillic-only text, broadcast segments that are just an anchor reading bullet points, and anything a Brazilian tabloid would be proud of. What survives gets sent to an AI that checks whether it's a genuine news story or a press release wearing a trench coat — estimating how many of the 15 major newsrooms covered it, assigning a credibility tier from Tier 1 wire services down to independent commentary, and flagging the ones that look important but that nobody seems to be touching yet. Stories clustering around the same incident get capped so one slow news day at the State Department doesn't colonize the entire briefing. Everything that clears all of that goes to a second, more expensive AI, which reads the survivors and actually writes what you got this morning — deciding what belongs in Need To Know versus In The Know, synthesizing the international perspectives into a coherent global picture, and determining what counts as genuinely overlooked versus just unpopular. Then it gets reviewed, filtered one more time for noise that slipped through, and published. By morning, it's waiting. No algorithm optimizing for your outrage. No editor deciding what plays well in an election year. Just the pipeline, doing its thing.")}
    ${p("Most people get their news from whatever the algorithm surfaces. You're now getting the layer underneath — the one built for citizens who want the full picture, not the profitable picture.")}
    ${cta("This morning's briefing →", `${SITE_URL}/?${UTM}`)}
    <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">— Top News Clips<br><em>Independent News. No Agenda.</em></p>
  `, unsubUrl)
}

function email25Text(unsubUrl: string) {
  return `Four days in. Here's what just happened.

This week your briefing included stories from ProPublica, Bellingcat, Al Jazeera, DW News, The Intercept, Drop Site News, the Associated Press, and a dozen independent journalists — all labeled by credibility tier so you knew exactly what you were reading.

You saw what NPR, the New York Times, AP, Reuters, the Wall Street Journal, and Fox News were each leading with — side by side — and then you saw what none of them were covering.

You read stories flagged "0 of 15 outlets" that later showed up in mainstream coverage days later. You saw international events through the eyes of journalists in Doha, Seoul, Berlin, and Nairobi — perspectives that never made it into a US broadcast.

That's every day. Here's what that actually involves. Overnight, the pipeline pulls from hundreds of RSS feeds and two dozen YouTube channels, deduplicates ~300 candidates, and runs each one through a pre-filter that quietly rejects LIVE streams, gaming videos, Cyrillic-only text, broadcast segments that are just an anchor reading bullet points, and anything a Brazilian tabloid would be proud of. What survives gets sent to an AI that checks whether it's a genuine news story or a press release wearing a trench coat — estimating how many of the 15 major newsrooms covered it, assigning a credibility tier from Tier 1 wire services down to independent commentary, and flagging the ones that look important but that nobody seems to be touching yet. Stories clustering around the same incident get capped so one slow news day at the State Department doesn't colonize the entire briefing. Everything that clears all of that goes to a second, more expensive AI, which reads the survivors and actually writes what you got this morning — deciding what belongs in Need To Know versus In The Know, synthesizing the international perspectives into a coherent global picture, and determining what counts as genuinely overlooked versus just unpopular. Then it gets reviewed, filtered one more time for noise that slipped through, and published. By morning, it's waiting. No algorithm optimizing for your outrage. No editor deciding what plays well in an election year. Just the pipeline, doing its thing.

Most people get their news from whatever the algorithm surfaces. You're now getting the layer underneath — the one built for citizens who want the full picture, not the profitable picture.

This morning's briefing:
${SITE_URL}/?${UTM}

— Top News Clips
Independent News. No Agenda.

---
Unsubscribe: ${unsubUrl}`
}

// ─── Email 3: One ask (day 5) ─────────────────────────────────────────────────

function referralUrl(referralCode: string) {
  return `${SITE_URL}?ref=${referralCode}&utm_source=email&utm_medium=referral&utm_campaign=email3`
}

function email3Html(unsubUrl: string, referralCode: string) {
  const refUrl = referralUrl(referralCode)
  const tweetText = encodeURIComponent(`I've been reading TopNewsClips every morning — stories the mainstream media isn't covering, global events US outlets ignore, and a 5-minute briefing that actually keeps you informed.\n\n${refUrl}`)
  return wrap(`
    ${p("Five days in.")}
    ${p("By now you've probably had at least one moment this week where you read something and thought: \"How did I not know about this?\"")}
    ${p("That's the gap this exists to close.")}
    ${p("TopNewsClips is independently operated and funded by its founder. No investors. No advertisers. No institutional backing. Revenue comes from voluntary subscriptions. That's it. No one is paying us to cover — or not cover — any story.")}
    ${p("That means growth comes from one place: people like you telling one other person.")}
    ${p("If this week's briefings have been worth your morning five minutes, the single most valuable thing you can do is send TopNewsClips to someone who'd want the same thing. A friend. A group chat. A colleague who's tired of the algorithm.")}
    ${p("They get it free. You help build something that doesn't exist anywhere else — a daily briefing where every source is labeled, broader blind spots are easier to see, and no one's selling you outrage.")}
    <div style="margin:24px 0;display:flex;gap:10px;flex-wrap:wrap;">
      <a href="https://twitter.com/intent/tweet?text=${tweetText}" style="display:inline-block;background:#000000;color:#ffffff;font-size:13px;font-weight:700;padding:10px 18px;border-radius:6px;text-decoration:none;">Share on X →</a>
      <a href="${refUrl}" style="display:inline-block;background:#0e7490;color:#ffffff;font-size:13px;font-weight:700;padding:10px 18px;border-radius:6px;text-decoration:none;">Send them the link →</a>
    </div>
    ${p("That's it. See you tomorrow morning.")}
    <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">— Top News Clips<br><em>Independent News. No Agenda.</em></p>
  `, unsubUrl)
}

function email3Text(unsubUrl: string, referralCode: string) {
  const refUrl = referralUrl(referralCode)
  const tweetText = encodeURIComponent(`I've been reading TopNewsClips every morning — stories the mainstream media isn't covering, global events US outlets ignore, and a 5-minute briefing that actually keeps you informed.\n\n${refUrl}`)
  return `Five days in.

By now you've probably had at least one moment this week where you read something and thought: "How did I not know about this?"

That's the gap this exists to close.

TopNewsClips is independently operated and funded by its founder. No investors. No advertisers. No institutional backing. Revenue comes from voluntary subscriptions. That's it. No one is paying us to cover — or not cover — any story.

That means growth comes from one place: people like you telling one other person.

If this week's briefings have been worth your morning five minutes, the single most valuable thing you can do is send TopNewsClips to someone who'd want the same thing. A friend. A group chat. A colleague who's tired of the algorithm.

They get it free. You help build something that doesn't exist anywhere else — a daily briefing where every source is labeled, broader blind spots are easier to see, and no one's selling you outrage.

Share on X: https://twitter.com/intent/tweet?text=${tweetText}

Send them the link: ${refUrl}

That's it. See you tomorrow morning.

— Top News Clips
Independent News. No Agenda.

---
Unsubscribe: ${unsubUrl}`
}

// ─── Trigger all three ────────────────────────────────────────────────────────

export async function sendWelcomeSequence(email: string, referralCode: string, unsubscribeToken: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const resend = new Resend(resendKey)

  const unsubUrl = unsubscribeLink(SITE_URL, unsubscribeToken)
  const unsubHeaders = {
    'List-Unsubscribe': `<${unsubUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }

  const day2  = new Date(Date.now() +  2 * 24 * 60 * 60 * 1000).toISOString()
  const day4  = new Date(Date.now() +  4 * 24 * 60 * 60 * 1000).toISOString()
  const day5  = new Date(Date.now() +  5 * 24 * 60 * 60 * 1000).toISOString()

  await Promise.allSettled([
    resend.emails.send({
      from: FROM,
      to: email,
      subject: "You're in — here's what changes tomorrow morning",
      html: email1Html(unsubUrl),
      text: email1Text(unsubUrl),
      headers: unsubHeaders,
    }),
    resend.emails.send({
      from: FROM,
      to: email,
      subject: '60 seconds: how to read your briefing',
      html: email2Html(unsubUrl),
      text: email2Text(unsubUrl),
      headers: unsubHeaders,
      scheduledAt: day2,
    }),
    resend.emails.send({
      from: FROM,
      to: email,
      subject: "Four days of briefings. Here's what that looks like.",
      html: email25Html(unsubUrl),
      text: email25Text(unsubUrl),
      headers: unsubHeaders,
      scheduledAt: day4,
    }),
    resend.emails.send({
      from: FROM,
      to: email,
      subject: 'One ask after five days',
      html: email3Html(unsubUrl, referralCode),
      text: email3Text(unsubUrl, referralCode),
      headers: unsubHeaders,
      scheduledAt: day5,
    }),
  ])
}
