# Phase 3 — Per-Game FPS Targets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show how a build runs real games — a focused target check (Games tab) and a colour-coded multi-game list (Summary tab).

**Architecture:** A curated `gamesData.json` (each game an `fpsFactor`) + a pure `gameFps = round(estimateFps × fpsFactor)`. The Games tab is a target check reusing `suggestUpgrade`; the Summary tab gains a shared `GamePerformanceList`. No new perf engine.

**Tech Stack:** React 19, Zustand, Vite, Tailwind, Vitest + Testing Library (jsdom).

**Conventions for every task:**
- Node at `C:\Program Files\nodejs`. In PowerShell once per shell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`.
- Full suite: `npm run test:run`. Single file: `npm run test:run -- src/tests/<file>`. Baseline **101 passing**.
- Every commit appends: `-m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"`.
- Work on `main` locally; do not push.

---

### Task 1: Games data + gameFps

**Files:**
- Create: `src/data/gamesData.json`
- Create: `src/lib/gameFps.js`
- Create: `src/tests/gameFps.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/gameFps.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { gameFps, FPS_TARGETS } from '../lib/gameFps'
import { estimateFps } from '../lib/fpsEstimate'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4090')

describe('gameFps', () => {
  it('returns 0 without a cpu or gpu', () => {
    expect(gameFps(null, gpu, '1440p', { fpsFactor: 2 })).toBe(0)
    expect(gameFps(cpu, null, '1440p', { fpsFactor: 2 })).toBe(0)
  })

  it('scales the baseline estimate by the game fpsFactor', () => {
    const base = estimateFps(cpu, gpu, '1440p')
    expect(gameFps(cpu, gpu, '1440p', { fpsFactor: 2 })).toBe(Math.round(base * 2))
  })

  it('gives a higher-fpsFactor game more FPS than a lower one', () => {
    expect(gameFps(cpu, gpu, '1440p', { fpsFactor: 2.6 }))
      .toBeGreaterThan(gameFps(cpu, gpu, '1440p', { fpsFactor: 0.5 }))
  })

  it('exposes the standard FPS targets', () => {
    expect(FPS_TARGETS).toEqual([60, 120, 144])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/gameFps.test.js`
Expected: FAIL — `../lib/gameFps` does not exist.

- [ ] **Step 3: Create the data and the function**

Create `src/data/gamesData.json`:

```json
[
  { "id": "lol", "name": "League of Legends", "fpsFactor": 3.0 },
  { "id": "valorant", "name": "Valorant", "fpsFactor": 2.8 },
  { "id": "cs2", "name": "Counter-Strike 2", "fpsFactor": 2.6 },
  { "id": "rocket-league", "name": "Rocket League", "fpsFactor": 2.5 },
  { "id": "fortnite", "name": "Fortnite", "fpsFactor": 1.6 },
  { "id": "apex", "name": "Apex Legends", "fpsFactor": 1.5 },
  { "id": "warzone", "name": "Call of Duty: Warzone", "fpsFactor": 1.1 },
  { "id": "elden-ring", "name": "Elden Ring", "fpsFactor": 0.9 },
  { "id": "bg3", "name": "Baldur's Gate 3", "fpsFactor": 0.85 },
  { "id": "starfield", "name": "Starfield", "fpsFactor": 0.65 },
  { "id": "cyberpunk", "name": "Cyberpunk 2077", "fpsFactor": 0.5 },
  { "id": "alan-wake-2", "name": "Alan Wake 2", "fpsFactor": 0.4 }
]
```

Create `src/lib/gameFps.js`:

```js
import { estimateFps } from './fpsEstimate'

export const FPS_TARGETS = [60, 120, 144]

// Per-game FPS = the generic perfScore estimate scaled by the game's fpsFactor
// (esports > 1, demanding AAA < 1). An estimate, not a benchmark.
export function gameFps(cpu, gpu, resolution, game) {
  if (!cpu || !gpu || !game) return 0
  return Math.round(estimateFps(cpu, gpu, resolution) * (game.fpsFactor ?? 1))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/gameFps.test.js`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/data/gamesData.json src/lib/gameFps.js src/tests/gameFps.test.js
git commit -m "feat: per-game FPS model + curated games data"
```

---

### Task 2: Multi-game list + Summary section

**Files:**
- Create: `src/components/GamePerformanceList.jsx`
- Create: `src/tests/GamePerformanceList.test.jsx`
- Modify: `src/components/BuildSummary.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/GamePerformanceList.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import GamePerformanceList from '../components/GamePerformanceList'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4090')

