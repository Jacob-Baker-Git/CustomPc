# Chunk C — Bottleneck Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a resolution-aware CPU↔GPU bottleneck calculator that flags imbalance using real-world-seeded performance scores, surfaced as a live indicator.

**Architecture:** A pure `bottleneck.js` computes a resolution-weighted balance between the selected CPU and GPU `perfScore`s. The store holds the target `resolution`. A `ResolutionToggle` sets it and a `BottleneckIndicator` renders the live verdict in the builder.

**Tech Stack:** React, Zustand, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-14-builder-overhaul-design.md`

**Note:** `node`/`npx` are NOT on PATH. In PowerShell prepend: `$env:Path = "C:\Program Files\nodejs;" + $env:Path`. Commit locally; do NOT push/deploy. Depends on Chunk B (`perfScore` on CPUs/GPUs).

---

## File Map

| File | Responsibility |
|---|---|
| `src/lib/bottleneck.js` | Pure resolution-weighted bottleneck calc |
| `src/tests/bottleneck.test.js` | Tests for the calc |
| `src/store/useBuilderStore.js` | `resolution` + `setResolution` |
| `src/components/ResolutionToggle.jsx` | 1080p/1440p/4K selector |
| `src/components/BottleneckIndicator.jsx` | Balance bar + verdict |
| `src/screens/BuilderScreen.jsx` | Render the indicator + toggle |

---

### Task C1: Bottleneck Calc (TDD)

**Files:**
- Create: `src/lib/bottleneck.js`
- Test: `src/tests/bottleneck.test.js`

The model: a higher resolution shifts load toward the GPU. We weight each part's `perfScore` by how much that part matters at the chosen resolution, then measure how far apart the weighted demands are. `limitedBy` names the weaker side; `balancePct` is 100 when matched, lower as they diverge.

- [ ] **Step 1: Write the failing test**

Create `src/tests/bottleneck.test.js`:
```js
import { computeBottleneck } from '../lib/bottleneck'

const strongCpu = { perfScore: 95 }
const weakCpu   = { perfScore: 45 }
const strongGpu = { perfScore: 95 }
const weakGpu   = { perfScore: 45 }

