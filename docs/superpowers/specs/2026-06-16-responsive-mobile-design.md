# Phase 4b — Responsive / Mobile — Design

**Date:** 2026-06-16
**Status:** Approved (pending spec review)
**Part of:** Phase 4 of the roadmap (4b — the responsive/mobile overhaul; 4a perf+SEO already done). The final roadmap item.

## Goal

Make the builder usable on phones. The desktop layout (≥768px) is left exactly as-is; below `md`, the build view reflows to a 3D hero + a scrollable column, the top bar compacts, and the tabs shrink to fit. The Summary/Games/Peripherals tabs are already centred cards and need only light tweaks.

## Breakpoint + switch

Tailwind's `md` (768px) is the divide. A new hook `src/hooks/useIsMobile.js` drives the structural switch (orbit↔list, canvas hero↔fill):

```js
import { useState, useEffect } from 'react'
const QUERY = '(max-width: 767px)'
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  )
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    setIsMobile(mq.matches)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isMobile
}
```

Panels and the top bar that merely reflow use Tailwind `md:` classes; the build view's structural change (orbit vs list) uses the hook (so the orbit's per-frame rAF loop never runs on mobile).

## 1 — Decouple panel positioning

Today each floating panel hardcodes its own `absolute top-… left-… w-72`. That coupling blocks reuse in a stacked mobile column. Move positioning **out** of the panels — their roots become plain `PANEL` cards — and let the build view place them:

| Component | Root before | Root after |
|---|---|---|
| `BottleneckIndicator` | `absolute top-4 left-4 w-72 ${PANEL} p-4` | `${PANEL} p-4` |
| `PerformancePanel` | `absolute top-44 left-4 w-72 ${PANEL} p-4` | `${PANEL} p-4` |
| `BuildWarnings` | `absolute top-80 left-4 w-72 ${PANEL} p-3` | `${PANEL} p-3` |
| `UpgradeSuggestion` | `absolute bottom-6 left-6 w-80 ${PANEL} p-4` | `${PANEL} p-4` |
| `CaseToggle` | `absolute bottom-6 right-6 …` | `…` (no position) |
| `AutoBuildButton` | `absolute bottom-6 left-1/2 -translate-x-1/2 z-40 …` | `w-full md:w-auto …` (no position) |

`InfoDisclaimer` keeps its self-positioning and is rendered **desktop-only**. `OrbitRing` is unchanged and rendered **desktop-only**.

## 2 — Responsive build view (`BuilderScreen.jsx`)

```jsx
const isMobile = useIsMobile()
```

**Mobile (`isMobile`):**
```jsx
<div className="flex flex-col h-full overflow-y-auto">
  <div className="relative h-[45vh] shrink-0">
    <Suspense fallback={…}><BuildCanvas selectedParts={selectedParts} /></Suspense>
    <div className="absolute bottom-3 right-3"><CaseToggle /></div>
  </div>
  <div className="p-4 space-y-3 pb-12">
    <CategoryList selectedParts={selectedParts} onSelectCategory={setActiveCategory} onDeselect={removePart} />
    <BottleneckIndicator />
    <PerformancePanel />
    <BuildWarnings />
    <UpgradeSuggestion />
    <AutoBuildButton />
  </div>
</div>
```

**Desktop (current layout, panels now wrapped for positioning):**
```jsx
<div className="relative w-full h-full">
  <Suspense fallback={…}><BuildCanvas selectedParts={selectedParts} /></Suspense>
  <div className="absolute top-4 left-4 w-72"><BottleneckIndicator /></div>
  <div className="absolute top-44 left-4 w-72"><PerformancePanel /></div>
  <OrbitRing selectedParts={selectedParts} onSelectCategory={setActiveCategory} onDeselect={removePart} />
  <div className="absolute bottom-6 right-6"><CaseToggle /></div>
  <InfoDisclaimer />
  <div className="absolute bottom-6 left-6 w-80"><UpgradeSuggestion /></div>
  <div className="absolute top-80 left-4 w-72"><BuildWarnings /></div>
  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40"><AutoBuildButton /></div>
</div>
```

(Empty positioned wrappers around panels that return `null` are harmless.)

## 3 — Category list (`src/components/CategoryList.jsx`)

The mobile orbit replacement — same data and behaviour, stacked vertically. Props mirror `OrbitRing`: `{ selectedParts, onSelectCategory, onDeselect }`. For each category in `RECOMMENDED_ORDER`:
- **Filled:** a `PANEL` row — cyan dot · icon · part name · mono `£price` · a `×` remove button (`onDeselect`). Tapping the row body calls `onSelectCategory` to re-pick.
- **Empty:** a row — order number · icon · label; the next-recommended category (`nextRecommended`) is highlighted (cyan border + "pick one"). Tapping calls `onSelectCategory`.

No 3D tracking, no SVG — purely a tap list. (The `PartSelector` modal it opens is already a full-screen overlay that works on mobile.)

## 4 — Top bar (`TopBar.jsx`)

- Header: `px-3 md:px-6 py-2 md:py-3 gap-3 md:gap-8`, allow wrap on mobile.
- The two `DynamicBars` (Budget/Power) → `hidden md:flex` (desktop-only; the numbers are still in the metrics row).
- The metrics row (budget / remaining / power) stays, at a slightly smaller size on mobile.

## 5 — Tab nav + tab content

- Tab buttons (in `BuilderScreen`): `px-2.5 md:px-4 text-[11px] md:text-xs` so build/peripherals/summary/games fit ~360px.
- `BuildSummary` / `GamePanel` / `PeripheralsPanel`: already `max-w-2xl mx-auto px-4` cards — verify they breathe on mobile; adjust top padding only if the smaller tab bar needs it.

## Files

| File | Change |
|---|---|
| `src/hooks/useIsMobile.js` | New — matchMedia hook |
| `src/components/CategoryList.jsx` | New — mobile category list |
| `src/screens/BuilderScreen.jsx` | Responsive build view (mobile/desktop branches) + tab sizing |
| `src/components/TopBar.jsx` | Hide bars <md, compact metrics |
| `BottleneckIndicator`, `PerformancePanel`, `BuildWarnings`, `UpgradeSuggestion`, `CaseToggle`, `AutoBuildButton` | Remove self-positioning (parent positions) |

## Testing

- `src/tests/useIsMobile.test.js` — with `window.matchMedia` mocked to match, the hook returns `true`; to not match, `false`.
- `src/tests/CategoryList.test.jsx` — renders all 9 categories; a filled category shows its part name + a remove control; clicking a row calls `onSelectCategory` with the category id.
- Existing **111 tests stay green** (panel edits change only positioning classes, not content/roles the tests assert).
- Layout verified in the dev-server preview via `preview_resize` at mobile (375×812) and desktop (1280×800): mobile shows the hero + list + stacked cards and no overflow; desktop is unchanged.

## Edge cases

- Rotating / resizing across the breakpoint re-renders via the hook listener (orbit↔list swap).
- SSR-safety: the hook guards `typeof window` (not used here, but safe).
- Panels returning `null` leave empty positioned wrappers on desktop — invisible, no layout impact.

## Non-goals

- No redesign of the `PartSelector` modal (already a full-screen overlay that works on mobile).
- No change to desktop layout, behaviour, or the 3D scene.
- No tablet-specific layout (md+ = desktop; <md = mobile).
