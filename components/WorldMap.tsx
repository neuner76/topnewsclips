'use client'

import { useEffect, useRef, useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// Major city coordinates [longitude, latitude] for animated pulse dots
const CITY_DOTS = [
  { name: 'New York',    coords: [-74, 40.7]  },
  { name: 'London',      coords: [-0.1, 51.5]  },
  { name: 'Paris',       coords: [2.3, 48.9]   },
  { name: 'Berlin',      coords: [13.4, 52.5]  },
  { name: 'Moscow',      coords: [37.6, 55.8]  },
  { name: 'Beijing',     coords: [116.4, 39.9] },
  { name: 'Tokyo',       coords: [139.7, 35.7] },
  { name: 'Mumbai',      coords: [72.8, 19.1]  },
  { name: 'Nairobi',     coords: [36.8, -1.3]  },
  { name: 'São Paulo',   coords: [-46.6, -23.5]},
  { name: 'Sydney',      coords: [151.2, -33.9]},
  { name: 'Cairo',       coords: [31.2, 30.1]  },
  { name: 'Lagos',       coords: [3.4, 6.5]    },
  { name: 'Jakarta',     coords: [106.8, -6.2] },
  { name: 'Mexico City', coords: [-99.1, 19.4] },
  { name: 'Kyiv',        coords: [30.5, 50.4]  },
  { name: 'Beirut',      coords: [35.5, 33.9]  },
  { name: 'Kabul',       coords: [69.2, 34.5]  },
  { name: 'Caracas',     coords: [-66.9, 10.5] },
]

// Blindspot pins — underreported regions
export const BLINDSPOT_PINS = [
  { name: 'Sudan',         coords: [32.5, 15.6]  },
  { name: 'Myanmar',       coords: [96.1, 19.7]  },
  { name: 'DR Congo',      coords: [23.7, -2.9]  },
  { name: 'Haiti',         coords: [-72.3, 18.5] },
  { name: 'Yemen',         coords: [48.5, 15.4]  },
  { name: 'Sahel',         coords: [2.0, 14.0]   },
  { name: 'West Papua',    coords: [138.0, -4.0] },
]

type MapMode = 'hero' | 'watermark' | 'blindspot'

interface WorldMapProps {
  mode: MapMode
  className?: string
}

export default function WorldMap({ mode, className = '' }: WorldMapProps) {
  const [mounted, setMounted] = useState(false)
  const frameRef = useRef<number>(0)
  const [dotPhases, setDotPhases] = useState<number[]>(() =>
    CITY_DOTS.map((_, i) => i * (1 / CITY_DOTS.length))
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  // Animate city dots with staggered pulses
  useEffect(() => {
    if (mode === 'watermark') return
    let start: number
    const animate = (ts: number) => {
      if (!start) start = ts
      const elapsed = (ts - start) / 3000 // 3s cycle
      setDotPhases(CITY_DOTS.map((_, i) => (elapsed + i * (1 / CITY_DOTS.length)) % 1))
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [mode])

  const isHero = mode === 'hero'
  const isWatermark = mode === 'watermark'
  const isBlindspot = mode === 'blindspot'

  const mapOpacity = isHero ? 0.35 : isWatermark ? 0.07 : 0.55
  const strokeColor = isBlindspot ? 'rgba(59,130,246,0.4)' : isWatermark ? 'rgba(59,130,246,0.5)' : 'rgba(59,130,246,0.5)'
  const fillColor = isBlindspot ? 'rgba(29,78,216,0.15)' : isWatermark ? 'rgba(17,24,39,0.0)' : 'rgba(29,78,216,0.12)'

  if (!mounted) return null

  return (
    <div
      className={`pointer-events-none select-none ${className}`}
      style={{ opacity: mapOpacity }}
      aria-hidden
    >
      <ComposableMap
        projectionConfig={{ scale: 147, center: [10, 10] }}
        style={{ width: '100%', height: '100%' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={0.5}
                tabIndex={-1}
              />
            ))
          }
        </Geographies>

        {/* City pulse dots — hero and blindspot modes only */}
        {!isWatermark && CITY_DOTS.map((city, i) => {
          const phase = dotPhases[i]
          const pulse = Math.sin(phase * Math.PI * 2)
          const opacity = 0.4 + 0.6 * ((pulse + 1) / 2)
          const r = isBlindspot ? 1.5 : 2
          return (
            <circle
              key={city.name}
              cx={0} cy={0}
              r={r}
              fill={isBlindspot ? 'rgba(59,130,246,0.8)' : '#3b82f6'}
              opacity={opacity}
              transform={`translate(${toX(city.coords[0])}, ${toY(city.coords[1])})`}
            />
          )
        })}

        {/* Blindspot pins — orange, blindspot mode only */}
        {isBlindspot && BLINDSPOT_PINS.map((pin) => (
          <g key={pin.name} transform={`translate(${toX(pin.coords[0])}, ${toY(pin.coords[1])})`}>
            {/* Outer ring */}
            <circle r={6} fill="rgba(249,115,22,0.15)" />
            {/* Inner dot */}
            <circle r={3} fill="#f97316" />
          </g>
        ))}
      </ComposableMap>
    </div>
  )
}

// Project lat/lng to SVG coordinates for the default Robinson projection at scale 147
// These are approximate — react-simple-maps handles projection internally via the SVG
// We use a simple equirectangular approximation for the overlay dots
function toX(lng: number): number {
  return ((lng + 180) / 360) * 800
}

function toY(lat: number): number {
  return ((90 - lat) / 180) * 400
}