describe('GamePerformanceList', () => {
  it('renders nothing without a cpu and gpu', () => {
    const { container } = render(<GamePerformanceList cpu={null} gpu={null} resolution="1440p" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists games for a build', () => {
    render(<GamePerformanceList cpu={cpu} gpu={gpu} resolution="1440p" />)
    expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument()
    expect(screen.getByText('Cyberpunk 2077')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/GamePerformanceList.test.jsx`
Expected: FAIL — `../components/GamePerformanceList` does not exist.

- [ ] **Step 3: Implement the list**

Create `src/components/GamePerformanceList.jsx`:

```jsx
import gamesData from '../data/gamesData.json'
import { gameFps } from '../lib/gameFps'

function dotColor(fps) {
  return fps >= 60 ? 'bg-green-500' : fps >= 30 ? 'bg-amber-400' : 'bg-red-500'
}

export default function GamePerformanceList({ cpu, gpu, resolution }) {
  if (!cpu || !gpu) return null
  const rows = gamesData
    .map((game) => ({ game, fps: gameFps(cpu, gpu, resolution, game) }))
    .sort((a, b) => b.fps - a.fps)

  return (
    <div>
      {rows.map(({ game, fps }) => (
        <div key={game.id} className="flex items-center py-1.5 border-t border-slate-800/50">
          <span className={`w-2 h-2 rounded-full mr-2.5 shrink-0 ${dotColor(fps)}`} />
          <span className="flex-1 text-sm text-slate-100">{game.name}</span>
          <span className="font-mono text-sm text-slate-300">{fps}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/GamePerformanceList.test.jsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Add the "How it runs" section to BuildSummary**

In `src/components/BuildSummary.jsx`:

Add after the `PANEL` import:
```js
import GamePerformanceList from './GamePerformanceList'
```

Add this constant just below the existing `PERIPHERAL_ORDER` constant (top of file):
```js
const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }
```

Add a `resolution` selector next to the other store reads (after the `const power = useBuilderStore(selTotalPower)` line):
```js
  const resolution = useBuilderStore((s) => s.resolution)
```

Insert the section right after the totals bar — find:
```jsx
                <span>Total <span className="font-mono text-slate-100">£{grandTotal.toFixed(2)}</span></span>
              </div>
            </>
          )}
```
and replace it with:
```jsx
                <span>Total <span className="font-mono text-slate-100">£{grandTotal.toFixed(2)}</span></span>
              </div>

              {selectedParts.cpu && selectedParts.gpu && (
                <div className="mt-5">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">How it runs @ {RES_LABEL[resolution] ?? resolution}</div>
                  <GamePerformanceList cpu={selectedParts.cpu} gpu={selectedParts.gpu} resolution={resolution} />
                </div>
              )}
            </>
          )}
```

- [ ] **Step 6: Run the full suite**

Run: `npm run test:run`
Expected: PASS — 107 tests (101 baseline + 4 from Task 1 + 2 from this task). Confirm the existing `BuildSummary` tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/GamePerformanceList.jsx src/tests/GamePerformanceList.test.jsx src/components/BuildSummary.jsx
git commit -m "feat: 'how it runs' multi-game list in the summary"
```

---

### Task 3: Games tab (target check) + wiring

**Files:**
- Create: `src/components/GamePanel.jsx`
- Create: `src/tests/GamePanel.test.jsx`
- Modify: `src/screens/BuilderScreen.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/GamePanel.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import GamePanel from '../components/GamePanel'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4090')

beforeEach(() => {
  useBuilderStore.setState({ budget: 2000, selectedParts: {}, selectedPeripherals: {}, resolution: '1440p' })
})

describe('GamePanel', () => {
  it('shows the empty state without a cpu and gpu', () => {
    render(<GamePanel />)
    expect(screen.getByText(/select a cpu and a gpu/i)).toBeInTheDocument()
  })

  it('shows an FPS estimate and a target verdict for a build', () => {
    useBuilderStore.setState({ selectedParts: { cpu, gpu } })
    render(<GamePanel />)
    expect(screen.getByText(/est\. FPS @/i)).toBeInTheDocument()
    // default game (League of Legends, fpsFactor 3.0) easily clears the default 60 target
    expect(screen.getByText(/clears 60/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/tests/GamePanel.test.jsx`
Expected: FAIL — `../components/GamePanel` does not exist.

- [ ] **Step 3: Implement the Games tab**

Create `src/components/GamePanel.jsx`:

```jsx
import { useState } from 'react'
import useBuilderStore from '../store/useBuilderStore'
import { gameFps, FPS_TARGETS } from '../lib/gameFps'
import { suggestUpgrade } from '../lib/upgradeAdvisor'
import gamesData from '../data/gamesData.json'
import partsData from '../data/partsData.json'
import ResolutionToggle from './ResolutionToggle'
import { PANEL } from '../lib/uiTokens'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

export default function GamePanel() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const resolution = useBuilderStore((s) => s.resolution)
  const budget = useBuilderStore((s) => s.budget)
  const cpu = selectedParts.cpu
  const gpu = selectedParts.gpu

  const [gameId, setGameId] = useState(gamesData[0].id)
  const [target, setTarget] = useState(60)

  const game = gamesData.find((g) => g.id === gameId) ?? gamesData[0]
  const resLabel = RES_LABEL[resolution] ?? resolution
  const fps = gameFps(cpu, gpu, resolution, game)
  const hits = fps >= target
  const upg = cpu && gpu && !hits ? suggestUpgrade(selectedParts, budget, partsData, resolution) : null
  const upgraded = upg ? { ...selectedParts, [upg.category]: upg.toPart } : null
  const upgFps = upgraded ? gameFps(upgraded.cpu, upgraded.gpu, resolution, game) : 0

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-12">
        <div className={`${PANEL} p-5`}>
          {!cpu || !gpu ? (
            <p className="text-sm text-slate-400 py-6 text-center">Select a CPU and a GPU to check game performance.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <select
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  className="bg-slate-950/60 border border-slate-700/70 rounded-sm text-sm text-slate-100 px-3 py-2 focus:outline-none focus:border-cyan-400"
                >
                  {gamesData.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <span className="text-xs text-slate-500">target</span>
                <div className="inline-flex rounded-sm bg-slate-950/30 border border-slate-800/60 p-0.5">
                  {FPS_TARGETS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTarget(t)}
                      className={`px-3 py-1 text-xs font-mono rounded-sm transition-all ${target === t ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white' : 'text-gray-300 hover:text-white'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <ResolutionToggle />
              </div>

              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-mono text-4xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">{fps}</span>
                <span className="text-sm text-slate-400">est. FPS @ {resLabel}</span>
                <span className={`text-xs px-2 py-0.5 rounded-sm border ${hits ? 'text-emerald-300 border-emerald-400/40' : 'text-red-400 border-red-400/40'}`}>
                  {hits ? `clears ${target}` : `misses ${target}`}
                </span>
              </div>

              {!hits && (
                <div className="mt-4 text-xs text-slate-300 bg-cyan-500/[0.06] border border-cyan-400/20 rounded-sm p-3">
                  {upg ? (
                    <>Upgrade <span className="uppercase">{upg.category}</span> → <span className="text-cyan-300">{upg.toPart.name}</span>{' '}
                      <span className="font-mono text-emerald-300">+£{upg.extraCost.toFixed(0)}</span> → ~<span className="font-mono text-cyan-300">{upgFps}</span> FPS{' '}
                      {upgFps >= target ? `(clears ${target})` : `(still under ${target})`}</>
                  ) : (
                    <>No affordable upgrade reaches {target} FPS at this budget.</>
                  )}
                </div>
              )}

              <p className="mt-4 text-[10px] text-slate-600">Estimated from CPU + GPU performance — not a benchmark.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/GamePanel.test.jsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Add the Games tab to the builder**

In `src/screens/BuilderScreen.jsx`:

Add after the `AutoBuildButton` import:
```js
import GamePanel from '../components/GamePanel'
```

Add `summary`'s sibling `games` to the view toggle:
```jsx
          {['build', 'peripherals', 'summary', 'games'].map((v) => (
```

Replace the summary tail of the view ternary — find:
```jsx
        ) : view === 'peripherals' ? (
          <PeripheralsPanel />
        ) : (
          <BuildSummary />
        )}
```
and replace it with:
```jsx
        ) : view === 'peripherals' ? (
          <PeripheralsPanel />
        ) : view === 'summary' ? (
          <BuildSummary />
        ) : (
          <GamePanel />
        )}
```

- [ ] **Step 6: Run the full suite**

Run: `npm run test:run`
Expected: PASS — 109 tests.

- [ ] **Step 7: Verify in the dev server**

Start the dev server and check:
- Auto-build a build (or pick a CPU+GPU). Open the **Games** tab → a game dropdown, target chips (60/120/144), resolution toggle, a big mono FPS number, and a `clears/misses` verdict. Switch games (Cyberpunk vs CS2) → FPS changes sensibly; switch target to 144 on a demanding game → a "misses 144" verdict with an upgrade hint (or "no affordable upgrade").
- Open the **Summary** tab → a "How it runs @ {res}" list of all games with colour-coded FPS, sorted high→low.
- Empty state: clear the build → Games tab shows "Select a CPU and a GPU".

- [ ] **Step 8: Commit**

```bash
git add src/components/GamePanel.jsx src/tests/GamePanel.test.jsx src/screens/BuilderScreen.jsx
git commit -m "feat: Games tab with per-game FPS target check"
```

---

## Self-Review

- **Spec coverage:** model + data → Task 1; multi-game list + Summary section → Task 2; Games tab target check + upgrade hint + tab wiring → Task 3. All spec features covered.
- **Placeholders:** none — every step has exact code and commands.
- **Type/name consistency:** `gameFps(cpu, gpu, resolution, game)` + `FPS_TARGETS` (Task 1) are used by `GamePerformanceList` (Task 2) and `GamePanel` (Task 3); games carry `{ id, name, fpsFactor }` throughout; `suggestUpgrade` returns `{ category, toPart, extraCost, ... }` (verified in `upgradeAdvisor.js`) as consumed by GamePanel. Default game `gamesData[0]` = League of Legends (fpsFactor 3.0) → clears the default 60 target in the GamePanel test.
- **Test count:** 101 baseline + 4 (gameFps) + 2 (GamePerformanceList) + 2 (GamePanel) = **109** at the end. (Task 2 Step 6 reads 107 mid-stream after Tasks 1–2; final is 109.)
