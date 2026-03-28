import { ImageResponse } from 'next/og'

export const alt = 'Top News Clips'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const TEAL = '#0e9689'
const BG = '#0f0f11'

const CATEGORY_META: Record<string, { label: string; description: string; color: string }> = {
  analysis: {
    label: 'Analysis',
    description: 'Independent voices making sense of what\'s happening and why it matters',
    color: '#e05a2b',
  },
  reported: {
    label: 'Reported',
    description: 'Independent journalists investigating what institutions don\'t want you to see',
    color: '#22a05a',
  },
  raw: {
    label: 'Raw Footage',
    description: 'Bodycam, dashcam, security cam — unfiltered and unedited',
    color: '#f1f1f3',
  },
}

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const meta = CATEGORY_META[slug] ?? {
    label: slug,
    description: 'Independent news on Top News Clips',
    color: TEAL,
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: BG,
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Left accent bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '8px',
            backgroundColor: meta.color,
          }}
        />

        {/* Top label */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '48px 60px 0 52px',
          }}
        >
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: TEAL,
            }}
          />
          <span
            style={{
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '0.15em',
              color: TEAL,
              textTransform: 'uppercase',
            }}
          >
            Top News Clips
          </span>
        </div>

        {/* Category name */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 60px 0 52px',
          }}
        >
          <span
            style={{
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '0.15em',
              color: '#6b6b75',
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}
          >
            Category
          </span>
          <span
            style={{
              fontSize: '80px',
              fontWeight: 800,
              color: meta.color,
              lineHeight: 1.0,
              letterSpacing: '-0.03em',
              textTransform: 'uppercase',
            }}
          >
            {meta.label}
          </span>
          <span
            style={{
              fontSize: '24px',
              color: '#9d9da8',
              marginTop: '20px',
              lineHeight: 1.4,
              maxWidth: '800px',
            }}
          >
            {meta.description}
          </span>
        </div>

        {/* Bottom */}
        <div
          style={{
            padding: '0 60px 48px 52px',
            display: 'flex',
          }}
        >
          <span
            style={{
              fontSize: '16px',
              color: '#6b6b75',
              letterSpacing: '0.02em',
            }}
          >
            topnewsclips.com
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
