# Chunk G — UI Overhaul (Dark Glass + Neon) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a consistent sleek dark-glassmorphism + cyan/blue neon visual language across every UI component. Styling only — no behavior change.

**Architecture:** A small `uiTokens.js` holds shared class strings (glass panel, accent gradient, glow) so components stay consistent and DRY. Each component is restyled to use frosted translucent panels, gradient accents, soft glows, and smooth transitions.

**Tech Stack:** React, Tailwind CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-14-builder-realism-ui-design.md`

**Note:** `node`/`npx` are NOT on PATH. In PowerShell prepend: `$env:Path = "C:\Program Files\nodejs;" + $env:Path`. Commit locally; do NOT push/deploy. Depends on Chunks D–F. Existing tests (BudgetEntry, PartCard) must stay green — keep `aria-label="form"`, the number input, part name/price text, and the 🔒 lock indicator.

---

### Task G1: Tokens + Budget Entry + Bars

**Files:**
- Create: `src/lib/uiTokens.js`
- Modify: `src/components/BudgetEntry.jsx`
- Modify: `src/components/DynamicBars.jsx`

- [ ] **Step 1: Create the shared UI tokens**

Create `src/lib/uiTokens.js`:
```js
// Shared Tailwind class strings for the dark-glass + neon look. Literal strings
// so Tailwind's content scanner picks up the (arbitrary) classes.
export const GLASS = 'bg-gray-900/70 backdrop-blur-md border border-white/10'
export const GLASS_STRONG = 'bg-gray-900/85 backdrop-blur-xl border border-white/10'
export const ACCENT_TEXT = 'text-cyan-300'
export const ACCENT_GRAD = 'bg-gradient-to-r from-cyan-500 to-blue-600'
export const GLOW = 'shadow-[0_0_20px_rgba(34,211,238,0.25)]'
export const GLOW_STRONG = 'shadow-[0_0_25px_rgba(34,211,238,0.45)]'
```

- [ ] **Step 2: Restyle BudgetEntry**

Replace `src/components/BudgetEntry.jsx` ENTIRELY with:
```jsx
import { useState } from 'react'

