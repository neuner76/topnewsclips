# Standardize Story Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visible section labels "What happened", "Why it matters", and "World view" to NeedToKnow stories so readers immediately understand the structure of each entry.

**Architecture:** Pure rendering change — no data model changes needed. `NeedToKnowItem.paragraphs[0]` already contains "What happened" content, `paragraphs[1]` already contains "Why it matters" content, and `howWorldSeesIt` already contains "World view" content. Each rendered paragraph gets a small all-caps label above it, matching the existing `text-[10px] font-bold tracking-widest text-muted-foreground uppercase` label style used throughout the app. "How the world sees it" → "World view" is a text rename only. Confidence is already shown as a `ConfidenceBadge` in the badge row on the homepage; no changes needed for confidence.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `components/DigestDisplay.tsx` | Modify `NeedToKnowStory`: wrap each of the first 2 paragraphs in a `<div>` with a label above; rename "How the world sees it" → "World view" |
| `app/page.tsx` | Modify `NeedToKnowStory` (lines ~73–134): same paragraph label wrap; rename "How the world sees it" → "World view" |

---

### Task 1: Add section labels in DigestDisplay.tsx

`DigestDisplay.tsx` is the shared renderer used by `/digest`, `/digest/[date]`, and the full sample view linked from `/newsletter`.

**Files:**
- Modify: `components/DigestDisplay.tsx`

**Current `NeedToKnowStory` in DigestDisplay.tsx (full function for reference):**

```tsx
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
```

- [ ] **Step 1: Replace `NeedToKnowStory` in `components/DigestDisplay.tsx`**

Replace the entire `NeedToKnowStory` function (from `function NeedToKnowStory` through its closing `}`) with:

```tsx
const PARA_LABELS = ['What happened', 'Why it matters'] as const

function NeedToKnowStory({ item }: { item: NeedToKnowItem }) {
  return (
    <article className="mb-10">
      <Link href={`/story/${item.slug}`} className="group block mb-3">
        <h2 className="text-xl font-black tracking-tight leading-snug group-hover:underline">
          {item.sectionTitle}
        </h2>
      </Link>
      <div className="space-y-4">
        {item.paragraphs.slice(0, 2).map((p, i) => (
          <div key={i}>
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
              {PARA_LABELS[i]}
            </p>
            <p className="text-sm leading-relaxed text-foreground/90">{p}</p>
          </div>
        ))}
      </div>
      {item.howWorldSeesIt && item.howWorldSeesIt.length > 0 && (
        <div className="mt-4 pl-3 border-l-2 border-border space-y-2">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            World view
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
```

Key changes:
- `PARA_LABELS` constant defined at module scope above the function (avoids reallocation per render)
- `space-y-3` → `space-y-4` on the paragraphs wrapper (slightly more breathing room with labels)
- Each `<p>` wrapped in a `<div>` with a label `<p>` above it
- `"How the world sees it"` → `"World view"`

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/ericneuner/topnewsclips && npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (no errors). If errors appear, fix before proceeding.

- [ ] **Step 3: Commit**

```bash
cd /Users/ericneuner/topnewsclips && git add components/DigestDisplay.tsx && git commit -m "feat: add What happened / Why it matters / World view labels to DigestDisplay NTK stories"
```

---

### Task 2: Add section labels in app/page.tsx

The homepage (`app/page.tsx`) has its own `NeedToKnowStory` component that also takes a `storyMap` prop for source badges and confidence display. The paragraph rendering and "How the world sees it" label need the same treatment.

**Files:**
- Modify: `app/page.tsx`

**Current paragraph block and howWorldSeesIt block inside `NeedToKnowStory` in `app/page.tsx`:**

```tsx
// paragraphs block (lines ~102-107):
<div className="space-y-3">
  {item.paragraphs.slice(0, 2).map((p, i) => (
    <p key={i} className="editorial-body text-foreground/90">
      {p}
    </p>
  ))}
</div>

// howWorldSeesIt label (line ~117):
<p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-3">
  How the world sees it
</p>
```

- [ ] **Step 1: Replace the paragraphs block in `app/page.tsx` NeedToKnowStory**

The `PARA_LABELS` constant is already defined in `components/DigestDisplay.tsx`. In `app/page.tsx`, define it at module scope near the top of the file's component section (just before `function NeedToKnowStory`). Then replace the paragraphs block.

Add this line immediately before `function NeedToKnowStory` in `app/page.tsx`:

```tsx
const PARA_LABELS = ['What happened', 'Why it matters'] as const
```

Then replace the paragraphs `<div>` block:

```tsx
// Replace:
<div className="space-y-3">
  {item.paragraphs.slice(0, 2).map((p, i) => (
    <p key={i} className="editorial-body text-foreground/90">
      {p}
    </p>
  ))}
</div>

// With:
<div className="space-y-4">
  {item.paragraphs.slice(0, 2).map((p, i) => (
    <div key={i}>
      <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
        {PARA_LABELS[i]}
      </p>
      <p className="editorial-body text-foreground/90">{p}</p>
    </div>
  ))}
</div>
```

- [ ] **Step 2: Rename "How the world sees it" → "World view" in `app/page.tsx`**

Locate the `howWorldSeesIt` label inside `NeedToKnowStory` in `app/page.tsx`:

```tsx
// Replace:
<p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-3">
  How the world sees it
</p>

// With:
<p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-3">
  World view
</p>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/ericneuner/topnewsclips && npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (no errors).

- [ ] **Step 4: Commit**

```bash
cd /Users/ericneuner/topnewsclips && git add app/page.tsx && git commit -m "feat: add What happened / Why it matters / World view labels to homepage NTK stories"
```

---

## Visual Verification Checklist

After both tasks are committed, start the dev server and check:

```bash
cd /Users/ericneuner/topnewsclips && npm run dev
```

- [ ] Open `http://localhost:3000` — each NTK story should show "WHAT HAPPENED" in small all-caps above the first paragraph and "WHY IT MATTERS" above the second
- [ ] Open `http://localhost:3000/digest` — same labels visible
- [ ] On any story with `howWorldSeesIt` entries, the section should now read "WORLD VIEW" instead of "HOW THE WORLD SEES IT"
- [ ] Spacing between labeled paragraphs looks clean (not too tight, not too loose)
- [ ] Build succeeds: `npm run build`
