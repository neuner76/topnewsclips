/**
 * SectionCard, dark encapsulated card with instant CSS globe-grid background.
 * No dynamic JS, renders immediately on server and client.
 */

interface SectionCardProps {
  accent: string
  children: React.ReactNode
  className?: string
  tint?: string // optional card background tint (default white)
}

export default function SectionCard({ accent, children, className = '', tint = '#ffffff' }: SectionCardProps) {
  return (
    <div
      className={`relative rounded-2xl overflow-hidden mb-8 ${className}`}
      style={{ background: tint, border: '1px solid #D8E0EA' }}
    >
      {/* CSS globe grid, longitude/latitude lines as instant background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 60% 50%, rgba(37,99,235,0.02) 0%, transparent 70%),
            linear-gradient(rgba(37,99,235,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,99,235,0.015) 1px, transparent 1px),
            linear-gradient(rgba(37,99,235,0.006) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,99,235,0.006) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 48px 48px, 48px 48px, 12px 12px, 12px 12px',
        }}
      />


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
