import { createClient } from '@supabase/supabase-js'
import { buildDigestEdition, canonicalItemIds, validateDigestEdition } from '../lib/digest-canonical'
import { normalizeDigestContent, type DigestContent, type Digest } from '../lib/digest'
import type { Story } from '../lib/types'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function digestSlugs(content: DigestContent): string[] {
  return [
    ...content.needToKnow.map(item => item.slug),
    ...Object.values(content.inTheKnow).flatMap(items => items.map(item => item.slug).filter(Boolean) as string[]),
    ...(content.etcetera ?? []).map(item => typeof item === 'string' ? null : item.slug).filter(Boolean) as string[],
    ...(content.globalBlindspots ?? []).map(item => item.slug),
    ...(content.globalLens ?? []).map(item => item.slug),
  ]
}

async function main() {
  const supabase = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  )
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.topnewsclips.com'

  const { data: digestRow, error: digestError } = await supabase
    .from('digests')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  if (digestError) throw digestError
  if (!digestRow) throw new Error('No digest found')

  const content = normalizeDigestContent(digestRow.content as Partial<DigestContent>)
  const slugs = [...new Set(digestSlugs(content))]
  const storyMap = new Map<string, Story>()

  if (slugs.length > 0) {
    const { data: stories, error: storiesError } = await supabase
      .from('stories')
      .select('*')
      .in('slug', slugs)
    if (storiesError) throw storiesError
    for (const story of (stories ?? []) as Story[]) storyMap.set(story.slug, story)
  }

  const digest: Digest = {
    id: digestRow.id,
    date: digestRow.date,
    content,
    generated_at: digestRow.generated_at,
  }
  const edition = buildDigestEdition(digest, storyMap, siteUrl)
  const result = validateDigestEdition(edition)

  console.log(`Digest ${edition.date}`)
  console.log(`Canonical items: ${canonicalItemIds(edition).length}`)

  if (result.warnings.length > 0) {
    console.log('\nWarnings:')
    for (const warning of result.warnings) console.log(`- ${warning}`)
  }

  if (result.errors.length > 0) {
    console.error('\nErrors:')
    for (const error of result.errors) console.error(`- ${error}`)
    process.exit(1)
  }

  console.log('\nDigest validation passed.')
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') return JSON.stringify(error)
  return String(error)
}

main().catch(error => {
  console.error(`Digest validation failed: ${errorMessage(error)}`)
  process.exit(1)
})
