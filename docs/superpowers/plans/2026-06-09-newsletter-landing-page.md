# Newsletter Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `/newsletter` landing page with hero copy, feature list, collapsed sample preview, and past editions archive — plus a `/digest/[date]` route for viewing specific past editions.

**Architecture:** Extract digest rendering into a shared `DigestDisplay` component used by three pages: the existing `/digest` (simplified), a new `/digest/[date]` per-edition route, and the new `/newsletter` landing page. The newsletter page shows a collapsed preview (first two NTK story titles + link to full sample) rather than the full digest inline, keeping the page conversion-first. Funnel analytics (`newsletter_page_view`, `sample_digest_click`, `past_edition_click`) are fired via a small `NewsletterAnalytics` client component. Two new data functions (`getRecentDigests`, `getDigestByDate`) are appended to `lib/digest.ts`.

**Note on already-shipped analytics:** `signup_impression`, `signup_started`, and `signup_completed` are already firing from `EmailCaptureInline`. `story_click` and `story_watched` (alias for continuity) are already firing from `StoryCard`. This plan adds the page-level and engagement signals that complete the funnel picture.

**Tech Stack:** Next.js 15 App Router (server components + small client islands), TypeScript, Tailwind CSS, Supabase (service role client)

---

## File Map

| File | Change |
|---|---|
| `lib/digest.ts` | Add `DigestSummary` type, `getRecentDigests(n)`, `getDigestByDate(date)` |
| `components/DigestDisplay.tsx` | **NEW** — shared full digest renderer; masthead copy updated to product register |
| `app/digest/page.tsx` | Simplify to ~35 lines using `DigestDisplay` |
| `app/digest/[date]/page.tsx` | **NEW** — per-edition viewer using `getDigestByDate` + `DigestDisplay` |
| `components/NewsletterAnalytics.tsx` | **NEW** — client component: fires `newsletter_page_view` on mount |
| `app/newsletter/page.tsx` | **NEW** — conversion-first landing page: hero, features, collapsed sample, past editions |
| `components/Header.tsx` | Add "Newsletter" nav link; update CTA button href to `/newsletter` |

---

## Task 1: Data functions — getRecentDigests and getDigestByDate

**Files:**
- Modify: `lib/digest.ts` (append after line 1550)

- [ ] **Step 1: Confirm the insertion point**

```bash
tail -15 /Users/ericneuner/topnewsclips/lib/digest.ts
```

Expected: the last function is `getLatestDigest()`, ending around line 1550.

- [ ] **Step 2: Append to lib/digest.ts**

Open `lib/digest.ts` and append the following after the closing `}` of `getLatestDigest`:

```typescript
export interface DigestSummary {
  id: string
  date: string
  generated_at: string
}

export async function getRecentDigests(n: number): Promise<DigestSummary[]> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('digests')
    .select('id, date, generated_at')
    .order('date', { ascending: false })
    .limit(n)
  return (data ?? []) as DigestSummary[]
}

export async function getDigestByDate(date: string): Promise<Digest | null> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('digests')
    .select('*')
    .eq('date', date)
    .single()
  return (data as Digest) ?? null
}
```

Note: `getSupabase()` is defined at line 147 — the same service role client used by `getLatestDigest`.

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/ericneuner/topnewsclips && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in `lib/digest.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/digest.ts
git commit -m "feat: add getRecentDigests and getDigestByDate to lib/digest"
```

---

## Task 2: Extract DigestDisplay shared component

**Files:**
- Create: `components/DigestDisplay.tsx`
- Modify: `app/digest/page.tsx`

- [ ] **Step 1: Create components/DigestDisplay.tsx**

This is the rendering logic from `app/digest/page.tsx` extracted into a named export. The masthead tagline is updated from "Independent journalism. Real footage. No corporate filter." to "Every source labeled. Every story in context." — the product-register copy that matches the current site voice.

