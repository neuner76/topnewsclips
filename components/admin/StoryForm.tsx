'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Story, Platform } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

function detectPlatform(url: string): Platform {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('tiktok.com')) return 'tiktok'
  return 'x'
}

interface StoryFormProps {
  story?: Story
}

export default function StoryForm({ story }: StoryFormProps) {
  const router = useRouter()
  const isEdit = !!story

  const [title, setTitle] = useState(story?.title ?? '')
  const [slug, setSlug] = useState(story?.slug ?? '')
  const [description, setDescription] = useState(story?.description ?? '')
  const [embedUrl, setEmbedUrl] = useState(story?.embed_url ?? '')
  const [platform, setPlatform] = useState<Platform>(story?.platform ?? 'youtube')
  const [viewCount, setViewCount] = useState(String(story?.view_count ?? ''))
  const [shareCount, setShareCount] = useState(String(story?.share_count ?? ''))
  const [category, setCategory] = useState<'good' | 'bad' | 'ugly' | ''>(story?.category ?? '')
  const [subcategory, setSubcategory] = useState(story?.subcategory ?? '')
  const [msmGap, setMsmGap] = useState(story?.msm_gap ?? false)
  const [msmNotes, setMsmNotes] = useState(story?.msm_notes ?? '')
  const [pinned, setPinned] = useState(story?.pinned ?? false)
  const [published, setPublished] = useState(story?.published ?? false)
  const [displayOrder, setDisplayOrder] = useState(String(story?.display_order ?? '99'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleTitleChange(val: string) {
    setTitle(val)
    if (!isEdit) setSlug(slugify(val))
  }

  function handleEmbedUrlChange(val: string) {
    setEmbedUrl(val)
    if (!isEdit) setPlatform(detectPlatform(val))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const supabase = createClient()
    const payload = {
      title,
      slug,
      description,
      embed_url: embedUrl,
      platform,
      view_count: parseInt(viewCount) || 0,
      share_count: parseInt(shareCount) || 0,
      category: category || null,
      subcategory: subcategory || null,
      msm_gap: msmGap,
      msm_notes: msmNotes || null,
      pinned,
      published,
      display_order: parseInt(displayOrder) || 99,
    }

    let err
    if (isEdit) {
      const { error: updateErr } = await supabase
        .from('stories')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', story.id)
      err = updateErr
    } else {
      const { error: insertErr } = await supabase.from('stories').insert(payload)
      err = insertErr
    }

    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    router.push('/admin')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 gap-5">

        {/* Embed URL */}
        <div className="space-y-1.5">
          <Label htmlFor="embedUrl">Clip URL *</Label>
          <Input
            id="embedUrl"
            type="url"
            placeholder="https://youtube.com/watch?v=... or TikTok / X URL"
            value={embedUrl}
            onChange={(e) => handleEmbedUrlChange(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">Paste any YouTube, TikTok, or X post URL.</p>
        </div>

        {/* Platform */}
        <div className="space-y-1.5">
          <Label htmlFor="platform">Platform *</Label>
          <select
            id="platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="youtube">YouTube</option>
            <option value="x">X / Twitter</option>
            <option value="tiktok">TikTok</option>
          </select>
        </div>

        {/* Category + Subcategory */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as 'good' | 'bad' | 'ugly' | '')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="">(none)</option>
              <option value="good">The Good</option>
              <option value="bad">The Bad</option>
              <option value="ugly">The Ugly</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subcategory">Subcategory</Label>
            <select
              id="subcategory"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="">(none)</option>
              <option value="footage">Footage</option>
              <option value="story">Story</option>
              <option value="discovery">Discovery</option>
              <option value="investigation">Investigation</option>
              <option value="testimony">Testimony</option>
              <option value="pattern">Pattern</option>
            </select>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">Headline *</Label>
          <Input
            id="title"
            placeholder="Write a punchy, factual headline..."
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
          />
        </div>

        {/* Slug */}
        <div className="space-y-1.5">
          <Label htmlFor="slug">URL Slug *</Label>
          <Input
            id="slug"
            placeholder="auto-generated-from-title"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description">Context / Description</Label>
          <Textarea
            id="description"
            rows={3}
            placeholder="Brief, neutral context about why this story matters..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Engagement */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="viewCount">View Count</Label>
            <Input
              id="viewCount"
              type="number"
              min="0"
              placeholder="e.g. 4500000"
              value={viewCount}
              onChange={(e) => setViewCount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shareCount">Share / Repost Count</Label>
            <Input
              id="shareCount"
              type="number"
              min="0"
              placeholder="e.g. 12000"
              value={shareCount}
              onChange={(e) => setShareCount(e.target.value)}
            />
          </div>
        </div>

        {/* Display order */}
        <div className="space-y-1.5">
          <Label htmlFor="displayOrder">Rank Position (1 = top)</Label>
          <Input
            id="displayOrder"
            type="number"
            min="1"
            max="999"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
          />
        </div>

        {/* MSM Gap */}
        <div className="space-y-3 p-4 bg-[oklch(0.97_0.01_24)] border border-[oklch(0.9_0.04_24)] rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="msmGap" className="text-sm font-semibold">MSM Blackout</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toggle on if no major mainstream outlet has covered this story.
              </p>
            </div>
            <Switch
              id="msmGap"
              checked={msmGap}
              onCheckedChange={setMsmGap}
            />
          </div>
          {msmGap && (
            <div className="space-y-1.5">
              <Label htmlFor="msmNotes">Why is this a blackout? (optional)</Label>
              <Textarea
                id="msmNotes"
                rows={2}
                placeholder="e.g. No coverage in NYT, CNN, Fox, or AP despite 4M+ views..."
                value={msmNotes}
                onChange={(e) => setMsmNotes(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Journalist credit (read-only) */}
        {story?.journalist_username && (
          <div className="px-4 py-3 bg-zinc-50 border border-border rounded-md">
            <p className="text-xs text-muted-foreground">Featured journalist</p>
            <p className="text-sm font-medium mt-0.5">@{story.journalist_username}</p>
          </div>
        )}

        {/* Pinned */}
        <div className="flex items-center justify-between p-4 bg-zinc-50 border border-border rounded-md">
          <div>
            <Label htmlFor="pinned" className="text-sm font-semibold">Pin to top</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Show this story first in its section.</p>
          </div>
          <Switch
            id="pinned"
            checked={pinned}
            onCheckedChange={setPinned}
          />
        </div>

        {/* Published */}
        <div className="flex items-center justify-between p-4 bg-zinc-50 border border-border rounded-md">
          <div>
            <Label htmlFor="published" className="text-sm font-semibold">Publish</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Make visible on the public site.</p>
          </div>
          <Switch
            id="published"
            checked={published}
            onCheckedChange={setPublished}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{error}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving} className="font-semibold">
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Story'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin')}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
