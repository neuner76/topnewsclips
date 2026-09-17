'use client'

import { useEffect, useMemo, useState } from 'react'
import { track } from '@/lib/analytics'
import { normalizeKeywordPhrase } from '@/lib/keyword-preferences'
import type {
  FormatPreference,
  SubscriberPreferences,
  TaxonomyItem,
} from '@/lib/personalization-types'

interface PreferencesResponse {
  taxonomy: TaxonomyItem[]
  preferences: SubscriberPreferences
  volumes: Record<string, number>
}

interface PreferenceOnboardingProps {
  token: string
}

type SaveState = 'idle' | 'loading' | 'saved' | 'error'

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
}

function Pill({
  item,
  selected,
  count,
  onClick,
}: {
  item: TaxonomyItem
  selected: boolean
  count: number
  onClick: () => void
}) {
  const countLabel = count === 0 ? 'No recent stories' : `${count} recent ${count === 1 ? 'story' : 'stories'}`

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
        selected
          ? 'border-[#2563EB] bg-[#2563EB]/15 text-foreground'
          : 'border-border bg-muted text-muted-foreground hover:border-foreground/30 hover:text-foreground'
      }`}
    >
      <span className="block font-semibold">{item.label}</span>
      <span className="text-xs text-muted-foreground">{countLabel}</span>
    </button>
  )
}

function SectionHeader({
  title,
  items,
  selectedIds,
  onChange,
}: {
  title: string
  items: TaxonomyItem[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const itemIds = items.map(item => item.id)
  const allSelected = itemIds.length > 0 && itemIds.every(id => selectedIds.includes(id))

  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-black uppercase tracking-widest text-foreground">{title}</h2>
      {itemIds.length > 0 && (
        <button
          type="button"
          onClick={() => onChange(allSelected ? [] : itemIds)}
          className="rounded-md border border-border px-2.5 py-1 text-xs font-bold text-muted-foreground hover:border-foreground/30 hover:text-foreground"
        >
          {allSelected ? 'Clear' : 'Select all'}
        </button>
      )}
    </div>
  )
}

export default function PreferenceOnboarding({ token }: PreferenceOnboardingProps) {
  const [data, setData] = useState<PreferencesResponse | null>(null)
  const [topicIds, setTopicIds] = useState<string[]>([])
  const [regionIds, setRegionIds] = useState<string[]>([])
  const [sectionIds, setSectionIds] = useState<string[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordDraft, setKeywordDraft] = useState('')
  const [formatPreference, setFormatPreference] = useState<FormatPreference>('both')
  const [status, setStatus] = useState<SaveState>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    track('personalization_onboarding_started')
    fetch(`/api/preferences?token=${encodeURIComponent(token)}`)
      .then(async res => {
        if (!res.ok) throw new Error(await res.text())
        return res.json() as Promise<PreferencesResponse>
      })
      .then(payload => {
        setData(payload)
        setTopicIds(payload.preferences.topicIds)
        setRegionIds(payload.preferences.regionIds)
        setSectionIds(payload.preferences.sectionIds)
        setKeywords(payload.preferences.keywords)
        setFormatPreference(payload.preferences.formatPreference)
        setStatus('idle')
      })
      .catch(() => {
        setStatus('error')
        setMessage('This preference link is invalid or expired.')
      })
  }, [token])

  const grouped = useMemo(() => {
    const taxonomy = data?.taxonomy ?? []
    const sortByVolume = (items: TaxonomyItem[]) => [...items].sort((a, b) => {
      const countA = data?.volumes[a.id] ?? 0
      const countB = data?.volumes[b.id] ?? 0
      if (countA === 0 && countB > 0) return 1
      if (countB === 0 && countA > 0) return -1
      return countB - countA || a.label.localeCompare(b.label)
    })
    return {
      topics: sortByVolume(taxonomy.filter(i => i.kind === 'topic')),
      regions: sortByVolume(taxonomy.filter(i => i.kind === 'region')),
      sections: sortByVolume(taxonomy.filter(i => i.kind === 'section')),
    }
  }, [data])

  async function save(skipped = false) {
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch(`/api/preferences?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicIds, regionIds, sectionIds, keywords, formatPreference }),
      })
      if (!res.ok) throw new Error(await res.text())
      track(skipped ? 'personalization_onboarding_skipped' : 'personalization_onboarding_completed')
      setStatus('saved')
      setMessage(skipped ? 'No problem. Your editorial default is unchanged.' : 'Saved. Your briefing is tuned.')
    } catch {
      setStatus('error')
      setMessage('Could not save your preferences. Please try again.')
    }
  }

  async function reset() {
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch(`/api/preferences?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      })
      if (!res.ok) throw new Error(await res.text())
      setTopicIds([])
      setRegionIds([])
      setSectionIds([])
      setKeywords([])
      setKeywordDraft('')
      setFormatPreference('both')
      track('personalization_reset')
      setStatus('saved')
      setMessage('Reset. You are back to the editorial default.')
    } catch {
      setStatus('error')
      setMessage('Could not reset your preferences. Please try again.')
    }
  }

  if (status === 'loading' && !data) {
    return <p className="text-sm text-muted-foreground">Loading your preference page...</p>
  }

  if (status === 'error' && !data) {
    return <p className="text-sm text-red-300">{message}</p>
  }

  function addKeyword() {
    const keyword = normalizeKeywordPhrase(keywordDraft)
    if (!keyword || keyword.length < 3 || keyword.length > 80 || keywords.includes(keyword) || keywords.length >= 12) return
    setKeywords(items => [...items, keyword])
    setKeywordDraft('')
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader
          title="Topics"
          items={grouped.topics}
          selectedIds={topicIds}
          onChange={setTopicIds}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {grouped.topics.map(item => (
            <Pill
              key={item.id}
              item={item}
              selected={topicIds.includes(item.id)}
              count={data?.volumes[item.id] ?? 0}
              onClick={() => setTopicIds(ids => toggleId(ids, item.id))}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Regions"
          items={grouped.regions}
          selectedIds={regionIds}
          onChange={setRegionIds}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {grouped.regions.map(item => (
            <Pill
              key={item.id}
              item={item}
              selected={regionIds.includes(item.id)}
              count={data?.volumes[item.id] ?? 0}
              onClick={() => setRegionIds(ids => toggleId(ids, item.id))}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Sections"
          items={grouped.sections}
          selectedIds={sectionIds}
          onChange={setSectionIds}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {grouped.sections.map(item => (
            <Pill
              key={item.id}
              item={item}
              selected={sectionIds.includes(item.id)}
              count={data?.volumes[item.id] ?? 0}
              onClick={() => setSectionIds(ids => toggleId(ids, item.id))}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-black uppercase tracking-widest text-foreground mb-3">Custom Interests</h2>
        <div className="max-w-2xl">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={keywordDraft}
              onChange={event => setKeywordDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addKeyword()
                }
              }}
              placeholder="AI chips, private equity, local policing..."
              className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-[#111827] placeholder:text-[#6b7280] outline-none focus:border-[#2563EB]"
              maxLength={80}
            />
            <button
              type="button"
              onClick={addKeyword}
              disabled={keywords.length >= 12}
              className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            These move matching vetted stories higher when they appear in the briefing.
          </p>
          {keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {keywords.map(keyword => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => setKeywords(items => items.filter(item => item !== keyword))}
                  className="rounded-full border border-[#2563EB]/40 bg-[#2563EB]/15 px-3 py-1 text-xs font-semibold text-foreground hover:border-[#2563EB]"
                  title="Remove interest"
                >
                  {keyword} x
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-foreground mb-3">Format</h2>
          <div className="flex max-w-md rounded-lg border border-border bg-muted p-1">
            {(['digest', 'clips', 'both'] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setFormatPreference(value)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold capitalize ${
                  formatPreference === value ? 'bg-[#2563EB] text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </section>

      {message && (
        <p className={`text-sm ${status === 'error' ? 'text-red-300' : 'text-muted-foreground'}`}>{message}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 border-t border-border pt-6">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={status === 'loading'}
          className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {status === 'loading' ? 'Saving...' : 'Save preferences'}
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={status === 'loading'}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={status === 'loading'}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50 sm:ml-auto"
        >
          Reset to editorial default
        </button>
      </div>
    </div>
  )
}
