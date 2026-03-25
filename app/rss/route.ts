import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 300

const SITE_URL = 'https://www.topnewsclips.com'
const SITE_NAME = 'Top News Clips'
const SITE_DESC = 'Independent news clips and journalism mainstream media undercovers. Bodycam footage, investigative reporting, and global stories — unfiltered.'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function getYouTubeThumbnail(embedUrl: string): string | null {
  const m = embedUrl?.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: stories } = await supabase
    .from('stories')
    .select('slug, title, description, embed_url, platform, thumbnail_url, category, region, msm_gap, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(50)

  const items = (stories ?? []).map(s => {
    const url = `${SITE_URL}/story/${s.slug}`
    const thumbnail = s.platform === 'youtube'
      ? getYouTubeThumbnail(s.embed_url)
      : (s.thumbnail_url ?? null)
    const description = (s.description ?? '').trim()
    const pubDate = new Date(s.created_at).toUTCString()

    const categoryTags = [
      s.category ? `<category>${escapeXml(s.category)}</category>` : '',
      s.region ? `<category>${escapeXml(s.region)}</category>` : '',
      s.msm_gap ? '<category>MSM Blackout</category>' : '',
    ].filter(Boolean).join('\n      ')

    const mediaTag = thumbnail
      ? `<media:content url="${escapeXml(thumbnail)}" medium="image" />`
      : ''

    return `
    <item>
      <title>${escapeXml(s.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description || s.title)}</description>
      ${categoryTags}
      ${mediaTag}
    </item>`
  }).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${SITE_URL}</link>
    <description>${SITE_DESC}</description>
    <language>en-us</language>
    <ttl>300</ttl>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  })
}
