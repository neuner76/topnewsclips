import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GITHUB_OWNER = 'neuner76'
const GITHUB_REPO = 'topnewsclips'
const WORKFLOW_FILE = 'digest.yml'

async function dispatchDigestWorkflow(sendEmail: boolean): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.GITHUB_PAT
  if (!token) return { ok: false, error: 'GITHUB_PAT not set' }

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: { send_email: sendEmail ? 'true' : 'false' },
      }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    return { ok: false, error: `GitHub API error ${res.status}: ${body}` }
  }
  return { ok: true }
}

// Called from admin UI — authenticated via Supabase session
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const sendEmail = body.sendEmail === true

  const result = await dispatchDigestWorkflow(sendEmail)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json({ success: true, message: 'Digest workflow triggered. Check GitHub Actions for progress.' })
}
