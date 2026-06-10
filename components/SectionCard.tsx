'use client'

import dynamic from 'next/dynamic'

const WorldMap = dynamic(() => import('./WorldMap'), { ssr: false })

/**
 * SectionCard — dark encapsulated card with world map watermark.
 * Used for every major section, mirroring GlobalBlindspotSection's visual language.
 *
 * accent:    left border + header color (hex or oklch)
 * mapMode:   which world map overlay to use
 */

interface SectionCardProps {
  accent: string
  children: React.ReactNode
  className?: string
}

export default function SectionCard({ accent, children, className = '' }: SectionCardProps) {
  return (
    <div
      className={`relative rounded-2xl overflow-hidden mb-8 dark ${className}`}
      style={{ background: '#0d1628' }}
    >
      {/* World map watermark */}
      <div className="absolute inset-0 pointer-events-none">
        <WorldMap mode="watermark" className="w-full h-full" />
        {/* Subtle gradient so content always reads */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1628cc] via-transparent to-[#0d162899]" />
      </div>

      {/* Colored top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
        style={{ background: accent }}
      />

      {/* Content */}
      <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
        {children}
      </div>
    </div>
  )
}
