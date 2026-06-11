import { createAdminClient } from '@/lib/supabase/admin'
import type { TaxonomyItem, TaxonomyKind } from '@/lib/personalization-types'

export const TAXONOMY_KINDS: TaxonomyKind[] = ['topic', 'region', 'section']

export async function getActiveTaxonomy(): Promise<TaxonomyItem[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('taxonomy')
    .select('id, kind, slug, label, active')
    .eq('active', true)
    .order('kind', { ascending: true })
    .order('label', { ascending: true })

  if (error) throw new Error(`Failed to load taxonomy: ${error.message}`)
  return (data ?? []) as TaxonomyItem[]
}

export function groupTaxonomy(items: TaxonomyItem[]) {
  return {
    topics: items.filter(i => i.kind === 'topic'),
    regions: items.filter(i => i.kind === 'region'),
    sections: items.filter(i => i.kind === 'section'),
  }
}

export async function getStoryVolumeByTaxonomy(days = 7): Promise<Record<string, number>> {
  const supabase = createAdminClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('story_tags')
    .select('taxonomy_id, stories!inner(created_at, published)')
    .gte('stories.created_at', since)
    .eq('stories.published', true)

  if (error) throw new Error(`Failed to load story volumes: ${error.message}`)
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const taxonomyId = (row as { taxonomy_id: string }).taxonomy_id
    counts[taxonomyId] = (counts[taxonomyId] ?? 0) + 1
  }
  return counts
}
