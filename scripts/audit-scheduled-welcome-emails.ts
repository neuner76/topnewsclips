import { Resend } from 'resend'

const WELCOME_SUBJECTS = [
  '60 seconds: how to read your briefing',
  "Four days of briefings. Here's what that looks like.",
  'One ask after five days',
]

interface ResendEmailListItem {
  id: string
  to: string[]
  subject: string
  last_event: string
  scheduled_at: string | null
  created_at: string
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function argValue(name: string): string | null {
  const prefix = `${name}=`
  const match = process.argv.find(arg => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : null
}

async function main() {
  const resend = new Resend(requiredEnv('RESEND_API_KEY'))
  const cancel = process.argv.includes('--cancel')
  const emailFilter = argValue('--email')?.toLowerCase() ?? null

  const scheduled: ResendEmailListItem[] = []
  let after: string | undefined

  do {
    const response = await resend.emails.list({ limit: 100, after })
    if (response.error) throw response.error
    const data = (response.data?.data ?? []) as ResendEmailListItem[]
    for (const email of data) {
      const isWelcome = WELCOME_SUBJECTS.includes(email.subject)
      const isScheduled = email.last_event === 'scheduled' || !!email.scheduled_at
      const matchesRecipient = !emailFilter || email.to.some(to => to.toLowerCase() === emailFilter)
      if (isWelcome && isScheduled && matchesRecipient) scheduled.push(email)
    }
    after = response.data?.has_more ? data.at(-1)?.id : undefined
  } while (after)

  if (scheduled.length === 0) {
    console.log('No scheduled welcome-sequence emails found.')
    return
  }

  console.log(`Found ${scheduled.length} scheduled welcome-sequence email(s):`)
  for (const email of scheduled) {
    console.log(`- ${email.id} | ${email.scheduled_at ?? 'scheduled'} | ${email.to.join(', ')} | ${email.subject}`)
  }

  if (!cancel) {
    console.log('\nRead-only mode. Re-run with --cancel to cancel these scheduled emails.')
    console.log('Optional: add --email=person@example.com to narrow the audit/cancel target.')
    return
  }

  for (const email of scheduled) {
    const result = await resend.emails.cancel(email.id)
    if (result.error) {
      console.error(`Failed to cancel ${email.id}: ${result.error.message}`)
    } else {
      console.log(`Canceled ${email.id}`)
    }
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : JSON.stringify(error)
  console.error(`Scheduled welcome audit failed: ${message}`)
  process.exit(1)
})
