# TopNewsClips — Visual Design Spec
**Goal:** Redesign topnewsclips.com to compete with Ground.news using a unified world map visual language and a clear source credibility system.

---

## 1. Design Philosophy

The entire site is built around one metaphor: **a live global intelligence map.**

Every section, every card, every component connects back to the world map — reinforcing the brand promise: *"The full picture, not the profitable picture."*

Ground.news uses left/center/right bias bars. TopNewsClips counters with something richer: **a 9-tier source credibility system** made instantly scannable through visual meter bars.

---

## 2. Color System

| Token | Hex | Usage |
|---|---|---|
| `navy-950` | `#0a0f1e` | Page background, section backgrounds |
| `navy-800` | `#111827` | Card backgrounds |
| `navy-700` | `#1a2333` | Card hover state |
| `electric-blue` | `#3b82f6` | Map glow, links, accents |
| `map-glow` | `#1d4ed8` at 20% opacity | World map country outlines |
| `white` | `#ffffff` | Headlines, primary text |
| `grey-400` | `#9ca3af` | Secondary text, metadata |
| `tier-green` | `#22c55e` | Tier 1–3 (most trustworthy) |
| `tier-amber` | `#f59e0b` | Tier 4–6 (moderate confidence) |
| `tier-red` | `#ef4444` | Tier 7–9 (low confidence) |
| `blindspot-orange` | `#f97316` | Global Blindspot accents, pins |

---

## 3. Typography

- **Font:** Inter (primary) — clean, modern, editorial
- **Hero headline:** 56px / 700 weight / white
- **Section headline:** 32px / 700 weight / white
- **Card headline:** 18px / 600 weight / white
- **Body / summary:** 14px / 400 weight / grey-400
- **Metadata / labels:** 11px / 500 weight / uppercase / letter-spacing 0.08em

---

## 4. The World Map Component

This is the site's core visual element. Used in three modes:

### Mode A — Hero Background
- Full-width dark navy canvas
- SVG world map with country borders in `map-glow` color (blue at 20% opacity)
- Subtle animated pulse dots scattered across major cities (CSS animation, 3s loop)
- Soft radial gradient overlay darkening edges so text reads clearly
- Implementation: Use `react-simple-maps` or a lightweight SVG world map

### Mode B — Card Watermark
- Same SVG map, scaled to fit card width
- Opacity: 6–8% — barely visible, adds texture without distraction
- Positioned bottom-right of card, slightly cropped

### Mode C — Global Blindspot Centerpiece
- Full-width map at 60% opacity
- Orange glowing pin markers (`blindspot-orange`) on underreported regions
- Pins pulse with a CSS keyframe animation
- Country labels hidden — only geography visible

---

## 5. Source Credibility Tier Meter

**Critical rule: Tier 1 = most trustworthy. Tier 9 = least trustworthy.**

The meter is a row of 9 small bars (like a phone signal meter), displayed on every story card.

### Visual logic:
| Tier | Bars filled | Color |
|---|---|---|
| Tier 1 | 9/9 | `tier-green` |
| Tier 2 | 8/9 | `tier-green` |
| Tier 3 | 7/9 | `tier-green` |
| Tier 4 | 6/9 | `tier-amber` |
| Tier 5 | 5/9 | `tier-amber` |
| Tier 6 | 4/9 | `tier-amber` |
| Tier 7 | 3/9 | `tier-red` |
| Tier 8 | 2/9 | `tier-red` |
| Tier 9 | 1/9 | `tier-red` |

Unfilled bars: `grey-400` at 30% opacity.

### Confidence label (shown next to meter):
| Marker | Color dot | Label |
|---|---|---|
| Corroborated | `tier-green` dot | "Corroborated" |
| Reported | `tier-amber` dot | "Reported" |
| Analysis | `blindspot-orange` dot | "Analysis" |
| Single-source | `tier-red` dot | "Single Source" |

### Component layout (left to right):
```
[Tier meter bars] [Tier label] · [Confidence dot] [Confidence label] · [N sources] · [X min read]
```

