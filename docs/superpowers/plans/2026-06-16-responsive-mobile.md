# Phase 4b — Responsive / Mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the builder usable on phones — a 3D hero + scrollable category list below `md`, compact top bar and tabs — while leaving the desktop layout untouched.

**Architecture:** A `useIsMobile()` matchMedia hook switches the build view between the current desktop overlay and a new mobile column. Panels are decoupled from their hardcoded positions so the build view can place them (absolute on desktop, stacked on mobile). A new `CategoryList` replaces the orbit on mobile.

**Tech Stack:** React 19, Zustand, Vite, Tailwind, Vitest + Testing Library (jsdom).

**Conventions for every task:**
- Node at `C:\Program Files\nodejs`. In PowerShell once per shell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`.
- Full suite: `npm run test:run`. Single file: `npm run test:run -- src/tests/<file>`. Baseline **111 passing**.
- Every commit appends: `-m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"`.
- Work on `main` locally; do not push.

---

### Task 1: useIsMobile hook

**Files:**
- Create: `src/hooks/useIsMobile.js`
- Create: `src/tests/useIsMobile.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/useIsMobile.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsMobile } from '../hooks/useIsMobile'

function mockMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('useIsMobile', () => {
  it('returns true when the mobile query matches', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('returns false when the query does not match', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/useIsMobile.test.js`
Expected: FAIL — `../hooks/useIsMobile` does not exist.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useIsMobile.js`:

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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/useIsMobile.test.js`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useIsMobile.js src/tests/useIsMobile.test.js
git commit -m "feat: useIsMobile media-query hook"
```

---

### Task 2: CategoryList (mobile orbit replacement)

**Files:**
- Create: `src/components/CategoryList.jsx`
- Create: `src/tests/CategoryList.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/CategoryList.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CategoryList from '../components/CategoryList'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')

