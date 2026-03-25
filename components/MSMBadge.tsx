import { AlertTriangle } from 'lucide-react'

interface MSMBadgeProps {
  notes?: string | null
  size?: 'sm' | 'md'
}

export default function MSMBadge({ notes, size = 'md' }: MSMBadgeProps) {
  return (
    <span
      title={notes || 'Fewer than 3 of the 15 major US news outlets we monitor have covered this story.'}
      className={`inline-flex items-center gap-1 font-semibold rounded
        bg-[oklch(0.96_0.03_24)] text-[oklch(0.45_0.22_24)] border border-[oklch(0.88_0.06_24)]
        ${size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'}`}
    >
      <AlertTriangle className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} strokeWidth={2.5} />
      LIMITED COVERAGE
    </span>
  )
}