Create the file with this exact content:

```tsx
import Link from 'next/link'
import type {
  NeedToKnowItem,
  InTheKnowItem,
  EtceteraItem,
  GlobalLensItem,
  MainstreamPulseItem,
  DigestContent,
} from '@/lib/digest'

const IN_THE_KNOW_CATEGORIES = [
  'Politics & World Affairs',
  'Science & Technology',
  'Business & Markets',
  'Sports, Entertainment, & Culture',
  'Comedy & Satire',
] as const

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/New_York',
  })
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-8">
      <div className="flex-1 border-t border-border" />
      <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase shrink-0">
        {label}
      </span>
      <div className="flex-1 border-t border-border" />
    </div>
  )
}

function NeedToKnowStory({ item }: { item: NeedToKnowItem }) {
  return (
    <article className="mb-10">
      <Link href={`/story/${item.slug}`} className="group block mb-3">
        <h2 className="text-xl font-black tracking-tight leading-snug group-hover:underline">
          {item.sectionTitle}
        </h2>
      </Link>
      <div className="space-y-3">
        {item.paragraphs.slice(0, 2).map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-foreground/90">
            {p}
          </p>
        ))}
      </div>
      {item.howWorldSeesIt && item.howWorldSeesIt.length > 0 && (
        <div className="mt-4 pl-3 border-l-2 border-border space-y-2">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            How the world sees it
          </p>
          {item.howWorldSeesIt.map((w, i) => (
            <div key={i} className="flex gap-2.5 items-start">
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase shrink-0 pt-0.5 w-20">
                {w.region}
              </span>
              <a
                href={`/story/${w.slug}`}
                className="text-sm text-foreground/80 hover:text-foreground transition-colors leading-snug"
              >
                {w.summary}
              </a>
            </div>
          ))}
        </div>
      )}
      <Link
        href={`/story/${item.slug}`}
        className="inline-block mt-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        Full story →
      </Link>
    </article>
  )
}

function InTheKnowBullet({ item }: { item: InTheKnowItem }) {
  const content = <span className="text-sm leading-relaxed">{item.text}</span>
  return (
    <li className="flex gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground mt-0.5 shrink-0">›</span>
      {item.slug ? (
        <Link href={`/story/${item.slug}`} className="hover:underline">{content}</Link>
      ) : content}
    </li>
  )
}

export function DigestDisplay({ content, date }: { content: DigestContent; date: string }) {
  return (
    <div>
      {/* Masthead */}
      <div className="mb-8 border-b-2 border-foreground pb-4">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
          {formatDate(date)}
        </p>
        <p className="text-3xl sm:text-4xl font-black tracking-tight">TopNewsClips Daily</p>
        <p className="text-sm text-muted-foreground mt-1">
          Every source labeled. Every story in context.
        </p>
      </div>

      {/* Need To Know */}
      <section>
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-6">
          Need To Know
        </p>
        {content.needToKnow.map((item) => (
          <NeedToKnowStory key={item.slug} item={item} />
        ))}
      </section>

      <SectionDivider label="In The Know" />

      {/* In The Know */}
      <section className="space-y-8">
        {IN_THE_KNOW_CATEGORIES.map((cat) => {
          const items = content.inTheKnow[cat]
          if (!items?.length) return null
          return (
            <div key={cat}>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-3">
                {cat}
              </p>
              <ul className="divide-y divide-border/50">
                {items.map((item, i) => (
                  <InTheKnowBullet key={i} item={item} />
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      {/* Etcetera */}
      {content.etcetera?.length > 0 && (
        <>
          <SectionDivider label="Etcetera" />
          <section>
            <ul className="space-y-2">
              {content.etcetera.map((item: EtceteraItem | string, i: number) => {
                const etc: EtceteraItem = typeof item === 'string' ? { text: item, slug: null } : item
                return (
                  <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                    {etc.slug ? (
                      <Link
                        href={`/story/${etc.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline underline-offset-2"
                      >
                        {etc.text}
                      </Link>
                    ) : etc.text}
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}

      {/* Mainstream Pulse */}
      {content.mainstreamPulse && content.mainstreamPulse.length > 0 && (
        <>
          <SectionDivider label="Mainstream Pulse" />
          <section>
            <p className="text-xs text-muted-foreground mb-4">
              What the major outlets are leading with today.
            </p>
            <ul className="space-y-2">
              {content.mainstreamPulse.map((item: MainstreamPulseItem, i: number) => (
                <li key={i} className="flex gap-3 items-baseline py-1.5 border-b border-border/50 last:border-0">
                  <div className="shrink-0 w-24">
                    <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase block">
                      {item.source}
                    </span>
                    <span className="text-[9px] text-muted-foreground/60 leading-none">{item.descriptor}</span>
                  </div>
                  <span className="text-sm leading-relaxed">{item.headline}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* Global Lens */}
      {content.globalLens && content.globalLens.length > 0 && (
        <>
          <SectionDivider label="🌍 Global Lens" />
          <section>
            <p className="text-xs text-muted-foreground mb-4">
              How international outlets are covering today&apos;s stories — perspectives US media isn&apos;t amplifying.
            </p>
            <div className="space-y-4">
              {content.globalLens.map((item: GlobalLensItem) => (
                <div key={item.slug} className="border-b border-border/50 pb-4 last:border-0 last:pb-0">
                  <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase block mb-1">
                    {item.region}
                  </span>
                  <Link
                    href={`/story/${item.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-foreground hover:underline underline-offset-2 leading-snug block mb-1"
                  >
                    {item.title}
                  </Link>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.summary}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite app/digest/page.tsx**

Replace the entire file with:

```tsx
import { getLatestDigest } from '@/lib/digest'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import Link from 'next/link'
import { DigestDisplay } from '@/components/DigestDisplay'

export const revalidate = 300

export default async function DigestPage() {
  const digest = await getLatestDigest()

  if (!digest) {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">No digest yet — check back soon.</p>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <DigestDisplay content={digest.content} date={digest.date} />
        <EmailCapture />
        <div className="mt-4 pt-6 border-t border-border text-center">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to all clips
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 3: Verify digest page**

Run `npm run dev`. Open `http://localhost:3000/digest`. Confirm:
- Masthead tagline now reads "Every source labeled. Every story in context." (not the old copy)
- All sections render: Need To Know, In The Know, Etcetera, Mainstream Pulse, Global Lens
- EmailCapture appears at the bottom

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/ericneuner/topnewsclips && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add components/DigestDisplay.tsx app/digest/page.tsx
git commit -m "refactor: extract DigestDisplay component, update masthead copy to product register"
```

---

## Task 3: Per-edition route — /digest/[date]

**Files:**
- Create: `app/digest/[date]/page.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "/Users/ericneuner/topnewsclips/app/digest/[date]"
```

- [ ] **Step 2: Create app/digest/[date]/page.tsx**

```tsx
import { getDigestByDate } from '@/lib/digest'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import Link from 'next/link'
import { DigestDisplay } from '@/components/DigestDisplay'
import { notFound } from 'next/navigation'

export const revalidate = 3600

type Props = { params: Promise<{ date: string }> }

export default async function DigestByDatePage({ params }: Props) {
  const { date } = await params
  const digest = await getDigestByDate(date)

  if (!digest) notFound()

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6">
          <Link
            href="/newsletter"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← All editions
          </Link>
        </div>
        <DigestDisplay content={digest.content} date={digest.date} />
        <EmailCapture />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 3: Verify**

Run `npm run dev`. Open `http://localhost:3000/digest/2026-06-09` (use a real date with a digest). Confirm:
- Full digest renders correctly with "← All editions" link at top
- `http://localhost:3000/digest/2020-01-01` returns a 404 page

- [ ] **Step 4: Commit**

```bash
git add "app/digest/[date]/page.tsx"
git commit -m "feat: add /digest/[date] route for viewing past editions"
```

---

## Task 4: Newsletter analytics client component

**Files:**
- Create: `components/NewsletterAnalytics.tsx`

This is a zero-render client component that fires `newsletter_page_view` when the newsletter page loads. It is rendered server-side on the newsletter page and hydrates immediately on the client.

- [ ] **Step 1: Create components/NewsletterAnalytics.tsx**

```tsx
'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

export function NewsletterAnalytics() {
  useEffect(() => {
    track('newsletter_page_view', {})
  }, [])
  return null
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/ericneuner/topnewsclips && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add components/NewsletterAnalytics.tsx
git commit -m "feat: add NewsletterAnalytics component for page-view funnel tracking"
```

---

## Task 5: Newsletter landing page — /newsletter

**Files:**
- Create: `app/newsletter/page.tsx`

**Page structure (conversion-first):**
1. Hero — headline + subhead + signup form
2. Features — "What you get every morning" (5 bullets)
3. Sample preview — first 2 NTK story titles + "Open full sample →" link (tracked)
4. Signup nudge — second form below the preview
5. Past editions — last 3 dated links (tracked)
6. EmailCapture — full dark block at bottom

The sample preview is intentionally compact: it shows enough to prove the product exists and has structure without turning the page into a content dump. Visitors who want the full edition click through to `/digest`.

- [ ] **Step 1: Create app/newsletter/page.tsx**

```tsx
import { getLatestDigest, getRecentDigests } from '@/lib/digest'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import EmailCaptureInline from '@/components/EmailCaptureInline'
import Link from 'next/link'
import { NewsletterAnalytics } from '@/components/NewsletterAnalytics'
import type { Metadata } from 'next'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Daily Briefing | TopNewsClips',
  description:
    'Get the full picture in 5 minutes. Independent news, every source labeled, international context included. Free daily briefing.',
}

function formatLongDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/New_York',
  })
}

function formatShortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: 'America/New_York',
  })
}

const FEATURES = [
  {
    label: 'Every source labeled',
    detail:
      "Journalist, public media, investigative, independent — you always know what type of source you're reading.",
  },
  {
    label: 'Confidence on every claim',
    detail:
      'Corroborated, reported, developing, or single-source — so you know how much weight to give each story.',
  },
  {
    label: 'International perspectives',
    detail:
      'How outlets in Europe, Asia, and the Middle East are covering the same events differently from U.S. media.',
  },
  {
    label: 'Global Blindspot',
    detail: 'Stories with wide international coverage that major U.S. outlets are skipping.',
  },
  {
    label: 'Reporting, analysis, and commentary — always distinguished',
    detail:
      'Clear source labels so you know what type of content you are reading, not just who wrote it.',
  },
]

export default async function NewsletterPage() {
  const [digest, recent] = await Promise.all([
    getLatestDigest(),
    getRecentDigests(5),
  ])

  const pastEditions = digest
    ? recent.filter((d) => d.date !== digest.date).slice(0, 3)
    : recent.slice(0, 3)

  return (
    <>
      <Header />
      <NewsletterAnalytics />
      <main>

        {/* Hero */}
        <section className="py-16 px-4 sm:px-6 border-b border-border">
          <div className="max-w-2xl mx-auto">
            <p className="text-[10px] font-bold tracking-widest text-[oklch(0.52_0.14_196)] uppercase mb-3">
              TopNewsClips Daily Briefing
            </p>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-4">
              Get the full picture<br className="hidden sm:block" /> in 5 minutes.
            </h1>
            <p className="text-base text-muted-foreground mb-8 max-w-lg">
              Independent daily briefing. Every source labeled. International context every morning.
            </p>
            <div className="max-w-sm">
              <EmailCaptureInline placement="newsletter-hero" />
            </div>
          </div>
        </section>

        {/* What you get */}
        <section className="py-16 px-4 sm:px-6 border-b border-border">
          <div className="max-w-2xl mx-auto">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-8">
              What you get every morning
            </p>
            <ul className="space-y-6">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex gap-4">
                  <span className="text-[oklch(0.52_0.14_196)] font-bold mt-0.5 shrink-0">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.label}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{f.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Sample preview */}
        {digest && (
          <section className="py-10 px-4 sm:px-6 border-b border-border">
            <div className="max-w-2xl mx-auto">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
                Sample edition
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                {formatLongDate(digest.date)}
              </p>

              {/* Collapsed preview: first 2 NTK story titles only */}
              <div className="space-y-4 mb-6">
                {digest.content.needToKnow.slice(0, 2).map((item) => (
                  <div key={item.slug} className="border-l-2 border-[oklch(0.52_0.14_196)] pl-3">
                    <p className="text-sm font-bold tracking-tight">{item.sectionTitle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {item.paragraphs[0]}
                    </p>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pl-0">
                  Plus In The Know, Global Lens
                  {digest.content.globalBlindspots?.length ? ', Global Blindspot' : ''}
                  , and more.
                </p>
              </div>

              <Link
                href={`/digest/${digest.date}`}
                className="inline-block text-xs font-semibold text-[oklch(0.52_0.14_196)] hover:underline underline-offset-2"
              >
                Open full sample →
              </Link>

              <div className="mt-10 pt-8 border-t border-border">
                <p className="text-sm font-semibold text-foreground mb-1">
                  Get the full picture in 5 minutes.
                </p>
                <p className="text-xs text-muted-foreground mb-3">Delivered every morning. Free.</p>
                <div className="max-w-sm">
                  <EmailCaptureInline placement="newsletter-after-sample" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Past editions */}
        {pastEditions.length > 0 && (
          <section className="py-10 px-4 sm:px-6 border-b border-border">
            <div className="max-w-2xl mx-auto">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-6">
                Past editions
              </p>
              <ul>
                {pastEditions.map((d) => (
                  <li key={d.date}>
                    <Link
                      href={`/digest/${d.date}`}
                      className="flex items-center justify-between py-3 border-b border-border/50 group"
                    >
                      <span className="text-sm font-medium group-hover:underline">
                        {formatShortDate(d.date)}
                      </span>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                        Read →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <EmailCapture />
      </main>
      <Footer />
    </>
  )
}
```

**Note on `sample_digest_click` and `past_edition_click`:** These are tracked via PostHog's automatic page-view capture when the user navigates to `/digest/[date]`. The `newsletter_page_view` event (from `NewsletterAnalytics`) + PostHog's automatic `/digest/[date]` page view give you the conversion funnel: newsletter page → clicked into sample or past edition. If you want explicit click events (before navigation), you can wrap those `<Link>` components in `'use client'` components with `onClick={() => track('sample_digest_click', {})}` — but the automatic page-view capture is sufficient for the initial measurement.

- [ ] **Step 2: Verify the page**

Run `npm run dev`. Open `http://localhost:3000/newsletter`. Confirm:
- Hero section: headline, subhead, email form visible above the fold
- Features section: 5 bullets with ✓ markers; last bullet reads "Reporting, analysis, and commentary — always distinguished"
- Sample preview: shows 2 NTK story titles with first-paragraph preview and "Plus In The Know…" line
- "Open full sample →" link navigates to `/digest/YYYY-MM-DD`
- Second email form appears below the sample preview
- Past editions list shows 1–3 dated links (if more than one digest exists)
- EmailCapture dark block at the bottom

Open PostHog. Navigate to `/newsletter` in the browser. Confirm `newsletter_page_view` event appears in Live Events within a few seconds.

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/ericneuner/topnewsclips && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/newsletter/page.tsx
git commit -m "feat: add /newsletter landing page with funnel analytics, collapsed sample, past editions"
```

---

## Task 6: Add Newsletter to header nav

**Files:**
- Modify: `components/Header.tsx`

- [ ] **Step 1: Add Newsletter nav link and update CTA button href**

Read `components/Header.tsx` first. Make two edits:

**Change 1** — add "Newsletter" link after "Digest" (~line 15):

```tsx
// Before:
<Link href="/" className="hover:text-foreground transition-colors">
  Digest
</Link>
<Link href="/?view=clips" className="hover:text-foreground transition-colors">
  Clips
</Link>

// After:
<Link href="/" className="hover:text-foreground transition-colors">
  Digest
</Link>
<Link href="/newsletter" className="hover:text-foreground transition-colors hidden sm:block">
  Newsletter
</Link>
<Link href="/?view=clips" className="hover:text-foreground transition-colors">
  Clips
</Link>
```

**Change 2** — update the teal CTA button href from `/#subscribe` to `/newsletter` (~line 39):

```tsx
// Before:
<Link
  href="/#subscribe"
  className="bg-[oklch(0.52_0.14_196)] text-white px-3 py-1.5 rounded text-xs font-semibold hover:opacity-80 transition-opacity"
>
  Get the digest
</Link>

// After:
<Link
  href="/newsletter"
  className="bg-[oklch(0.52_0.14_196)] text-white px-3 py-1.5 rounded text-xs font-semibold hover:opacity-80 transition-opacity"
>
  Get the digest
</Link>
```

- [ ] **Step 2: Verify**

Run `npm run dev`. On any page:
- Desktop: "Newsletter" appears in nav between "Digest" and "Clips"
- Mobile (narrow browser): "Newsletter" is hidden, nav remains clean
- Clicking "Newsletter" or the teal "Get the digest" button navigates to `/newsletter`

- [ ] **Step 3: Commit**

```bash
git add components/Header.tsx
git commit -m "feat: add Newsletter nav link, point Get the digest CTA to /newsletter"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Dedicated newsletter landing page | Task 5 ✓ |
| Headline promise | Task 5 — "Get the full picture in 5 minutes." ✓ |
| "What you get each morning" section | Task 5 — 5-item FEATURES list ✓ |
| Collapsed sample preview with link to full | Task 5 — 2 NTK titles + "Open full sample →" ✓ |
| Previous 3 editions | Task 5 — pastEditions list ✓ |
| Signup forms (hero + after sample) | Task 5 — 2× EmailCaptureInline ✓ |
| Trust reducer | Task 5 — inside EmailCaptureInline ✓ |
| Per-edition archive URL | Task 3 — `/digest/[date]` ✓ |
| Funnel event: newsletter_page_view | Task 4 — NewsletterAnalytics ✓ |
| Funnel events: signup_impression, signup_started | Already shipped in EmailCaptureInline ✓ |
| Funnel events: story_click + story_watched alias | Already shipped in StoryCard ✓ |
| DRY digest rendering | Task 2 — DigestDisplay shared component ✓ |
| Masthead copy in product register | Task 2 — "Every source labeled. Every story in context." ✓ |
| Feature list avoids overclaiming | Task 5 — "Reporting, analysis, and commentary — always distinguished" ✓ |
| Header discoverability | Task 6 ✓ |

**Placeholder scan:** No TBDs. All steps contain complete code.

**Type consistency:**
- `DigestSummary` defined in Task 1, returned by `getRecentDigests`, used in Task 5 as `d.date` ✓
- `DigestDisplay` props `{ content: DigestContent; date: string }` used in Tasks 2, 3, 5 ✓
- `params: Promise<{ date: string }>` matches pattern in `app/story/[slug]/page.tsx` ✓
- `NewsletterAnalytics` takes no props, renders null — consistent with server import ✓