export default function BudgetEntry({ onSubmit }) {
  const [value, setValue] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const num = parseFloat(value)
    if (num > 0) onSubmit(num)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-white bg-gradient-to-br from-gray-950 via-gray-900 to-cyan-950/40">
      <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
        Build Your PC
      </h1>
      <p className="text-gray-400 mb-10 text-lg">What's your budget?</p>
      <form onSubmit={handleSubmit} aria-label="form" className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-2 text-3xl">
          <span className="text-cyan-300">£</span>
          <input
            autoFocus
            type="number"
            min="1"
            placeholder="1000"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="bg-gray-900/70 backdrop-blur-md text-white text-3xl w-52 px-4 py-3 rounded-2xl border border-white/10 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_25px_rgba(34,211,238,0.35)] text-center transition-all"
          />
        </div>
        <button
          type="submit"
          className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-[0_0_25px_rgba(34,211,238,0.45)] text-white font-semibold px-10 py-3 rounded-2xl text-lg transition-all"
        >
          Start Building
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Restyle DynamicBars**

Replace `src/components/DynamicBars.jsx` ENTIRELY with:
```jsx
export default function DynamicBars({ value, max, label, unit }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const barColor =
    pct >= 100 ? 'bg-gradient-to-r from-red-500 to-rose-500'
    : pct >= 80 ? 'bg-gradient-to-r from-amber-400 to-orange-500'
    : 'bg-gradient-to-r from-cyan-400 to-blue-500'

  const display = unit === '£'
    ? `£${value.toFixed(0)} / £${max.toFixed(0)}`
    : `${value}${unit} / ${max}${unit}`

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span>{display}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor} shadow-[0_0_10px_rgba(34,211,238,0.4)]`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify build + tests + commit**

Run: `npx vite build` → succeeds.
Run: `npx vitest run` → all pass (BudgetEntry tests still green).
```bash
git add src/lib/uiTokens.js src/components/BudgetEntry.jsx src/components/DynamicBars.jsx
git commit -m "feat(ui): glass+neon tokens, budget entry, and dynamic bars"
```

---

### Task G2: TopBar + Bottleneck + Toggles

**Files:**
- Modify: `src/components/TopBar.jsx`
- Modify: `src/components/BottleneckIndicator.jsx`
- Modify: `src/components/ResolutionToggle.jsx`
- Modify: `src/components/CaseToggle.jsx`

- [ ] **Step 1: Restyle TopBar**

In `src/components/TopBar.jsx`, replace the opening `<header ...>` tag's className and the budget button/edit classes. Change the `<header>` line:
```jsx
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-8">
```
to:
```jsx
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/70 backdrop-blur-md border-b border-white/10 px-6 py-3 flex items-center gap-8">
```
Change the brand span:
```jsx
      <span className="text-white font-bold text-lg tracking-tight">PC Builder</span>
```
to:
```jsx
      <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">PC Builder</span>
```
Change the edit input className to use a cyan focus ring:
```jsx
              className="w-24 bg-gray-800 text-white px-2 py-0.5 rounded border border-blue-500 focus:outline-none"
```
to:
```jsx
              className="w-24 bg-gray-800/80 text-white px-2 py-0.5 rounded-lg border border-cyan-400 focus:outline-none focus:shadow-[0_0_15px_rgba(34,211,238,0.35)]"
```
And the budget display button:
```jsx
            className="text-white font-semibold hover:text-blue-300 border-b border-dashed border-gray-600 hover:border-blue-400"
```
to:
```jsx
            className="text-white font-semibold hover:text-cyan-300 border-b border-dashed border-gray-600 hover:border-cyan-400 transition-colors"
```

- [ ] **Step 2: Restyle BottleneckIndicator**

Replace `src/components/BottleneckIndicator.jsx` ENTIRELY with:
```jsx
import useBuilderStore from '../store/useBuilderStore'
import { computeBottleneck } from '../lib/bottleneck'
import ResolutionToggle from './ResolutionToggle'

export default function BottleneckIndicator() {
  const cpu        = useBuilderStore((s) => s.selectedParts.cpu)
  const gpu        = useBuilderStore((s) => s.selectedParts.gpu)
  const resolution = useBuilderStore((s) => s.resolution)

  const result = computeBottleneck(cpu, gpu, resolution)

  return (
    <div className="absolute top-4 left-4 w-72 bg-gray-900/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white text-sm font-semibold tracking-wide">Bottleneck</span>
        <ResolutionToggle />
      </div>
      {!result ? (
        <p className="text-gray-500 text-xs">Select a CPU and a GPU to see the balance.</p>
      ) : (
        <>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(34,211,238,0.4)]
                ${result.balancePct >= 85 ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                  : result.balancePct >= 70 ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                  : 'bg-gradient-to-r from-red-500 to-rose-500'}`}
              style={{ width: `${result.balancePct}%` }}
            />
          </div>
          <p className="text-xs text-gray-300">
            <span className="font-semibold text-cyan-300">{result.balancePct}% balanced.</span>{' '}
            {result.verdict}
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Restyle ResolutionToggle**

Replace `src/components/ResolutionToggle.jsx` ENTIRELY with:
```jsx
import useBuilderStore from '../store/useBuilderStore'

const OPTIONS = [
  { id: '1080p', label: '1080p' },
  { id: '1440p', label: '1440p' },
  { id: '4k',    label: '4K' },
]

export default function ResolutionToggle() {
  const resolution    = useBuilderStore((s) => s.resolution)
  const setResolution = useBuilderStore((s) => s.setResolution)

  return (
    <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setResolution(opt.id)}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-all
            ${resolution === opt.id
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]'
              : 'text-gray-300 hover:text-white'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Restyle CaseToggle**

In `src/components/CaseToggle.jsx`, replace the `<button>` className:
```jsx
      className="absolute bottom-6 right-6 bg-gray-800/90 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-full border border-gray-600 transition-all flex items-center gap-2"
```
with:
```jsx
      className="absolute bottom-6 right-6 bg-gray-900/70 backdrop-blur-md hover:border-cyan-400/60 text-white text-sm px-4 py-2 rounded-full border border-white/10 transition-all flex items-center gap-2"
