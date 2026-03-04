'use client'

import Link from 'next/link'
import type { Story } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

const platformLabel: Record<string, string> = {
  youtube: 'YT',
  x: 'X',
  tiktok: 'TT',
}

export default function AdminStoryRow({ story }: { story: Story }) {
  const [published, setPublished] = useState(story.published)
  const [saving, setSaving] = useState(false)
  const [deleted, setDeleted] = useState(false)

  async function togglePublished() {
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('stories')
      .update({ published: !published })
      .eq('id', story.id)
    setPublished(!published)
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${story.title}"? This cannot be undone.`)) return
    const supabase = createClient()
    await supabase.from('stories').delete().eq('id', story.id)
    setDeleted(true)
  }

  if (deleted) return null

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      {/* Platform */}
      <span className="text-[10px] font-bold text-muted-foreground w-6 shrink-0">
        {platformLabel[story.platform]}
      </span>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{story.title}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {(story.view_count / 1000).toFixed(0)}K views
          {story.category && (
            <span className="ml-2 font-medium capitalize">{story.category}</span>
          )}
          {story.journalist_username && (
            <span className="ml-2 font-medium">@{story.journalist_username}</span>
          )}
          {story.pinned && (
            <span className="ml-2 font-semibold text-foreground">PINNED</span>
          )}
          {story.msm_gap && (
            <span className="ml-2 text-[oklch(0.45_0.22_24)] font-medium">MSM Blackout</span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={togglePublished}
          disabled={saving}
          className={`text-xs font-semibold px-2.5 py-1 rounded border transition-colors ${
            published
              ? 'bg-foreground text-background border-foreground'
              : 'bg-white text-muted-foreground border-border hover:border-foreground'
          }`}
        >
          {saving ? '...' : published ? 'Live' : 'Draft'}
        </button>
        <a
          href={story.embed_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          View
        </a>
        <Link
          href={`/admin/stories/${story.id}`}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Edit
        </Link>
        <button
          onClick={handleDelete}
          className="text-xs font-medium text-muted-foreground hover:text-red-600 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