describe('CategoryList', () => {
  it('renders all nine categories', () => {
    render(<CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} />)
    expect(screen.getByText('CPU')).toBeInTheDocument()
    expect(screen.getByText('GPU')).toBeInTheDocument()
    expect(screen.getByText('Case Fans')).toBeInTheDocument()
  })

  it('shows a selected part with a remove control', () => {
    render(<CategoryList selectedParts={{ cpu }} onSelectCategory={() => {}} onDeselect={() => {}} />)
    expect(screen.getByText(cpu.name)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove cpu/i })).toBeInTheDocument()
  })

  it('calls onSelectCategory when a category row is clicked', () => {
    const onSelect = vi.fn()
    render(<CategoryList selectedParts={{}} onSelectCategory={onSelect} onDeselect={() => {}} />)
    fireEvent.click(screen.getByText('GPU'))
    expect(onSelect).toHaveBeenCalledWith('gpu')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/CategoryList.test.jsx`
Expected: FAIL — `../components/CategoryList` does not exist.

- [ ] **Step 3: Implement the component**

Create `src/components/CategoryList.jsx`:

```jsx
import { CATEGORIES } from '../lib/categories'
import { RECOMMENDED_ORDER, nextRecommended } from '../lib/recommendedOrder'

const ORDERED = RECOMMENDED_ORDER
  .map((id) => CATEGORIES.find((c) => c.id === id))
  .filter(Boolean)

export default function CategoryList({ selectedParts, onSelectCategory, onDeselect }) {
  const next = nextRecommended(selectedParts)

  return (
    <div className="space-y-2">
      {ORDERED.map((cat, i) => {
        const part = selectedParts[cat.id]
        const isNext = cat.id === next

        if (part) {
          return (
            <div key={cat.id} className="flex items-center gap-2 rounded-sm border border-slate-700/70 bg-slate-950/50 px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
              <button onClick={() => onSelectCategory(cat.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <span>{cat.icon}</span>
                <span className="text-sm text-slate-100 truncate">{part.name}</span>
              </button>
              <span className="font-mono text-sm text-cyan-300 shrink-0">£{part.price.toFixed(0)}</span>
              <button onClick={() => onDeselect(cat.id)} aria-label={`Remove ${cat.label}`} className="w-7 h-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-white hover:bg-red-500/80 text-sm shrink-0">&times;</button>
            </div>
          )
        }

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`w-full flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition-all
              ${isNext
                ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/40'
                : 'border-slate-800/60 bg-slate-950/40 text-slate-300'}`}
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-sm bg-slate-800 text-[10px] font-mono text-slate-300 shrink-0">{i + 1}</span>
            <span>{cat.icon}</span>
            <span className="flex-1 text-left">{cat.label}</span>
            {isNext && <span className="text-[11px] text-cyan-300">pick one</span>}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/CategoryList.test.jsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/CategoryList.jsx src/tests/CategoryList.test.jsx
git commit -m "feat: mobile category list (orbit replacement)"
```

---

### Task 3: Decouple panel positioning + responsive build view

This task removes self-positioning from six components **and** restructures the build view in the same commit, so the app stays working (desktop via wrappers, mobile via the column).

**Files:**
- Modify: `src/components/BottleneckIndicator.jsx`, `src/components/PerformancePanel.jsx`, `src/components/BuildWarnings.jsx`, `src/components/UpgradeSuggestion.jsx`, `src/components/CaseToggle.jsx`, `src/components/AutoBuildButton.jsx`
- Modify: `src/screens/BuilderScreen.jsx`

- [ ] **Step 1: Strip positioning from the four PANEL cards**

`src/components/BottleneckIndicator.jsx` — change the container:
```jsx
    <div className={`${PANEL} p-4`}>
```
`src/components/PerformancePanel.jsx`:
```jsx
    <div className={`${PANEL} p-4`}>
```
`src/components/BuildWarnings.jsx`:
```jsx
    <div className={`${PANEL} p-3`}>
```
`src/components/UpgradeSuggestion.jsx`:
```jsx
    <div className={`${PANEL} p-4`}>
```

- [ ] **Step 2: Strip positioning from CaseToggle + AutoBuildButton**

`src/components/CaseToggle.jsx` — the button className becomes (remove `absolute bottom-6 right-6 `):
```jsx
      className="bg-slate-950/30 backdrop-blur-md hover:border-cyan-400/60 text-slate-100 text-sm px-4 py-2 rounded-sm border border-slate-800/60 transition-all flex items-center gap-2"
```

`src/components/AutoBuildButton.jsx` — the button className becomes (remove the absolute positioning, add width):
```jsx
      className="w-full md:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium px-5 py-2 rounded-sm shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-[0_0_22px_rgba(34,211,238,0.6)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
```

- [ ] **Step 3: Add imports + the hook to BuilderScreen**

In `src/screens/BuilderScreen.jsx`, add after the `GamePanel` import:
```js
import CategoryList from '../components/CategoryList'
import { useIsMobile } from '../hooks/useIsMobile'
```

Add inside the component, after the `const [view, setView] = useState('build')` line:
```js
  const isMobile = useIsMobile()
```

- [ ] **Step 4: Shrink the tab buttons for mobile**

Change the tab button className so the four tabs fit a phone:
```jsx
              className={`px-2.5 md:px-4 py-1 text-[11px] md:text-xs font-medium rounded-sm capitalize transition-all
                ${view === v
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                  : 'text-gray-300 hover:text-white'}`}
```

- [ ] **Step 5: Replace the build-view branch**

Find the whole `view === 'build' ? ( … ) : view === 'peripherals' ? (` block opening and replace the build branch. That is, replace:

```jsx
        {view === 'build' ? (
          <div className="relative w-full h-full">
            <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm animate-pulse">Assembling 3D…</div>}>
              <BuildCanvas selectedParts={selectedParts} />
            </Suspense>
            <BottleneckIndicator />
            <PerformancePanel />
            <OrbitRing
              selectedParts={selectedParts}
              onSelectCategory={setActiveCategory}
              onDeselect={removePart}
            />
            <CaseToggle />
            <InfoDisclaimer />
            <UpgradeSuggestion />
            <BuildWarnings />
            <AutoBuildButton />
          </div>
        ) : view === 'peripherals' ? (
```

with:

```jsx
        {view === 'build' ? (
          isMobile ? (
            <div className="flex flex-col h-full overflow-y-auto">
              <div className="relative h-[45vh] shrink-0">
                <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm animate-pulse">Assembling 3D…</div>}>
                  <BuildCanvas selectedParts={selectedParts} />
                </Suspense>
                <div className="absolute bottom-3 right-3"><CaseToggle /></div>
              </div>
              <div className="p-4 space-y-3 pb-12">
                <CategoryList
                  selectedParts={selectedParts}
                  onSelectCategory={setActiveCategory}
                  onDeselect={removePart}
                />
                <BottleneckIndicator />
                <PerformancePanel />
                <BuildWarnings />
                <UpgradeSuggestion />
                <AutoBuildButton />
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full">
              <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm animate-pulse">Assembling 3D…</div>}>
                <BuildCanvas selectedParts={selectedParts} />
              </Suspense>
              <div className="absolute top-4 left-4 w-72"><BottleneckIndicator /></div>
              <div className="absolute top-44 left-4 w-72"><PerformancePanel /></div>
              <OrbitRing
                selectedParts={selectedParts}
                onSelectCategory={setActiveCategory}
                onDeselect={removePart}
              />
              <div className="absolute bottom-6 right-6"><CaseToggle /></div>
              <InfoDisclaimer />
              <div className="absolute bottom-6 left-6 w-80"><UpgradeSuggestion /></div>
              <div className="absolute top-80 left-4 w-72"><BuildWarnings /></div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40"><AutoBuildButton /></div>
            </div>
          )
        ) : view === 'peripherals' ? (
```

- [ ] **Step 6: Run the full suite**

Run: `npm run test:run`
Expected: PASS — 116 tests (111 + 2 useIsMobile + 3 CategoryList). The panel edits change only positioning classes, so existing component tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/BottleneckIndicator.jsx src/components/PerformancePanel.jsx src/components/BuildWarnings.jsx src/components/UpgradeSuggestion.jsx src/components/CaseToggle.jsx src/components/AutoBuildButton.jsx src/screens/BuilderScreen.jsx
git commit -m "feat: responsive build view (mobile hero + category list)"
```

---

### Task 4: Top bar + final verification

**Files:**
- Modify: `src/components/TopBar.jsx`

- [ ] **Step 1: Compact the header + hide the bars on mobile**

In `src/components/TopBar.jsx`, change the `<header>` className:
```jsx
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/30 backdrop-blur-md border-b border-slate-800/60 px-3 md:px-6 py-2 md:py-3 flex flex-wrap md:flex-nowrap items-center gap-x-3 md:gap-8 gap-y-1">
```

Change the bars container (the `<div className="flex gap-6 ml-auto">`) to be desktop-only:
```jsx
      <div className="hidden md:flex gap-6 ml-auto">
```

- [ ] **Step 2: Run the full suite**

Run: `npm run test:run`
Expected: PASS — 116 tests.

- [ ] **Step 3: Verify both layouts in the dev server**

Start the dev server. Use `preview_resize`:
- **Mobile (375×812):** the build view shows the 3D hero (~45vh) with the see-through-case toggle in its corner, then a scrollable column — the tappable category list (filled chips with price + ×, next-recommended highlighted), Bottleneck + Performance cards, and a full-width Auto-build button. The top bar shows budget/remaining/power with **no** progress bars. The four tabs fit. Open the Summary tab → the card + "How it runs" list fit the width. Tap a category → the PartSelector opens full-screen.
- **Desktop (1280×800):** the build view is **unchanged** — orbit, floating panels in their original positions, top bar with both progress bars.

Screenshot both widths for the summary.

- [ ] **Step 4: Commit**

```bash
git add src/components/TopBar.jsx
git commit -m "feat: responsive top bar (hide bars on mobile)"
```

---

## Self-Review

- **Spec coverage:** hook → Task 1; CategoryList → Task 2; decouple panels + responsive build view + tab sizing → Task 3; top bar → Task 4. All spec sections covered.
- **Placeholders:** none — exact classNames, exact code, exact commands.
- **Type/name consistency:** `useIsMobile` (Task 1) imported by BuilderScreen (Task 3); `CategoryList` props `{ selectedParts, onSelectCategory, onDeselect }` (Task 2) match the call site (Task 3) and mirror `OrbitRing`. Desktop wrapper positions (`top-4 left-4 w-72`, `top-44 left-4 w-72`, `top-80 left-4 w-72`, `bottom-6 left-6 w-80`, `bottom-6 right-6`, `bottom-6 left-1/2 -translate-x-1/2 z-40`) exactly match each panel's removed self-position, so desktop is pixel-identical.
- **Working at each commit:** Task 3 strips positioning **and** adds wrappers in one commit, so no commit leaves the desktop layout broken.
- **Test count:** 111 + 2 + 3 = **116** at the end.
