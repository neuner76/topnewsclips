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

export default function AdminStoryRow({ story, isReview = false }: { story: Story; isReview?: boolean }) {
  const [published, setPublished] = useState(story.published)
  const [saving, setSaving] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [title, setTitle] = useState(story.title)
  const [rewriting, setRewriting] = useState(false)

  async function handleRewrite() {
    setRewriting(true)
    try {
      const res = await fetch('/api/admin/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: story.id }),
      })
      const data = await res.json()
      if (data.title) setTitle(data.title)
    } finally {
      setRewriting(false)
    }
  }

  async function togglePublished() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('stories').update({ published: !published }).eq('id', story.id)
    setPublished(!published)
    setSaving(false)
  }

  async function handlePromote() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('stories').update({ display_order: 50 }).eq('id', story.id)
    setDeleted(true) // remove from review queue section
    setSaving(false)
  }

  async function handleReject() {
    if (!confirm(`Reject "${title}"? It will be unpublished.`)) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('stories').update({ published: false }).eq('id', story.id)
    await supabase.from('rejected_slugs').upsert({ slug: story.slug, reason: 'admin_rejected' })
    setDeleted(true)
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
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
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {(story.view_count / 1000).toFixed(0)}K views
          {story.category && (
            <span className="ml-2 font-medium capitalize">{story.category}</span>
          )}
          {story.journalist_username && (
            <span className="ml-2 font-medium">@{story.journalist_username}</span>
          )}
          {story.region && (
            <span className="ml-2 font-medium text-[oklch(0.52_0.14_196)]">{story.region}</span>
          )}
          {story.pinned && (
            <span className="ml-2 font-semibold text-foreground">PINNED</span>
          )}
          {story.msm_gap && (
            <span className="ml-2 text-[oklch(0.45_0.22_24)] font-medium">Limited Coverage</span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {isReview ? (
          <>
            <button
              onClick={handlePromote}
              disabled={saving}
              className="text-xs font-semibold px-2.5 py-1 rounded border bg-foreground text-background border-foreground hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {saving ? '...' : 'Promote'}
            </button>
            <button
              onClick={handleReject}
              disabled={saving}
              className="text-xs font-semibold px-2.5 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              Reject
            </button>
            <a
              href={story.embed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              View
            </a>
          </>
        ) : (
          <>
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
              onClick={handleRewrite}
              disabled={rewriting}
              className="text-xs font-medium text-[oklch(0.52_0.14_196)] hover:underline transition-colors disabled:opacity-50"
            >
              {rewriting ? '...' : 'Rewrite'}
            </button>
            <button
              onClick={handleDelete}
              className="text-xs font-medium text-muted-foreground hover:text-red-600 transition-colors"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}
