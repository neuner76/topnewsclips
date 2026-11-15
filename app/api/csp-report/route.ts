import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Collector for Content-Security-Policy-Report-Only violations. The policy in
// next.config is report-only (it blocks nothing), so this endpoint just records
// what an ENFORCED policy WOULD block — surfacing any external origin the
// allowlist missed before we switch the policy to enforcing. Logs a bounded
// summary to the server logs (visible in Vercel); it never writes to the DB and
// never echoes the full report back, so it can't be used to amplify spam.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    // report-uri sends { "csp-report": {...} }; the newer Reporting API sends a flat body.
    const r = (body?.['csp-report'] ?? body) as Record<string, unknown> | null
    if (r) {
      console.warn('[csp-report]', JSON.stringify({
        blockedURI: r['blocked-uri'] ?? r['blockedURL'],
        directive: r['violated-directive'] ?? r['effectiveDirective'],
        documentURI: r['document-uri'] ?? r['documentURL'],
      }))
    }
  } catch {
    /* malformed report — ignore */
  }
  return new NextResponse(null, { status: 204 })
}
