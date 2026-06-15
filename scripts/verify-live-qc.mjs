#!/usr/bin/env node

const baseUrl = (process.argv[2] || process.env.SITE_URL || 'https://www.topnewsclips.com').replace(/\/$/, '')
const paths = (process.env.LIVE_QC_PATHS || '/,/feed,/clips,/stories').split(',').map(path => path.trim()).filter(Boolean)

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
}

function htmlToText(html) {
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function snippets(text, pattern, limit = 5) {
  const matches = []
  let match
  const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
  while ((match = regex.exec(text)) && matches.length < limit) {
    const start = Math.max(0, match.index - 90)
    const end = Math.min(text.length, match.index + match[0].length + 90)
    const snippet = text.slice(start, end).trim()
    if (!matches.some(existing => existing.toLowerCase() === snippet.toLowerCase())) {
      matches.push(snippet)
    }
    if (regex.lastIndex <= match.index) regex.lastIndex = match.index + 1
  }
  return matches
}

const checks = [
  {
    id: 'C1',
    name: 'Promo or social-copy leak',
    pattern: /\b(check out|subscribe for more|follow me|hit me on|link in bio|tour tickets?|tour dates?|merch|patreon|joshjohnsoncomedy\.com)\b/i,
  },
  {
    id: 'C2',
    name: 'Named principal omitted',
    pattern: /\b(a|the)\s+former\s+(?:u\.s\.\s+)?president\b/i,
  },
  {
    id: 'C3',
    name: 'Vague filler phrase',
    pattern: /\b(under these circumstances|in this way|reportedly significant|raises questions|sparks concerns|in a notable development)\b/i,
  },
  {
    id: 'C4',
    name: 'Retrospective framed as current news',
    pattern: /\b(retrospective|from the archives?|archive documentary|looking back|history of|filmed in 20\d{2}|VICE archives?|South China Sea retrospective)\b/i,
  },
  {
    id: 'C5',
    name: 'Self-referential sourcing prose',
    pattern: /\b(this account is corroborated|this story is corroborated|this story is single-source|sole source for this report|single-source:)\b/i,
  },
  {
    id: 'C6',
    name: 'Confidence label leaked into summary',
    pattern: /\b(this account is corroborated by \d+ independent outlets|this story is corroborated by \d+ independent outlets|single-source:|sole source for this report)\b/i,
  },
  {
    id: 'C7',
    name: 'Unverified certainty language',
    pattern: /\b(proves|confirmed once and for all|definitively shows|exposes the truth about)\b/i,
  },
  {
    id: 'C8',
    name: 'Loaded outrage language',
    pattern: /\b(shocking|explosive(?!\s+media\b)|humiliating|devastating takedown)\b/i,
  },
]

const failures = []

for (const path of paths) {
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  const response = await fetch(url, { headers: { 'user-agent': 'topnewsclips-live-qc/1.0' } })
  if (!response.ok) {
    failures.push({
      path,
      id: 'HTTP',
      name: 'Page fetch failed',
      snippets: [`${response.status} ${response.statusText}`],
    })
    continue
  }

  const text = htmlToText(await response.text())
  for (const check of checks) {
    const found = snippets(text, check.pattern)
    if (found.length) {
      failures.push({ path, id: check.id, name: check.name, snippets: found })
    }
  }
}

const result = {
  ok: failures.length === 0,
  baseUrl,
  paths,
  checkedAt: new Date().toISOString(),
  failures,
}

console.log(JSON.stringify(result, null, 2))

if (failures.length) {
  process.exitCode = 1
}
