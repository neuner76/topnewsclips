/**
 * SectionCard — dark encapsulated card with instant CSS globe-grid background.
 * No dynamic JS — renders immediately on server and client.
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
      {/* CSS globe grid — longitude/latitude lines as instant background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 60% 50%, rgba(59,130,246,0.06) 0%, transparent 70%),
            linear-gradient(rgba(59,130,246,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.05) 1px, transparent 1px),
            linear-gradient(rgba(59,130,246,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 48px 48px, 48px 48px, 12px 12px, 12px 12px',
        }}
      />

      {/* Fade edges so grid doesn't fight content */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[#0d1628bb] via-transparent to-[#0d162888]" />

      {/* Colored top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[5px] rounded-t-2xl"
        style={{ background: accent }}
      />

      {/* Content */}
      <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
        {children}
      </div>
    </div>
  )
}