Example:
```
▮▮▮▮▮▮▮▯▯  Tier 2  ·  ● Corroborated  ·  18 sources  ·  4 min
```

---

## 6. Story Card Component

```
┌─────────────────────────────────────┐
│ [Category badge]          [Map watermark, 7% opacity, bottom-right] │
│                                     │
│ Bold headline (18px/600)            │
│ 2-line summary (14px/400/grey-400)  │
│                                     │
│ ▮▮▮▮▮▮▯▯▯ Tier 4 · ● Reported · 7 sources · 3 min │
└─────────────────────────────────────┘
```

- Background: `navy-800`
- Border: 1px solid white at 6% opacity
- Border-radius: 12px
- Hover: border brightens to 15% opacity, slight lift (translateY -2px)
- Category badges: colored pill, 11px uppercase — e.g. blue for World, green for Science, purple for Politics

---

## 7. Homepage Layout

```
[NAV BAR]
  Logo left | Digest · Newsletter · Clips · Archive · About | Subscribe CTA right

[HERO]
  World map background (Mode A)
  Large featured story — headline + 2-line summary + tier meter
  Overlay: dark gradient bottom-to-top so text is legible

[STORY GRID]
  3-column card grid
  Each card: Story Card Component (see §6)
  Section headers: "Politics" / "World" / "Science" etc. in 13px uppercase spaced caps

[GLOBAL BLINDSPOT SECTION]  ← see §8

[NEWSLETTER CTA SECTION]
  Dark background, centered
  Headline: "The full picture, delivered daily."
  Sub: "Source-verified. Globally sourced. No agenda."
  Email input + Subscribe button
```

---

## 8. Global Blindspot Section

This is the site's signature section — visually distinct, designed to stop the scroll.

```
[Dark navy full-width section]

[World map — Mode C — with orange pins on underreported regions]

LEFT COLUMN:
  Small label: "GLOBAL BLINDSPOT" (blindspot-orange, 11px uppercase)
  Large headline: "What the world is ignoring right now."
  Sub: "Stories covered by less than 5% of Western outlets."

RIGHT / BELOW:
  3 horizontal story cards with:
    - Orange left-border accent (4px, blindspot-orange)
    - Country flag emoji + region name
    - Bold headline
    - Stat badge: "2% Western coverage" in orange pill

  CTA link: "See all blindspot stories →" (orange, underline on hover)
```

---

## 9. Navigation Bar

- Background: `navy-950` with 1px bottom border at 10% white opacity
- Sticky on scroll
- Logo: "TOP NEWS CLIPS" in 700 weight + small tagline below in grey-400
- Nav links: 14px / grey-400 → white on hover
- Subscribe button: electric-blue background, white text, 8px border-radius

---

## 10. Implementation Notes for Cursor

- **Stack assumption:** Next.js + Tailwind CSS
- **Map library:** `react-simple-maps` (lightweight, SVG-based, no API key needed)
- **Animation:** Tailwind `animate-pulse` for map pins; custom keyframe for city dots
- **Tier meter:** Build as a reusable React component `<TierMeter tier={2} confidence="Corroborated" sources={18} readTime={4} />`
- **Fonts:** Load Inter via `next/font/google`
- **Mobile:** Cards go 1-column on mobile, 2-column on tablet, 3-column on desktop
- **Dark mode only** — no light mode needed, the map aesthetic requires dark

---

## 11. What Makes This Beat Ground.news

| Feature | Ground.news | TopNewsClips (redesigned) |
|---|---|---|
| Trust signal | Left/Center/Right bar | 9-tier signal meter + confidence label |
| Visual anchor | Card images | Live world map (persistent) |
| Differentiator section | "Blindspot" (text-heavy) | Global Blindspot (map + pins, visual) |
| Brand metaphor | News bias | Global intelligence dashboard |
| Color system | Neutral grays | Navy + electric blue (premium, distinct) |
