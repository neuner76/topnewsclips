import { ImageResponse } from 'next/og'

export const alt = 'Top News Clips — Independent news. No agenda.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const TEAL = '#0e9689'
const BG = '#0f0f11'

export default function OGImage() {
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

        {/* Main headline */}
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
              fontSize: '64px',
              fontWeight: 800,
              color: '#f1f1f3',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
            }}
          >
            What mainstream media misses.
          </span>
          <span
            style={{
              fontSize: '64px',
              fontWeight: 800,
              color: TEAL,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              marginTop: '8px',
            }}
          >
            In 5 minutes.
          </span>
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            padding: '0 60px 48px 52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: '20px',
              color: '#6b6b75',
              letterSpacing: '0.02em',
            }}
          >
            Independent journalism · No agenda · Free daily briefing
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
