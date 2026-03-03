'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Journalist {
  id: string
  platform: string
  username: string
  display_name: string | null
  bio: string | null
  active: boolean
  created_at: string
}

export default function JournalistsPage() {
  const [journalists, setJournalists] = useState<Journalist[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')

  const supabase = createClient()

  async function load() {
    const { data } = await supabase
      .from('featured_journalists')
      .select('*')
      .order('created_at', { ascending: false })
    setJournalists(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const clean = username.replace(/^@/, '').trim().toLowerCase()
    const { error: err } = await supabase.from('featured_journalists').insert({
      platform: 'tiktok',
      username: clean,
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setUsername('')
    setDisplayName('')
    setBio('')
    load()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('featured_journalists').update({ active: !current }).eq('id', id)
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove @${name} from featured journalists?`)) return
    await supabase.from('featured_journalists').delete().eq('id', id)
    load()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-black tracking-tight mb-1">Featured Journalists</h1>
      <p className="text-sm text-muted-foreground mb-8">
        TikTok accounts to track. Their clips are prioritized in the pipeline and auto-pinned per category.
      </p>

      {/* Add form */}
      <form onSubmit={handleAdd} className="space-y-4 p-5 border border-border rounded-md bg-white mb-8">
        <h2 className="text-sm font-semibold">Add Journalist</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">TikTok @username *</Label>
            <Input
              id="username"
              placeholder="e.g. johndoe or @johndoe"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="John Doe"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">Bio / Notes</Label>
          <Input
            id="bio"
            placeholder="e.g. Independent bodycam journalist covering TX/FL incidents"
            value={bio}
            onChange={e => setBio(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving} className="font-semibold">
          {saving ? 'Adding...' : 'Add Journalist'}
        </Button>
      </form>

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : journalists.length === 0 ? (
        <p className="text-sm text-muted-foreground">No featured journalists yet.</p>
      ) : (
        <div className="divide-y divide-border border border-border rounded-md bg-white">
          {journalists.map(j => (
            <div key={j.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">@{j.username}</p>
                {j.display_name && (
                  <p className="text-xs text-muted-foreground">{j.display_name}</p>
                )}
                {j.bio && (
                  <p className="text-xs text-muted-foreground truncate">{j.bio}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => toggleActive(j.id, j.active)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded border transition-colors ${
                    j.active
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-white text-muted-foreground border-border hover:border-foreground'
                  }`}
                >
                  {j.active ? 'Active' : 'Paused'}
                </button>
                <button
                  onClick={() => handleDelete(j.id, j.username)}
                  className="text-xs font-medium text-muted-foreground hover:text-red-600 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
