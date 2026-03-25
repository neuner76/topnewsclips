import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const alt = 'Top News Clips'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const TEAL = '#0e9689'
const TEAL_DARK = '#0a6b61'
const BG = '#0f0f11'
const SURFACE = '#18181c'

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  x: 'X / Twitter',
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '…'
}

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase
    .from('stories')
    .select('title, platform, category, msm_gap, region')
    .eq('slug', slug)
    .single()

  const title = data?.title ? truncate(data.title, 120) : 'Top News Clips'
  const platform = PLATFORM_LABELS[data?.platform ?? ''] ?? ''
  const isGlobal = !!data?.region
  const isMsm = !!data?.msm_gap

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
        {/* Left teal accent bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '8px',
            backgroundColor: TEAL,
          }}
        />

        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '36px 60px 0 52px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
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

          {/* Badges */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {isMsm && (
              <div
                style={{
                  backgroundColor: '#3d0f0f',
                  border: '1px solid #7a2020',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#f87171',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                MSM Blackout
              </div>
            )}
            {isGlobal && (
              <div
                style={{
                  backgroundColor: '#0d2f2c',
                  border: `1px solid ${TEAL_DARK}`,
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: TEAL,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Global Blindspot
              </div>
            )}
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            padding: '40px 60px 40px 52px',
          }}
        >
          <span
            style={{
              fontSize: title.length > 80 ? '38px' : '48px',
              fontWeight: 800,
              color: '#f1f1f3',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </span>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 60px 36px 52px',
          }}
        >
          <span
            style={{
              fontSize: '16px',
              color: '#6b6b75',
              letterSpacing: '0.02em',
            }}
          >
            Independent news. No agenda.
          </span>
          {platform && (
            <div
              style={{
                backgroundColor: SURFACE,
                border: '1px solid #2a2a32',
                borderRadius: '4px',
                padding: '6px 14px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#9d9da8',
                letterSpacing: '0.05em',
              }}
            >
              {platform}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  )
}
