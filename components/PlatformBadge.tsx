import type { Platform } from '@/lib/types'

const config: Record<Platform, { label: string; className: string }> = {
  youtube: {
    label: 'YouTube',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  x: {
    label: 'X / Twitter',
    className: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  },
  tiktok: {
    label: 'TikTok',
    className: 'bg-pink-50 text-pink-700 border-pink-200',
  },
}

export default function PlatformBadge({ platform }: { platform: Platform }) {
  const { label, className } = config[platform]
  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${className}`}
    >
      {label}
    </span>
  )
}