```

- [ ] **Step 5: Verify build + tests + commit**

Run: `npx vite build` → succeeds.
Run: `npx vitest run` → all pass.
```bash
git add src/components/TopBar.jsx src/components/BottleneckIndicator.jsx src/components/ResolutionToggle.jsx src/components/CaseToggle.jsx
git commit -m "feat(ui): glass+neon top bar, bottleneck indicator, and toggles"
```

---

### Task G3: Selector + Cards + Search + Final Check

**Files:**
- Modify: `src/components/PartSelector.jsx`
- Modify: `src/components/PartCard.jsx`
- Modify: `src/components/SearchBar.jsx`

- [ ] **Step 1: Restyle SearchBar**

Replace `src/components/SearchBar.jsx` ENTIRELY with:
```jsx
export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/5 text-white text-sm px-3 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(34,211,238,0.25)] placeholder-gray-500 transition-all"
    />
  )
}
```

- [ ] **Step 2: Restyle PartCard**

Replace `src/components/PartCard.jsx` ENTIRELY with:
```jsx
export default function PartCard({ part, locked, lockReason, onSelect }) {
  return (
    <div
      title={locked ? lockReason : undefined}
      onClick={() => !locked && onSelect(part)}
      className={`relative rounded-2xl border p-4 flex flex-col gap-2 transition-all
        ${locked
          ? 'border-white/5 bg-white/5 opacity-40 cursor-not-allowed'
          : 'border-white/10 bg-white/5 hover:border-cyan-400/60 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(34,211,238,0.25)] cursor-pointer'
        }`}
    >
      <div className="text-sm font-semibold text-white leading-tight">{part.name}</div>
      <div className="font-bold text-cyan-300">£{part.price.toFixed(2)}</div>
      <div className="text-xs text-gray-400 space-y-0.5">
        {part.tdp > 0 && <div>{part.tdp}W TDP</div>}
        {part.socket && <div>Socket: {part.socket}</div>}
        {part.ramType && <div>{part.ramType}</div>}
        {part.wattage && <div>{part.wattage}W</div>}
        {part.capacityGb && (
          <div>{part.capacityGb >= 1000 ? `${part.capacityGb / 1000}TB` : `${part.capacityGb}GB`}</div>
        )}
      </div>
      {locked && <div className="absolute top-2 right-2 text-red-400 text-xs">🔒</div>}
    </div>
  )
}
```

- [ ] **Step 3: Restyle the PartSelector modal shell**

In `src/components/PartSelector.jsx`, change the overlay and panel container classes. The outer overlay:
```jsx
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 gap-4">
          <h2 className="text-white text-xl font-bold capitalize whitespace-nowrap">{category}</h2>
```
becomes:
```jsx
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-gray-900/80 backdrop-blur-xl rounded-3xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-white/10 shadow-[0_0_40px_rgba(34,211,238,0.15)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 gap-4">
          <h2 className="text-xl font-bold capitalize whitespace-nowrap bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">{category}</h2>
```
(Leave the SearchBar, close button, grid, and card-mapping logic unchanged.)

- [ ] **Step 4: Verify build + tests**

Run: `npx vite build` → succeeds.
Run: `npx vitest run` → all pass (PartCard tests still green — name, price, and 🔒 preserved).

- [ ] **Step 5: Manual browser check + 3D fine-tune**

Run `npx vite dev`, open the local URL, and review the whole round-2 result:
- App opens straight on the 3D ring (no "choose where to start" screen)
- The build looks like an upright in-case PC: vertical motherboard, horizontal GPU in the slot, PSU at the bottom, fans at the front — and the selected fan pack shows the right number of fans
- Rotating the build: each selected part's orbit line follows it on screen; empty slots' lines stay pointing to the center
- The UI reads as dark glass + cyan/blue neon throughout
- Search, 60% filter, deselect ✕, editable budget, case toggle, and bottleneck indicator all still work

If any 3D part sits visibly wrong (overlapping, clipping the case, floating), adjust that part's `position`/`rotation` in `src/lib/assemblyLayout.js` (and re-run `vite build`). Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add src/components/PartSelector.jsx src/components/PartCard.jsx src/components/SearchBar.jsx
git commit -m "feat(ui): glass+neon part selector, cards, and search"
```

---

## Self-Review

**Spec coverage (Chunk G):** shared tokens (G1) ✓; glass panels on top bar/bottleneck/selector/toggles (G2, G3) ✓; neon accents + glow on active/hover/recommended (G1–G3) ✓; refined part cards with hover lift + glow (G3) ✓; gradient+glow bars (G1, G2) ✓; budget-entry gradient backdrop (G1) ✓; styling-only, behavior preserved ✓.

**Type consistency:** no signatures change — pure className edits. Tests preserved: BudgetEntry keeps `aria-label="form"` + number input; PartCard keeps name, `£price`, and 🔒.

**Placeholders:** none — full code or exact class replacements in every step.

---

## Final Step (all four chunks D–G complete)

After D, E, F, G are done and verified, everything is committed locally. **Do not push/deploy** — ask the user before pushing to GitHub / Netlify (project preference).