describe('computeBottleneck', () => {
  it('returns null when CPU or GPU is missing', () => {
    expect(computeBottleneck(null, strongGpu, '1080p')).toBeNull()
    expect(computeBottleneck(strongCpu, null, '1080p')).toBeNull()
  })

  it('reports a well-matched pair as balanced (high balancePct, limitedBy none)', () => {
    const r = computeBottleneck(strongCpu, strongGpu, '1440p')
    expect(r.balancePct).toBeGreaterThanOrEqual(90)
    expect(r.limitedBy).toBe('none')
  })

  it('flags the CPU as the limiter when a weak CPU pairs a strong GPU', () => {
    const r = computeBottleneck(weakCpu, strongGpu, '1080p')
    expect(r.limitedBy).toBe('cpu')
    expect(r.balancePct).toBeLessThan(80)
    expect(r.verdict).toMatch(/cpu/i)
  })

  it('flags the GPU as the limiter when a weak GPU pairs a strong CPU', () => {
    const r = computeBottleneck(strongCpu, weakGpu, '4k')
    expect(r.limitedBy).toBe('gpu')
    expect(r.verdict).toMatch(/gpu/i)
  })

  it('mentions the chosen resolution in the verdict', () => {
    const r = computeBottleneck(strongCpu, strongGpu, '4k')
    expect(r.verdict).toMatch(/4k/i)
  })

  it('always returns a balancePct between 0 and 100', () => {
    for (const res of ['1080p', '1440p', '4k']) {
      const r = computeBottleneck(weakCpu, strongGpu, res)
      expect(r.balancePct).toBeGreaterThanOrEqual(0)
      expect(r.balancePct).toBeLessThanOrEqual(100)
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tests/bottleneck.test.js`
Expected: FAIL — "Cannot find module '../lib/bottleneck'"

- [ ] **Step 3: Implement the calc**

Create `src/lib/bottleneck.js`:
```js
// Resolution weights: how much the CPU vs GPU drives performance at each target.
// Lower resolution leans on the CPU; higher leans on the GPU.
const WEIGHTS = {
  '1080p': { cpu: 0.6, gpu: 0.4 },
  '1440p': { cpu: 0.5, gpu: 0.5 },
  '4k':    { cpu: 0.35, gpu: 0.65 },
}

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

export function computeBottleneck(cpu, gpu, resolution) {
  if (!cpu || !gpu) return null

  const w = WEIGHTS[resolution] ?? WEIGHTS['1440p']
  const label = RES_LABEL[resolution] ?? resolution

  const cpuScore = cpu.perfScore ?? 0
  const gpuScore = gpu.perfScore ?? 0

  // The weaker component is the limiter; the gap between the two sets the
  // severity, amplified by how hard this resolution leans on the weaker part.
  const weakerIsCpu = cpuScore < gpuScore
  const weaker = Math.min(cpuScore, gpuScore)
  const stronger = Math.max(cpuScore, gpuScore) || 1
  const gap = 1 - weaker / stronger                  // 0 = identical
  const stress = weakerIsCpu ? w.cpu : w.gpu          // 0.35..0.65
  const severity = Math.min(1, gap * stress * 2)      // stress*2 in 0.7..1.3
  const balancePct = Math.round((1 - severity) * 100)

  let limitedBy = 'none'
  if (balancePct < 85) limitedBy = weakerIsCpu ? 'cpu' : 'gpu'

  let verdict
  if (limitedBy === 'none') {
    verdict = `Well matched for ${label}`
  } else if (limitedBy === 'cpu') {
    verdict = `Your CPU can't keep up with this GPU at ${label} — the GPU is overkill`
  } else {
    verdict = `Your GPU is holding the CPU back at ${label}`
  }

  return { balancePct, limitedBy, verdict }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tests/bottleneck.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run` → all pass.
```bash
git add src/lib/bottleneck.js src/tests/bottleneck.test.js
git commit -m "feat: add resolution-aware bottleneck calculator"
```

---

### Task C2: Resolution State + Toggle

**Files:**
- Modify: `src/store/useBuilderStore.js`
- Create: `src/components/ResolutionToggle.jsx`

- [ ] **Step 1: Add resolution to the store**

In `src/store/useBuilderStore.js`, add to the store object (after `toggleCaseTransparency` from Chunk B):
```js
  resolution: '1440p',
  setResolution: (resolution) => set({ resolution }),
```

- [ ] **Step 2: Create ResolutionToggle**

Create `src/components/ResolutionToggle.jsx`:
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
    <div className="inline-flex rounded-full bg-gray-800 border border-gray-700 p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setResolution(opt.id)}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-all
            ${resolution === opt.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify build + tests + commit**

Run: `npx vite build` → succeeds.
Run: `npx vitest run` → all pass.
```bash
git add src/store/useBuilderStore.js src/components/ResolutionToggle.jsx
git commit -m "feat: add target resolution state and toggle"
```

---

### Task C3: Bottleneck Indicator

**Files:**
- Create: `src/components/BottleneckIndicator.jsx`
- Modify: `src/screens/BuilderScreen.jsx`

- [ ] **Step 1: Create BottleneckIndicator**

Create `src/components/BottleneckIndicator.jsx`:
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
    <div className="absolute top-4 left-4 w-72 bg-gray-900/90 border border-gray-700 rounded-xl p-4 backdrop-blur">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white text-sm font-semibold">Bottleneck</span>
        <ResolutionToggle />
      </div>
      {!result ? (
        <p className="text-gray-500 text-xs">Select a CPU and a GPU to see the balance.</p>
      ) : (
        <>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500
                ${result.balancePct >= 85 ? 'bg-green-500' : result.balancePct >= 70 ? 'bg-amber-400' : 'bg-red-500'}`}
              style={{ width: `${result.balancePct}%` }}
            />
          </div>
          <p className="text-xs text-gray-300">
            <span className="font-semibold text-white">{result.balancePct}% balanced.</span>{' '}
            {result.verdict}
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Render it in BuilderScreen**

In `src/screens/BuilderScreen.jsx`, add the import:
```jsx
import BottleneckIndicator from '../components/BottleneckIndicator'
```
and render it inside the relative builder view, right after `<BuildCanvas ... />`:
```jsx
            <BottleneckIndicator />
```

- [ ] **Step 3: Verify build + tests + commit**

Run: `npx vite build` → succeeds.
Run: `npx vitest run` → all pass.

- [ ] **Step 4: Manual browser check**

Run `npx vite dev`, open the local URL, and verify the full overhaul:
- Budget is click-to-edit in the top bar
- The ring shows all 9 categories with order badges; the recommended-next one glows
- Selecting a part fills its slot with name + price + ✕; clicking ✕ deselects and frees budget
- The selector has a search box; by default incompatible/over-70%-budget parts are hidden; searching reveals them (greyed)
- A GPU now sits visibly above the board (not under the motherboard)
- The case toggle switches between see-through and solid
- Picking a weak CPU + strong GPU shows a CPU-limited verdict; changing resolution changes the verdict
Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add src/components/BottleneckIndicator.jsx src/screens/BuilderScreen.jsx
git commit -m "feat: add live bottleneck indicator with resolution toggle"
```

---

## Self-Review

**Spec coverage (Chunk C):** perfScore-driven calc (C1, scores from Chunk B) ✓; resolution selector 1080p/1440p/4K (C2) ✓; resolution-weighted balance % + limitedBy + verdict (C1) ✓; live indicator in the builder (C3) ✓.

**Type consistency:** `computeBottleneck(cpu, gpu, resolution) → { balancePct, limitedBy, verdict } | null` used identically in the indicator. `resolution`/`setResolution` consistent across store, ResolutionToggle, BottleneckIndicator. Reads `part.perfScore` added in Chunk B.

**Placeholders:** none — full code in every step.

---

## Final Step (all chunks complete)

After Chunks A, B, and C are done and verified, the work is committed locally across all three. **Do not push/deploy** — per project preference, ask the user before pushing to GitHub / Netlify.
