import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 300

const SITE_URL = 'https://www.topnewsclips.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // display_order < 99 = ever-published stories (live + archived); 99 = draft/rejected
  const { data: stories } = await supabase
    .from('stories')
    .select('slug, updated_at, published')
    .lt('display_order', 99)
    .not('slug', 'is', null)

  const storyUrls: MetadataRoute.Sitemap = (stories ?? []).map(s => ({
    url: `${SITE_URL}/story/${s.slug}`,
    lastModified: new Date(s.updated_at),
    changeFrequency: s.published ? 'daily' : 'never',
    priority: s.published ? 0.8 : 0.3,
  }))

  return [
    { url: SITE_URL,                           lastModified: new Date(), changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${SITE_URL}/stories`,              lastModified: new Date(), changeFrequency: 'daily',   priority: 0.7 },
    { url: `${SITE_URL}/search`,               lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/category/analysis`,    lastModified: new Date(), changeFrequency: 'daily',   priority: 0.7 },
    { url: `${SITE_URL}/category/reported`,    lastModified: new Date(), changeFrequency: 'daily',   priority: 0.7 },
    { url: `${SITE_URL}/category/raw`,         lastModified: new Date(), changeFrequency: 'daily',   priority: 0.6 },
    { url: `${SITE_URL}/about`,                lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/contact`,              lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/privacy`,              lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/taxonomy`,             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    ...storyUrls,
  ]
}
