# Conversion Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe TopNewsClips from a video aggregator into a trust-first news analysis product, fix zero-conversion email capture, and eliminate copy inconsistencies — driving the first meaningful signup conversion data.

**Architecture:** Six sequential, independently-deployable changes touching the homepage (`app/page.tsx`), story page (`app/story/[slug]/page.tsx`), two email capture components, and four copy-bearing files. No new routes or data models required. Each task produces a working, visually verifiable result.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Resend (email), PostHog (analytics), Supabase

---

## File Map

| File | Changes |
|---|---|
| `components/StoryCard.tsx` | "Watch →" → "Full story →", update track event label |
| `app/page.tsx` | "Watch →" → "Full story →" (3 sites), add NTK post-first-story capture, add digest preview anchor link |
| `app/digest/page.tsx` | "Watch →" → "Full story →" |
| `lib/email/digest-html.ts` | "Watch →" → "Full story →" in HTML template |
| `app/story/[slug]/page.tsx` | Move EmbedPlayer below editorial content, add "Source Video" label |
| `components/EmailCaptureInline.tsx` | Full rewrite: new copy, single form (no nudge variant) |
| `components/EmailCapture.tsx` | Update copy: headline, button, placeholder, trust line |
| `components/Header.tsx` | "Subscribe" → "Get the digest", update href anchor |

---

## Task 1: "Full story →" — global CTA rename

**Files:**
- Modify: `components/StoryCard.tsx:87`
- Modify: `app/page.tsx:107,713,757`
- Modify: `app/digest/page.tsx` (line with "Watch →")
- Modify: `lib/email/digest-html.ts:119`

### Why
"Watch →" promises a video player. The homepage reads like a written briefing — readers expect a written experience. "Full story →" matches the actual content hierarchy on the story page (text first, video as evidence).

- [ ] **Step 1: Replace in StoryCard.tsx**

In `components/StoryCard.tsx`, find the Watch link (line ~87) and change both the visible text and the tracking event label:

```tsx
// Before
<a
  href={`/story/${story.slug}`}
  target="_blank"
  rel="noopener noreferrer"
  className="text-xs font-semibold text-[oklch(0.52_0.14_196)] hover:underline underline-offset-2 ml-auto py-1 px-0.5 -my-1"
  onClick={() => track('story_watched', { slug: story.slug, platform: story.platform, category: story.category ?? 'unknown' })}
>
  Watch →
</a>

// After
<a
  href={`/story/${story.slug}`}
  target="_blank"
  rel="noopener noreferrer"
  className="text-xs font-semibold text-[oklch(0.52_0.14_196)] hover:underline underline-offset-2 ml-auto py-1 px-0.5 -my-1"
  onClick={() => track('story_click', { slug: story.slug, platform: story.platform, category: story.category ?? 'unknown' })}
>
  Full story →
</a>
```

- [ ] **Step 2: Replace in app/page.tsx — NeedToKnowStory (line ~107)**

```tsx
// Before
<Link
  href={`/story/${item.slug}`}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-block mt-4 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
>
  Watch →
</Link>

// After
<Link
  href={`/story/${item.slug}`}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-block mt-4 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
>
  Full story →
</Link>
```

- [ ] **Step 3: Replace in app/page.tsx — Global Blindspot (line ~713) and Global Lens (line ~757)**

Both use this identical pattern — replace both:

