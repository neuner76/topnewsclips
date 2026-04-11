import Link from 'next/link'
import { CONFIDENCE_META, type ConfidenceLabel } from '@/lib/confidence'

export default function ConfidenceBadge({ label }: { label: ConfidenceLabel }) {
  const meta = CONFIDENCE_META[label]
  return (
    <Link
      href="/taxonomy#confidence"
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide border transition-opacity hover:opacity-80 ${meta.className} ${meta.italic ? 'italic' : ''}`}
      title={meta.description}
    >
      {meta.label}
    </Link>
  )
}
