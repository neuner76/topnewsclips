import { NextResponse } from 'next/server'
import { requireCronSecretOrAdminSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Punctual external trigger for the Daily Ingest.
//
// GitHub delays scheduled-event crons by ~4-5h (the 10:40 UTC ingest has been
// firing ~15:xx), so the morning edition + email land mid-afternoon. Vercel Cron
// (Pro, on-time within a minute) hits this route on schedule, and we dispatch the
// GitHub "Daily Ingest" workflow via the REST API. The digest still chains off the
// ingest as usual; the GitHub cron + watchdog remain as fallbacks.
//
// Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
// (CRON_SECRET is already configured for the /api/ingest/* routes).
// Requires: GITHUB_DISPATCH_TOKEN (fine-grained PAT with Actions: read/write on
// this repo) and GITHUB_REPO ("owner/name").
export async function GET(request: Request) {
  const unauthorized = await requireCronSecretOrAdminSession(request)
  if (unauthorized) return unauthorized

  const token = process.env.GITHUB_DISPATCH_TOKEN
  const repo = process.env.GITHUB_REPO // e.g. "neuner76/topnewsclips"
  if (!token || !repo) {
    return NextResponse.json(
      { error: 'GITHUB_DISPATCH_TOKEN and GITHUB_REPO must be set in the environment.' },
      { status: 500 },
    )
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/ingest.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    },
  )

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300)
    return NextResponse.json(
      { error: `GitHub workflow dispatch failed (HTTP ${res.status})`, detail },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, dispatched: 'Daily Ingest', at: new Date().toISOString() })
}