```tsx
// Before
<a href={`/story/${s.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[oklch(0.52_0.14_196)] hover:underline underline-offset-2 ml-auto py-1 px-0.5 -my-1">Watch →</a>

// After
<a href={`/story/${s.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[oklch(0.52_0.14_196)] hover:underline underline-offset-2 ml-auto py-1 px-0.5 -my-1">Full story →</a>
```

- [ ] **Step 4: Replace in app/digest/page.tsx**

Find the "Watch →" link and replace:

```tsx
// Before
Watch →
// After
Full story →
```

- [ ] **Step 5: Replace in lib/email/digest-html.ts (line ~119)**

```ts
// Before
">Watch →</a>
// After
">Full story →</a>
```

- [ ] **Step 6: Verify**

Run `npm run dev`. Open the homepage. Confirm every story CTA reads "Full story →". Open `/digest` — confirm the same. No "Watch →" should appear anywhere.

- [ ] **Step 7: Commit**

```bash
git add components/StoryCard.tsx app/page.tsx app/digest/page.tsx lib/email/digest-html.ts
git commit -m "copy: rename Watch → to Full story → across all CTAs"
```

---

## Task 2: Story page layout restructure

**Files:**
- Modify: `app/story/[slug]/page.tsx:261-262` (move EmbedPlayer, add label)

### Why
Current order: badges → title → meta → **video** → description → analysis. New order: badges → title → meta → description → analysis → **"Source Video" + video**. The video becomes supporting evidence, not the lede. This reframes the page from "video aggregator" to "news analysis that shows its sources."

- [ ] **Step 1: Remove EmbedPlayer from its current position**

In `app/story/[slug]/page.tsx`, delete these two lines (currently after the meta row, around line 261–262):

```tsx
{/* Embed */}
<EmbedPlayer embedUrl={s.embed_url} platform={s.platform} title={s.title} />
```

- [ ] **Step 2: Insert EmbedPlayer with "Source Video" label after the World View block**

Find the World View closing `)}` (around line 426) and insert immediately after it, before the subscribe nudge:

```tsx
{/* Source Video */}
<div className="mt-8">
  <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3">
    Source Video
  </p>
  <EmbedPlayer embedUrl={s.embed_url} platform={s.platform} title={s.title} />
</div>
```

- [ ] **Step 3: Remove the gap that was left after the meta row**

After moving the embed, the description now immediately follows the meta row. Make sure the description block has its top margin:

```tsx
{/* Description */}
{s.description && (
  <p className="editorial-body mt-6 text-foreground/90">{s.description}</p>
)}
```

The `mt-6` is already there — confirm it reads naturally. No other changes needed.

- [ ] **Step 4: Verify**

Run `npm run dev`. Open any story page (e.g. `/story/youtube-vLaVljEM3b_U`). Confirm:
- Description and Verified/Interpretation appear before the video
- Video appears at the bottom under "SOURCE VIDEO" label
- "Why this is here" expander still works
- World View section (if present) still appears above the video

- [ ] **Step 5: Commit**

```bash
git add app/story/[slug]/page.tsx
git commit -m "feat: move video below editorial content on story pages, add Source Video label"
```

---

## Task 3: Email capture module rebuild

**Files:**
- Modify: `components/EmailCaptureInline.tsx` (full rewrite)
- Modify: `components/EmailCapture.tsx` (copy update)

### Why
Zero signups in 30 days. "Get daily briefing" and "Get it daily" don't communicate concrete value. The new copy — "Get the full picture in 5 minutes" / "Get the digest" / "Free. No spam. Unsubscribe anytime" — matches the brand voice and reduces friction.

- [ ] **Step 1: Rewrite EmailCaptureInline.tsx**

Replace the entire file contents:

```tsx
'use client'

import { useState } from 'react'
import { track } from '@/lib/analytics'

export default function EmailCaptureInline({ placement = 'inline' }: { placement?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    try {
      const ref = new URLSearchParams(window.location.search).get('ref')
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...(ref ? { ref } : {}) }),
      })
      if (res.ok) {
        track('signup_completed', { placement })
        setStatus('success')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <p className="text-xs font-medium text-[oklch(0.52_0.14_196)] mt-3">
        ✓ You&apos;re in — check your inbox.
      </p>
    )
  }

  return (
    <div className="mt-3">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="flex-1 text-sm px-3 py-2 rounded border border-border bg-background focus:outline-none focus:border-[oklch(0.52_0.14_196)] min-w-0"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="text-sm font-semibold px-4 py-2 rounded bg-[oklch(0.52_0.14_196)] text-white hover:opacity-80 transition-opacity shrink-0 disabled:opacity-50"
        >
          {status === 'loading' ? '...' : 'Get the digest'}
        </button>
      </form>
      <p className="text-[11px] text-muted-foreground mt-1.5">Free. No spam. Unsubscribe anytime.</p>
      {status === 'error' && (
        <p className="text-xs text-red-500 mt-1">Something went wrong — try again.</p>
      )}
    </div>
  )
}
```

Note: the `nudge` prop is removed. All call sites used either `nudge` (story page) or default (homepage). The `placement` prop replaces it — callers pass `placement="story"`, `placement="hero"`, etc. for PostHog tracking.

- [ ] **Step 2: Update EmailCapture.tsx copy**

Replace the `<section>` content inside `EmailCapture.tsx` (the dark full-width block used at the bottom of the homepage):

```tsx
// Change h2 from:
<h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
  The full picture, not the profitable picture.
</h2>
<p className="text-sm text-background/70 mb-6">
  Every source labeled. Every story in context. The full picture in 5 minutes. Free.
</p>

// To:
<h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
  Get the full picture in 5 minutes.
</h2>
<p className="text-sm text-background/70 mb-6">
  Every source labeled. Every story in context. No spin, no outrage.
</p>
```

Also update the button text and placeholder in `EmailCapture.tsx`:

```tsx
// placeholder: "your@email.com" → "Enter your email"
// button text: "Join Free" → "Get the digest"
// loading text: "Joining..." → "..."

<Input
  type="email"
  placeholder="Enter your email"
  ...
/>
<Button ...>
  {status === 'loading' ? '...' : 'Get the digest'}
</Button>
```

Add the trust line below the form (after the `</form>` closing tag, before the error `<p>`):

```tsx
<p className="text-xs text-background/50 mt-2 text-center">Free. No spam. Unsubscribe anytime.</p>
```

- [ ] **Step 3: Update call sites of EmailCaptureInline that used nudge={true}**

In `app/story/[slug]/page.tsx` (line ~433):

```tsx
// Before
<EmailCaptureInline nudge />

// After
<EmailCaptureInline placement="story" />
```

In `app/page.tsx` — the existing inline usage (in the masthead):

```tsx
// Before
<EmailCaptureInline />

// After
<EmailCaptureInline placement="hero" />
```

- [ ] **Step 4: Verify**

Run `npm run dev`. Check:
- Homepage masthead: shows "Get the digest" button and "Free. No spam. Unsubscribe anytime." trust line
- Story page nudge box: same copy, no "Enjoying this?" prefix
- Bottom of homepage dark block: "Get the full picture in 5 minutes." headline, "Get the digest" button

- [ ] **Step 5: Commit**

```bash
git add components/EmailCaptureInline.tsx components/EmailCapture.tsx app/story/[slug]/page.tsx app/page.tsx
git commit -m "feat: rebuild email capture with conversion-optimized copy and placement tracking"
```

---

## Task 4: Signup placement — three positions on homepage

**Files:**
- Modify: `app/page.tsx` — add capture after first NTK story

### Why
Three placements: hero (already exists), after the first Need To Know story (visitor has just read the product), above the footer (already exists as `<EmailCapture />`). The post-NTK placement is the missing one — it catches the visitor at peak engagement after experiencing the product's value.

- [ ] **Step 1: Confirm existing placements are correct**

In `app/page.tsx`, verify:
1. `<EmailCaptureInline placement="hero" />` is in the masthead section (inside the `<div className="mb-6">` block, after the description `<p>` tags)
2. `<EmailCapture />` is at the bottom of `<main>`, before `<Footer />`

Both should already be in place from Task 3 and prior code.

- [ ] **Step 2: Add capture after the first NTK story in DigestView**

In `app/page.tsx`, find the `DigestView` component's `needToKnow.map()` section (around line 229–235):

```tsx
// Before
<section className="mb-10">
  <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1">
    Need To Know
  </p>
  <div className="divide-y divide-border">
    {content.needToKnow.map((item, i) => (
      <div key={item.slug}>
        <NeedToKnowStory item={item} storyMap={storyMap} />
      </div>
    ))}
  </div>
</section>

// After
<section className="mb-10">
  <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1">
    Need To Know
  </p>
  <div className="divide-y divide-border">
    {content.needToKnow.map((item, i) => (
      <div key={item.slug}>
        <NeedToKnowStory item={item} storyMap={storyMap} />
        {i === 0 && content.needToKnow.length > 1 && (
          <div className="py-5 px-1">
            <p className="text-sm font-semibold text-foreground mb-0.5">Get the full picture in 5 minutes.</p>
            <p className="text-xs text-muted-foreground mb-2">Independent news, every source labeled. Free daily briefing.</p>
            <EmailCaptureInline placement="post-ntk" />
          </div>
        )}
      </div>
    ))}
  </div>
</section>
```

Make sure `EmailCaptureInline` is imported at the top of the file — it already is.

- [ ] **Step 3: Verify**

Run `npm run dev`. Open the homepage in digest view. Confirm a signup module appears after the first Need To Know story, between it and the second one. It should not appear if there's only one NTK story.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add email capture after first Need To Know story"
```

---

## Task 5: Digest preview anchor link in masthead

**Files:**
- Modify: `app/page.tsx` — add anchor id to digest section, add "See today's digest →" link in masthead

### Why
"See today's digest →" makes the email product tangible before asking for the email. A visitor who scrolls into the digest is a warmer subscriber than one who signs up on faith.

- [ ] **Step 1: Add anchor id to the digest content section**

In `app/page.tsx`, find the DigestView render (around line 646–647):

```tsx
// Before
{activeView === 'digest' && digest ? (
  <DigestView content={digest.content} date={digest.date} storyMap={storyMap} />

// After
{activeView === 'digest' && digest ? (
  <div id="digest">
    <DigestView content={digest.content} date={digest.date} storyMap={storyMap} />
  </div>
```

- [ ] **Step 2: Add the preview link in the masthead**

In the masthead block (the `<div className="mb-6">` section), add a "See today's digest →" link after `<EmailCaptureInline placement="hero" />` — but only when a digest exists and the active view is digest:

```tsx
// After <EmailCaptureInline placement="hero" /> add:
{digest && activeView === 'digest' && (
  <a
    href="#digest"
    className="inline-block mt-3 text-xs font-semibold text-[oklch(0.52_0.14_196)] hover:underline underline-offset-2"
  >
    See today&apos;s digest ↓
  </a>
)}
```

- [ ] **Step 3: Verify**

Run `npm run dev`. On the homepage in digest view, confirm "See today's digest ↓" appears below the email field. Click it — page should scroll to the digest content.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add See today's digest anchor link in masthead"
```

---

## Task 6: Global copy cleanup

**Files:**
- Modify: `components/Header.tsx` — "Subscribe" → "Get the digest"

### Why
One "Subscribe" in the nav next to all the "Get the digest" copy everywhere else makes the site feel unfinished.

- [ ] **Step 1: Update Header.tsx**

In `components/Header.tsx`, find the subscribe link (lines ~39–42):

```tsx
// Before
<a href="/#subscribe" ...>Subscribe</a>

// After
<a href="/#subscribe" ...>Get the digest</a>
```

- [ ] **Step 2: Global scan — confirm no remaining instances of old copy**

Run these checks and confirm zero results:

```bash
grep -rn "Watch →" app/ components/ lib/email/ --include="*.tsx" --include="*.ts"
grep -rn "Get daily briefing\|Get it daily\|Join Free\|Joining\.\.\." components/ --include="*.tsx"
grep -rn 'placeholder="your@email\.com"' components/ --include="*.tsx"
```

Expected: all return empty.

- [ ] **Step 3: Verify**

Run `npm run dev`. Check:
- Header nav shows "Get the digest" link
- No "Watch →" anywhere on homepage, story pages, or digest page
- All email inputs say "Enter your email"
- All submit buttons say "Get the digest"

- [ ] **Step 4: Commit**

```bash
git add components/Header.tsx
git commit -m "copy: replace Subscribe with Get the digest in header nav"
```

---

## Self-Review

**Spec coverage check:**

| Spec item | Task |
|---|---|
| "Watch →" → "Full story →" globally | Task 1 ✓ |
| Story page: video below editorial content | Task 2 ✓ |
| "Source Video" label above embed | Task 2 ✓ |
| Signup copy: "Get the full picture in 5 minutes" | Task 3 ✓ |
| Signup button: "Get the digest" | Task 3 ✓ |
| Trust line: "Free. No spam. Unsubscribe anytime" | Task 3 ✓ |
| One email field, one button | Task 3 ✓ |
| Capture below hero | Task 4 (existing, confirmed) ✓ |
| Capture after first NTK story | Task 4 ✓ |
| Capture above footer | Task 4 (existing `<EmailCapture />`) ✓ |
| "See today's digest →" preview link | Task 5 ✓ |
| Remove remaining "Subscribe" instances | Task 6 ✓ |
| Remove "your@email.com" placeholder | Task 3 + Task 6 ✓ |
| Remove "Get daily briefing" / "Get it daily" | Task 3 ✓ |

**Tracking note from spec:** If signups remain near zero after two weeks with these changes deployed, the problem shifts to traffic volume or audience fit. The PostHog `placement` property on `signup_completed` will show which of the three positions converts — use that data before adding more placements.

**Type consistency check:**
- `EmailCaptureInline` now takes `placement?: string` (was `nudge?: boolean`). All three call sites updated in Tasks 3 and 4.
- `track('story_click', ...)` replaces `track('story_watched', ...)` in StoryCard. PostHog will show a new event name going forward — the old `story_watched` data (1 all-time event) is not worth preserving.
