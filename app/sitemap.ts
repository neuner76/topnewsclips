import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.topnewsclips.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: stories } = await supabase
    .from('stories')
    .select('slug, updated_at')
    .eq('published', true)

  const storyUrls: MetadataRoute.Sitemap = (stories ?? []).map(s => ({
    url: `${SITE_URL}/story/${s.slug}`,
    lastModified: new Date(s.updated_at),
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  return [
    { url: SITE_URL,         lastModified: new Date(), changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    ...storyUrls,
  ]
}
