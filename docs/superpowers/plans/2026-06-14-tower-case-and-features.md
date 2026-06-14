# Tower Case Realism + No-Cost Feature Batch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 3D build read as a real tower (tall, glass side window in solid mode, motherboard mounted on a panel), then add four no-cost insight features (FPS estimate, value-per-pound, Upgrade My PC, peripherals tab) on the existing static catalog.

**Architecture:** Chunks H→I→J→K, each leaving the app working and committed locally. 3D changes (H) are verified visually on the dev server; pure logic (I/J/K) is built test-first with Vitest. New pure helpers live in `src/lib/`, new UI in `src/components/`, peripherals data in `src/data/`.

**Tech Stack:** React 19 + Vite, Tailwind, Zustand, React Three Fiber + drei, Vitest.

---

## Environment note (run once per shell)

Node is not on PATH in PowerShell. Before any `npx`/`npm`:

```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
```

- Run all tests: `npx vitest run`
- Run one test file: `npx vitest run src/tests/<file>`
- Production build (catches JSX/import errors): `npx vite build`
- Dev server for visual checks: use the preview tooling (launch config `custompc-dev`, http://localhost:5173).

Commit locally as you go. **Do not push or deploy** (auto-deploys the live site) unless explicitly asked.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/models/CaseModel.jsx` | (modify) Panelized tower: 5 metal panels + 1 glass window in solid mode; faint frame in open mode |
| `src/lib/assemblyLayout.js` | (modify) `case` transform recenters the tower around the build so the board hugs the rear panel |
| `src/components/BuildCanvas.jsx` | (modify) Camera/lighting framing for the upright tower |
| `src/lib/fpsEstimate.js` | (new) Pure `estimateFps(cpu, gpu, resolution)` |
| `src/lib/valueScore.js` | (new) Pure `valuePerPound(part)` + `buildValuePerPound(cpu, gpu, totalPrice)` |
| `src/lib/upgradeAdvisor.js` | (new) Pure `suggestUpgrade(selectedParts, budget, catalog, resolution)` |
| `src/components/PerformancePanel.jsx` | (new) Glass panel: estimated FPS at current resolution + build value |
| `src/components/UpgradeSuggestion.jsx` | (new) Glass card: best affordable compatible swap |
| `src/data/peripheralsData.json` | (new) Static monitor/keyboard/mouse/headset catalog |
| `src/components/PeripheralsPanel.jsx` | (new) Peripherals tab view + subtotal |
| `src/store/useBuilderStore.js` | (modify) Peripherals slice + `selPeripheralsTotal` |
| `src/screens/BuilderScreen.jsx` | (modify) Mount Performance panel, Upgrade card, Build/Peripherals tab |
| `src/components/PartCard.jsx` | (modify, optional) Value badge on CPU/GPU |
| `src/tests/*` | (new) Tests for fpsEstimate, valueScore, upgradeAdvisor, peripherals store |

---

# CHUNK H — Tower Case + Glass Window + Mounted Motherboard

3D appearance can't be unit-tested (no WebGL in jsdom). For H, the gate is: **existing `npx vitest run` stays green**, `npx vite build` succeeds, and a dev-server screenshot confirms the look. Coordinate convention (unchanged from current code): motherboard PCB vertical at the origin, components facing **+Z** (toward the camera). The camera sits at +Z/+X and looks through the +Z face — so the **+Z face is the glass window**, the **−Z face is the motherboard tray (rear) wall**.

---

### Task H1: Panelized tower CaseModel

**Files:**
- Modify: `src/components/models/CaseModel.jsx`

- [ ] **Step 1: Replace CaseModel with a panelized tower**

Replace the entire file with:

```jsx
import useBuilderStore from '../../store/useBuilderStore'

// Tower proportions: taller than wide (reads as a tower, not a cube).
const W = 3.0   // width  (X)
const H = 4.4   // height (Y)
const D = 2.6   // depth  (Z)
const T = 0.06  // panel thickness

function Panel({ args, position, color, opacity = 1, glass = false }) {
  return (
    <mesh position={position}>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        metalness={glass ? 0.1 : 0.6}
        roughness={glass ? 0.08 : 0.55}
        side={2}
      />
    </mesh>
  )
}

export default function CaseModel() {
  const transparent = useBuilderStore((s) => s.caseTransparent)

  // Open mode: panels removed — faint frame only, so parts are fully visible.
  if (transparent) {
    return (
      <mesh>
        <boxGeometry args={[W, H, D]} />
        <meshBasicMaterial color="#3a567d" wireframe transparent opacity={0.5} />
      </mesh>
    )
  }

  // Solid mode: 5 opaque metal panels + 1 tinted tempered-glass front window.
  return (
    <group>
      <Panel args={[W, T, D]} position={[0, -H / 2, 0]} color="#23272e" />  {/* bottom */}
      <Panel args={[W, T, D]} position={[0,  H / 2, 0]} color="#23272e" />  {/* top */}
      <Panel args={[T, H, D]} position={[ W / 2, 0, 0]} color="#2b2f36" />  {/* right side */}
      <Panel args={[T, H, D]} position={[-W / 2, 0, 0]} color="#2b2f36" />  {/* left side */}
      <Panel args={[W, H, T]} position={[0, 0, -D / 2]} color="#1f2227" />  {/* rear / mobo tray */}
      {/* tempered-glass front window — the build is visible through it */}
      <Panel args={[W, H, T]} position={[0, 0, D / 2]} color="#7fa8d0" opacity={0.16} glass />
    </group>
  )
}
```

- [ ] **Step 2: Confirm the suite still passes**

Run: `npx vitest run`
Expected: all existing tests PASS (CaseModel has no unit test; nothing should break).

- [ ] **Step 3: Confirm it builds**

Run: `npx vite build`
Expected: build succeeds, no errors.

- [ ] **Step 4: Visual check on the dev server**

Start the dev server (preview tooling), then with a build that has a case selected:
- In **solid** mode you should see opaque metal panels with the interior visible through the smoky glass front.
- Toggle to **open** mode (the See-through/Solid button) → faint wireframe frame, parts fully visible.

Take a screenshot in each mode. The case should look like a box-with-a-window now (positioning is fixed in H2).

- [ ] **Step 5: Commit**

```powershell
git add src/components/models/CaseModel.jsx
git commit -m @'
feat(3d): panelized tower case with tempered-glass window in solid mode

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

### Task H2: Recenter the case around the build + frame the camera

The case box is centered at its own local origin, so positioning the case group decides where the walls fall. We want the rear (−Z) wall just behind the board (board at z≈0) and the glass front (+Z) clear of the front fans (z≈1.35). With depth D=2.6, a case-group center near `z=+0.9` puts the rear wall at `z≈-0.4` (board mounted 0.4 in front of it) and the glass at `z≈+2.2` (fans ~0.85 inside). Center `y≈-0.1` gives even headroom above/below the build.

**Files:**
- Modify: `src/lib/assemblyLayout.js` (the `case` entry in `MOUNTED`)
- Modify: `src/components/BuildCanvas.jsx` (camera)

- [ ] **Step 1: Recenter the case group**

In `src/lib/assemblyLayout.js`, change the `case` line inside `MOUNTED` from:

```js
  case:        { position: [0, 0, 0],        rotation: [0, 0, 0] },
```

to:

```js
  // Tower shell recentered so the rear wall hugs the board and the glass
  // front clears the intake fans; build sits with even headroom.
  case:        { position: [0, -0.1, 0.9],   rotation: [0, 0, 0] },
```

- [ ] **Step 2: Frame the camera for the upright tower**

In `src/components/BuildCanvas.jsx`, change the camera and add an OrbitControls target so the tall tower is centered. Replace:

```jsx
      <Canvas camera={{ position: [3.2, 1.6, 5.2], fov: 48 }}>
```

with:

```jsx
      <Canvas camera={{ position: [2.6, 0.8, 7.0], fov: 46 }}>
```

and change the OrbitControls line:

```jsx
        <OrbitControls enablePan={false} enableZoom dampingFactor={0.05} enableDamping />
```

to:

```jsx
        <OrbitControls target={[0, -0.1, 0.4]} enablePan={false} enableZoom dampingFactor={0.05} enableDamping />
```

- [ ] **Step 3: Confirm tests + build**

Run: `npx vitest run`
Expected: PASS (assemblyLayout tests don't assert the `case` position).

Run: `npx vite build`
Expected: success.

- [ ] **Step 4: Visual check + live tuning**

On the dev server with a full build selected: the motherboard should read as mounted flat against the rear interior wall (not floating mid-air), the whole build centered inside a clearly **tall** tower, viewed through the glass front. If anything pokes through a wall or there's too much dead space, nudge the `case` position numbers (`y`, `z`) and the camera `position`/`target` until it's framed cleanly. Screenshot solid + open modes.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/assemblyLayout.js src/components/BuildCanvas.jsx
git commit -m @'
feat(3d): mount board on rear panel, recenter tower, frame camera

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

# CHUNK I — Performance Insights (FPS + Value)

---

### Task I1: `estimateFps` helper (TDD)

**Files:**
- Create: `src/lib/fpsEstimate.js`
- Test: `src/tests/fpsEstimate.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/fpsEstimate.test.js`:

```js
import { estimateFps } from '../lib/fpsEstimate'

const strong = { perfScore: 100 }
const mid    = { perfScore: 60 }
const weakCpu = { perfScore: 40 }

describe('estimateFps', () => {
  it('returns 0 when CPU or GPU is missing', () => {
    expect(estimateFps(null, strong, '1440p')).toBe(0)
    expect(estimateFps(strong, null, '1440p')).toBe(0)
  })

  it('lands a top pair in believable ranges per resolution', () => {
    expect(estimateFps(strong, strong, '1080p')).toBe(200)
    expect(estimateFps(strong, strong, '1440p')).toBe(150)
    expect(estimateFps(strong, strong, '4k')).toBe(95)
  })

  it('drops as resolution rises for a balanced pair', () => {
    const a = estimateFps(strong, strong, '1080p')
    const b = estimateFps(strong, strong, '1440p')
    const c = estimateFps(strong, strong, '4k')
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
  })

  it('rises with GPU power at a fixed resolution', () => {
    expect(estimateFps(strong, strong, '1440p'))
      .toBeGreaterThan(estimateFps(strong, mid, '1440p'))
  })

  it('lets a weak CPU cap FPS at low resolution', () => {
    // weak CPU (40) ceiling at 1080p = 40 * 2.4 = 96, below the GPU's 200
    expect(estimateFps(weakCpu, strong, '1080p')).toBe(96)
  })

  it('normalizes resolution casing and unknown values', () => {
    expect(estimateFps(strong, strong, '4K')).toBe(95)
    expect(estimateFps(strong, strong, 'banana')).toBe(150) // falls back to 1440p
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/tests/fpsEstimate.test.js`
Expected: FAIL ("estimateFps is not a function" / cannot find module).

- [ ] **Step 3: Implement the helper**

Create `src/lib/fpsEstimate.js`:

```js
// Transparent FPS heuristic on the 0–100 perfScore scale. FPS is GPU-bound at
// higher resolutions; a weak CPU sets a frame ceiling that bites hardest at low
// resolution (mirrors the bottleneck model). Clearly an estimate, not a benchmark.
const RES_GPU = { '1080p': 2.0, '1440p': 1.5, '4k': 0.95 } // fps per GPU perf point
const RES_CPU = { '1080p': 2.4, '1440p': 2.2, '4k': 2.0 }  // CPU frame-ceiling factor

export function estimateFps(cpu, gpu, resolution) {
  if (!cpu || !gpu) return 0
  const res = String(resolution ?? '1440p').toLowerCase()
  const gpuFactor = RES_GPU[res] ?? RES_GPU['1440p']
  const cpuFactor = RES_CPU[res] ?? RES_CPU['1440p']
  const gpuFps = (gpu.perfScore ?? 0) * gpuFactor
  const cpuCeil = (cpu.perfScore ?? 0) * cpuFactor
  return Math.round(Math.min(gpuFps, cpuCeil))
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run src/tests/fpsEstimate.test.js`
Expected: PASS (all 6).

- [ ] **Step 5: Commit**

```powershell
git add src/lib/fpsEstimate.js src/tests/fpsEstimate.test.js
git commit -m @'
feat: estimateFps heuristic with tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

### Task I2: `valueScore` helpers (TDD)

**Files:**
- Create: `src/lib/valueScore.js`
- Test: `src/tests/valueScore.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/valueScore.test.js`:

```js
import { valuePerPound, buildValuePerPound } from '../lib/valueScore'

describe('valuePerPound', () => {
  it('returns 0 for missing part, price, or perfScore', () => {
    expect(valuePerPound(null)).toBe(0)
    expect(valuePerPound({ perfScore: 50 })).toBe(0)
    expect(valuePerPound({ price: 100 })).toBe(0)
  })

  it('is perfScore per £100', () => {
    expect(valuePerPound({ perfScore: 80, price: 200 })).toBeCloseTo(40)
  })

  it('rises as perfScore rises and falls as price rises', () => {
    const cheap = valuePerPound({ perfScore: 80, price: 200 })
    const dearer = valuePerPound({ perfScore: 80, price: 400 })
    const faster = valuePerPound({ perfScore: 90, price: 200 })
    expect(faster).toBeGreaterThan(cheap)
    expect(cheap).toBeGreaterThan(dearer)
  })
})

describe('buildValuePerPound', () => {
  const cpu = { perfScore: 100 }
  const gpu = { perfScore: 100 }

  it('returns 0 when a part or total is missing', () => {
    expect(buildValuePerPound(null, gpu, 1000)).toBe(0)
    expect(buildValuePerPound(cpu, gpu, 0)).toBe(0)
  })

  it('is estimated 1440p FPS per £100 of build cost', () => {
    // estimateFps(100,100,'1440p') === 150; 150 / (1500/100) = 10
    expect(buildValuePerPound(cpu, gpu, 1500)).toBeCloseTo(10)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/tests/valueScore.test.js`
Expected: FAIL (module/exports not found).

- [ ] **Step 3: Implement the helpers**

Create `src/lib/valueScore.js`:

```js
import { estimateFps } from './fpsEstimate'

// Performance points per £100 spent — higher is better value.
export function valuePerPound(part) {
  if (!part || !part.price || !part.perfScore) return 0
  return part.perfScore / (part.price / 100)
}

// Build-level value: estimated 1440p FPS per £100 of total build cost.
export function buildValuePerPound(cpu, gpu, totalPrice) {
  if (!cpu || !gpu || !totalPrice) return 0
  return estimateFps(cpu, gpu, '1440p') / (totalPrice / 100)
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run src/tests/valueScore.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/valueScore.js src/tests/valueScore.test.js
git commit -m @'
feat: value-per-pound helpers with tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

### Task I3: Performance panel UI

**Files:**
- Create: `src/components/PerformancePanel.jsx`
- Modify: `src/screens/BuilderScreen.jsx`

- [ ] **Step 1: Create the panel**

Create `src/components/PerformancePanel.jsx`:

```jsx
import useBuilderStore, { selTotalSpent } from '../store/useBuilderStore'
import { estimateFps } from '../lib/fpsEstimate'
import { buildValuePerPound } from '../lib/valueScore'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

export default function PerformancePanel() {
  const cpu        = useBuilderStore((s) => s.selectedParts.cpu)
  const gpu        = useBuilderStore((s) => s.selectedParts.gpu)
  const resolution = useBuilderStore((s) => s.resolution)
  const totalSpent = useBuilderStore(selTotalSpent)

  if (!cpu || !gpu) return null

  const fps   = estimateFps(cpu, gpu, resolution)
  const value = buildValuePerPound(cpu, gpu, totalSpent)
  const resLabel = RES_LABEL[resolution] ?? resolution

  return (
    <div className="absolute top-44 left-4 w-72 bg-gray-900/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
      <span className="text-white text-sm font-semibold tracking-wide">Performance</span>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-3xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">{fps}</span>
        <span className="text-gray-400 text-xs mb-1">est. avg FPS @ {resLabel}</span>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Value: <span className="text-cyan-300 font-semibold">{value.toFixed(1)}</span> FPS per £100
      </p>
      <p className="mt-1 text-[10px] text-gray-600">Estimated from CPU + GPU performance — not a benchmark.</p>
    </div>
  )
}
```

(Position `top-44` stacks it below the `BottleneckIndicator` at `top-4`. Adjust live if they overlap.)

- [ ] **Step 2: Mount it in BuilderScreen**

In `src/screens/BuilderScreen.jsx`, add the import near the other component imports:

```jsx
import PerformancePanel from '../components/PerformancePanel'
```

Then add `<PerformancePanel />` inside the relative container, right after `<BottleneckIndicator />`:

```jsx
          <BottleneckIndicator />
          <PerformancePanel />
```

- [ ] **Step 3: Confirm tests + build**

Run: `npx vitest run`
Expected: PASS (no tests broken).

Run: `npx vite build`
Expected: success.

- [ ] **Step 4: Visual check**

Dev server: with a CPU + GPU selected, the Performance panel shows an FPS number that changes when you switch the resolution toggle (in the Bottleneck card) and a value figure. Screenshot it.

- [ ] **Step 5: Commit**

```powershell
git add src/components/PerformancePanel.jsx src/screens/BuilderScreen.jsx
git commit -m @'
feat(ui): performance panel with estimated FPS and build value

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

### Task I4 (optional): Value badge on CPU/GPU cards

Small enhancement; skip if time-boxed.

**Files:**
- Modify: `src/components/PartCard.jsx`

- [ ] **Step 1: Add the badge**

In `src/components/PartCard.jsx`, add the import at the top:

```jsx
import { valuePerPound } from '../lib/valueScore'
```

Inside the spec `div` (after the existing spec lines, before its closing `</div>`), add:

```jsx
        {part.perfScore > 0 && (
          <div className="text-cyan-300/80">{valuePerPound(part).toFixed(1)} perf/£100</div>
        )}
```

- [ ] **Step 2: Confirm tests + build**

Run: `npx vitest run src/tests/PartCard.test.jsx`
Expected: PASS (badge is additive; if an assertion breaks, adjust the test to match).

Run: `npx vite build`
Expected: success.

- [ ] **Step 3: Commit**

```powershell
git add src/components/PartCard.jsx
git commit -m @'
feat(ui): value-per-pound badge on parts with a perfScore

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

# CHUNK J — Upgrade My PC

---

### Task J1: `suggestUpgrade` helper (TDD)

**Files:**
- Create: `src/lib/upgradeAdvisor.js`
- Test: `src/tests/upgradeAdvisor.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/upgradeAdvisor.test.js`:

```js
import { suggestUpgrade } from '../lib/upgradeAdvisor'

// Synthetic catalog for deterministic assertions.
const catalog = [
  { id: 'cpu-am5-mid',  category: 'cpu', socket: 'AM5', price: 200, perfScore: 70 },
  { id: 'cpu-am5-top',  category: 'cpu', socket: 'AM5', price: 400, perfScore: 95 },
  { id: 'cpu-intel',    category: 'cpu', socket: 'LGA1700', price: 250, perfScore: 99 },
  { id: 'gpu-mid',      category: 'gpu', price: 400, perfScore: 60, length: 300 },
  { id: 'gpu-top',      category: 'gpu', price: 700, perfScore: 90, length: 320 },
  { id: 'gpu-huge',     category: 'gpu', price: 900, perfScore: 100, length: 400 },
]

const mb = { id: 'mb', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', formFactor: 'ATX' }
const caseSmall = { id: 'case', category: 'case', maxGpuLength: 330, supportedFormFactors: ['ATX'] }

function build(extra = {}) {
  return {
    motherboard: mb,
    case: caseSmall,
    cpu: catalog.find((p) => p.id === 'cpu-am5-mid'),
    gpu: catalog.find((p) => p.id === 'gpu-mid'),
    ...extra,
  }
}

describe('suggestUpgrade', () => {
  it('returns null without a CPU and GPU', () => {
    expect(suggestUpgrade({ cpu: catalog[0] }, 2000, catalog)).toBeNull()
  })

  it('suggests an affordable, compatible, higher-FPS swap', () => {
    const s = suggestUpgrade(build(), 2000, catalog, '1440p')
    expect(s).not.toBeNull()
    expect(s.toPart.perfScore).toBeGreaterThan(s.fromPart.perfScore)
    expect(s.fpsGain).toBeGreaterThan(0)
  })

  it('never suggests an incompatible CPU (wrong socket)', () => {
    // Only the Intel CPU is a higher score than nothing, but socket mismatches AM5 board.
    const parts = build({ cpu: catalog.find((p) => p.id === 'cpu-am5-top') }) // CPU already strong
    const s = suggestUpgrade(parts, 2000, catalog, '1440p')
    if (s) expect(s.category).not.toBe('cpu') // Intel upgrade must be filtered by socket
  })

  it('never suggests a GPU longer than the case clearance', () => {
    const s = suggestUpgrade(build(), 5000, catalog, '1440p')
    if (s && s.category === 'gpu') expect(s.toPart.length).toBeLessThanOrEqual(caseSmall.maxGpuLength)
  })

  it('returns null when nothing is affordable', () => {
    // remaining budget tiny: total spent = 200+400 = 600; budget 610 → £10 headroom
    expect(suggestUpgrade(build(), 610, catalog, '1440p')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/tests/upgradeAdvisor.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the advisor**

Create `src/lib/upgradeAdvisor.js`:

```js
import { estimateFps } from './fpsEstimate'
import { checkCompatibility } from './compatibility'

// Only CPU/GPU swaps move the FPS needle, so those are the upgrade candidates.
const UPGRADEABLE = ['gpu', 'cpu']

export function suggestUpgrade(selectedParts, budget, catalog, resolution = '1440p') {
  const cpu = selectedParts.cpu
  const gpu = selectedParts.gpu
  if (!cpu || !gpu) return null

  const totalSpent = Object.values(selectedParts).reduce((sum, p) => sum + (p?.price ?? 0), 0)
  const remaining = budget - totalSpent
  const baseFps = estimateFps(cpu, gpu, resolution)

  let best = null
  for (const category of UPGRADEABLE) {
    const current = selectedParts[category]
    if (!current) continue

    for (const cand of catalog) {
      if (cand.category !== category) continue
      if ((cand.perfScore ?? 0) <= (current.perfScore ?? 0)) continue

      const extraCost = cand.price - current.price
      if (extraCost > remaining) continue

      const { compatible } = checkCompatibility(selectedParts, cand)
      if (!compatible) continue

      const nextParts = { ...selectedParts, [category]: cand }
      const fpsGain = estimateFps(nextParts.cpu, nextParts.gpu, resolution) - baseFps
      if (fpsGain <= 0) continue

      const better =
        !best ||
        fpsGain > best.fpsGain ||
        (fpsGain === best.fpsGain && extraCost < best.extraCost)
      if (better) best = { category, fromPart: current, toPart: cand, fpsGain, extraCost }
    }
  }
  return best
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run src/tests/upgradeAdvisor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/upgradeAdvisor.js src/tests/upgradeAdvisor.test.js
git commit -m @'
feat: upgrade advisor picks best affordable compatible swap, with tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

### Task J2: Upgrade suggestion card

**Files:**
- Create: `src/components/UpgradeSuggestion.jsx`
- Modify: `src/screens/BuilderScreen.jsx`

- [ ] **Step 1: Create the card**

Create `src/components/UpgradeSuggestion.jsx`:

```jsx
import useBuilderStore from '../store/useBuilderStore'
import { suggestUpgrade } from '../lib/upgradeAdvisor'
import partsData from '../data/partsData.json'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

export default function UpgradeSuggestion() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const budget        = useBuilderStore((s) => s.budget)
  const resolution    = useBuilderStore((s) => s.resolution)
  const addPart       = useBuilderStore((s) => s.addPart)

  const s = suggestUpgrade(selectedParts, budget, partsData, resolution)
  if (!s) return null

  const resLabel = RES_LABEL[resolution] ?? resolution
  const cost = s.extraCost <= 0 ? 'no extra cost' : `+£${s.extraCost.toFixed(0)}`

  return (
    <div className="absolute bottom-6 left-6 w-80 bg-gray-900/70 backdrop-blur-xl border border-cyan-400/30 rounded-2xl p-4 shadow-[0_0_25px_rgba(34,211,238,0.25)]">
      <div className="flex items-center gap-2 mb-1">
        <span>⚡</span>
        <span className="text-white text-sm font-semibold">Upgrade suggestion</span>
      </div>
      <p className="text-xs text-gray-300">
        Swap your <span className="capitalize">{s.category}</span> →{' '}
        <span className="text-cyan-300 font-semibold">{s.toPart.name}</span> for{' '}
        <span className="text-emerald-300 font-semibold">+{s.fpsGain} FPS</span> at {resLabel} ({cost}).
      </p>
      <button
        onClick={() => addPart(s.category, s.toPart)}
        className="mt-3 w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium py-1.5 rounded-full hover:shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-all"
      >
        Apply upgrade
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Mount it in BuilderScreen**

In `src/screens/BuilderScreen.jsx`, add the import:

```jsx
import UpgradeSuggestion from '../components/UpgradeSuggestion'
```

and render it inside the relative container after `<CaseToggle />`:

```jsx
          <CaseToggle />
          <UpgradeSuggestion />
```

- [ ] **Step 3: Confirm tests + build**

Run: `npx vitest run`
Expected: PASS.

Run: `npx vite build`
Expected: success.

- [ ] **Step 4: Visual check**

Dev server: select a budget with headroom and a mid CPU/GPU → the card suggests a swap; clicking **Apply upgrade** replaces the part and the FPS in the Performance panel jumps. With a maxed/over-budget build the card disappears. Screenshot it.

- [ ] **Step 5: Commit**

```powershell
git add src/components/UpgradeSuggestion.jsx src/screens/BuilderScreen.jsx
git commit -m @'
feat(ui): Upgrade My PC suggestion card with apply action

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

# CHUNK K — Peripherals / Exterior Tab

---

### Task K1: Peripherals catalog data

**Files:**
- Create: `src/data/peripheralsData.json`

- [ ] **Step 1: Create the data file**

Create `src/data/peripheralsData.json`:

```json
[
  { "id": "mon-dell-s2721dgf", "category": "monitor", "name": "Dell S2721DGF 27\" QHD 165Hz", "price": 329.99, "resolution": "1440p", "refresh": 165 },
  { "id": "mon-lg-27gp850", "category": "monitor", "name": "LG 27GP850 27\" QHD 180Hz", "price": 379.99, "resolution": "1440p", "refresh": 180 },
  { "id": "mon-gigabyte-m32u", "category": "monitor", "name": "Gigabyte M32U 32\" 4K 144Hz", "price": 599.99, "resolution": "4k", "refresh": 144 },
  { "id": "mon-aoc-24g2", "category": "monitor", "name": "AOC 24G2 24\" FHD 144Hz", "price": 149.99, "resolution": "1080p", "refresh": 144 },
  { "id": "mon-asus-pg27aqdm", "category": "monitor", "name": "ASUS PG27AQDM 27\" QHD OLED 240Hz", "price": 899.99, "resolution": "1440p", "refresh": 240 },
  { "id": "mon-samsung-g7", "category": "monitor", "name": "Samsung Odyssey G7 32\" QHD 240Hz", "price": 549.99, "resolution": "1440p", "refresh": 240 },

  { "id": "kb-keychron-k8", "category": "keyboard", "name": "Keychron K8 Mechanical", "price": 89.99, "switch": "Brown" },
  { "id": "kb-logi-g915", "category": "keyboard", "name": "Logitech G915 TKL Wireless", "price": 209.99, "switch": "Tactile" },
  { "id": "kb-corsair-k70", "category": "keyboard", "name": "Corsair K70 RGB", "price": 159.99, "switch": "Red" },
  { "id": "kb-ducky-one3", "category": "keyboard", "name": "Ducky One 3", "price": 119.99, "switch": "Blue" },
  { "id": "kb-razer-huntsman", "category": "keyboard", "name": "Razer Huntsman V2", "price": 149.99, "switch": "Optical" },
  { "id": "kb-steelseries-apex", "category": "keyboard", "name": "SteelSeries Apex Pro", "price": 199.99, "switch": "Adjustable" },

  { "id": "mouse-logi-gpro", "category": "mouse", "name": "Logitech G Pro X Superlight", "price": 129.99, "dpi": 25600 },
  { "id": "mouse-razer-viper", "category": "mouse", "name": "Razer Viper V2 Pro", "price": 139.99, "dpi": 30000 },
  { "id": "mouse-glorious-o", "category": "mouse", "name": "Glorious Model O", "price": 49.99, "dpi": 12000 },
  { "id": "mouse-ss-aerox3", "category": "mouse", "name": "SteelSeries Aerox 3", "price": 69.99, "dpi": 18000 },
  { "id": "mouse-corsair-m65", "category": "mouse", "name": "Corsair M65 RGB Elite", "price": 59.99, "dpi": 18000 },
  { "id": "mouse-logi-g502", "category": "mouse", "name": "Logitech G502 X", "price": 79.99, "dpi": 25600 },

  { "id": "hs-hyperx-cloud2", "category": "headset", "name": "HyperX Cloud II", "price": 79.99, "type": "Wired" },
  { "id": "hs-steelseries-arctis", "category": "headset", "name": "SteelSeries Arctis Nova 7", "price": 149.99, "type": "Wireless" },
  { "id": "hs-logi-g733", "category": "headset", "name": "Logitech G733 Lightspeed", "price": 129.99, "type": "Wireless" },
  { "id": "hs-razer-blackshark", "category": "headset", "name": "Razer BlackShark V2", "price": 99.99, "type": "Wired" },
  { "id": "hs-corsair-virtuoso", "category": "headset", "name": "Corsair Virtuoso RGB", "price": 179.99, "type": "Wireless" },
  { "id": "hs-audeze-maxwell", "category": "headset", "name": "Audeze Maxwell", "price": 299.99, "type": "Wireless" }
]
```

- [ ] **Step 2: Sanity-check it parses**

Run: `npx vite build`
Expected: success (invalid JSON would fail the build).

- [ ] **Step 3: Commit**

```powershell
git add src/data/peripheralsData.json
git commit -m @'
feat(data): static peripherals catalog (monitor/keyboard/mouse/headset)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

### Task K2: Peripherals store slice (TDD)

**Files:**
- Modify: `src/store/useBuilderStore.js`
- Modify: `src/tests/useBuilderStore.test.js`

- [ ] **Step 1: Write the failing test**

In `src/tests/useBuilderStore.test.js`, update the import line to add the new selector:

```js
import useBuilderStore, {
  selTotalSpent, selRemainingBudget, selTotalPower, selPsuWattage, selPeripheralsTotal
} from '../store/useBuilderStore'
```

Update the `beforeEach` reset to also clear peripherals:

```js
beforeEach(() => {
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {} })
})
```

Add this block at the end of the `describe('useBuilderStore', ...)` body (before its closing `})`):

```js
  it('adds and removes a peripheral independently of selectedParts', () => {
    const mon = { id: 'mon-x', category: 'monitor', name: 'Mon', price: 300 }
    useBuilderStore.getState().addPeripheral('monitor', mon)
    expect(useBuilderStore.getState().selectedPeripherals.monitor).toEqual(mon)
    expect(useBuilderStore.getState().selectedParts.monitor).toBeUndefined()
    useBuilderStore.getState().removePeripheral('monitor')
    expect(useBuilderStore.getState().selectedPeripherals.monitor).toBeUndefined()
  })

  it('selPeripheralsTotal sums peripheral prices', () => {
    useBuilderStore.getState().addPeripheral('monitor', { price: 300 })
    useBuilderStore.getState().addPeripheral('mouse', { price: 60 })
    expect(selPeripheralsTotal(useBuilderStore.getState())).toBeCloseTo(360)
  })

  it('peripherals do not affect selTotalSpent', () => {
    useBuilderStore.getState().addPeripheral('monitor', { price: 300 })
    expect(selTotalSpent(useBuilderStore.getState())).toBe(0)
  })
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/tests/useBuilderStore.test.js`
Expected: FAIL (`addPeripheral`/`selPeripheralsTotal` undefined).

- [ ] **Step 3: Add the slice + selector**

In `src/store/useBuilderStore.js`, inside the `create((set) => ({ ... }))` object, add after the `resolution`/`setResolution` lines (before the closing `}))`):

```js
  selectedPeripherals: {},

  addPeripheral: (category, part) =>
    set((state) => ({
      selectedPeripherals: { ...state.selectedPeripherals, [category]: part },
    })),

  removePeripheral: (category) =>
    set((state) => {
      const next = { ...state.selectedPeripherals }
      delete next[category]
      return { selectedPeripherals: next }
    }),
```

Then add this selector at the bottom of the file (with the other `export const sel...` lines):

```js
export const selPeripheralsTotal = (s) =>
  Object.values(s.selectedPeripherals).reduce((sum, p) => sum + (p?.price ?? 0), 0)
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run src/tests/useBuilderStore.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/store/useBuilderStore.js src/tests/useBuilderStore.test.js
git commit -m @'
feat(store): peripherals slice + subtotal selector, with tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

### Task K3: Peripherals panel + Build/Peripherals tab

**Files:**
- Create: `src/components/PeripheralsPanel.jsx`
- Modify: `src/screens/BuilderScreen.jsx`

- [ ] **Step 1: Create the panel**

Create `src/components/PeripheralsPanel.jsx`:

```jsx
import { useMemo } from 'react'
import useBuilderStore, { selPeripheralsTotal } from '../store/useBuilderStore'
import peripheralsData from '../data/peripheralsData.json'

const CATEGORIES = ['monitor', 'keyboard', 'mouse', 'headset']

function specLine(p) {
  if (p.category === 'monitor') return `${p.resolution} · ${p.refresh}Hz`
  if (p.category === 'keyboard') return `${p.switch} switches`
  if (p.category === 'mouse') return `${p.dpi} DPI`
  if (p.category === 'headset') return p.type
  return ''
}

export default function PeripheralsPanel() {
  const selected      = useBuilderStore((s) => s.selectedPeripherals)
  const addPeripheral = useBuilderStore((s) => s.addPeripheral)
  const total         = useBuilderStore(selPeripheralsTotal)

  const byCategory = useMemo(() => {
    const map = {}
    for (const cat of CATEGORIES) map[cat] = peripheralsData.filter((p) => p.category === cat)
    return map
  }, [])

  return (
    <div className="w-full h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6 max-w-5xl mx-auto">
        <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">Peripherals</h2>
        <span className="text-sm text-gray-300">Subtotal: <span className="text-cyan-300 font-semibold">£{total.toFixed(2)}</span></span>
      </div>
      <div className="max-w-5xl mx-auto space-y-8">
        {CATEGORIES.map((cat) => (
          <section key={cat}>
            <h3 className="text-sm font-semibold text-gray-300 capitalize mb-3">{cat}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {byCategory[cat].map((p) => {
                const isSelected = selected[cat]?.id === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => addPeripheral(cat, p)}
                    className={`text-left rounded-2xl border p-4 transition-all
                      ${isSelected
                        ? 'border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.25)]'
                        : 'border-white/10 bg-white/5 hover:border-cyan-400/40 hover:-translate-y-0.5'}`}
                  >
                    <div className="text-sm font-semibold text-white leading-tight">{p.name}</div>
                    <div className="font-bold text-cyan-300 mt-1">£{p.price.toFixed(2)}</div>
                    <div className="text-xs text-gray-400 mt-1">{specLine(p)}</div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the tab toggle in BuilderScreen**

In `src/screens/BuilderScreen.jsx`:

Add the import:

```jsx
import PeripheralsPanel from '../components/PeripheralsPanel'
```

Add a `view` state next to the existing `activeCategory` state:

```jsx
  const [activeCategory, setActiveCategory] = useState(null)
  const [view, setView] = useState('build')
```

Replace the canvas/overlay container block so the 3D builder shows for `view === 'build'` and the peripherals panel shows otherwise. Change:

```jsx
      <div className="pt-16 h-[calc(100vh-4rem)]">
        <div className="relative w-full h-full">
          <BuildCanvas selectedParts={selectedParts} />
          <BottleneckIndicator />
          <PerformancePanel />
          <OrbitRing
            selectedParts={selectedParts}
            onSelectCategory={setActiveCategory}
            onDeselect={removePart}
          />
          <CaseToggle />
          <UpgradeSuggestion />
        </div>
      </div>
```

to:

```jsx
      <div className="pt-16 h-[calc(100vh-4rem)]">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 inline-flex rounded-full bg-gray-900/70 backdrop-blur-md border border-white/10 p-0.5">
          {['build', 'peripherals'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1 text-xs font-medium rounded-full capitalize transition-all
                ${view === v
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                  : 'text-gray-300 hover:text-white'}`}
            >
              {v}
            </button>
          ))}
        </div>
        {view === 'build' ? (
          <div className="relative w-full h-full">
            <BuildCanvas selectedParts={selectedParts} />
            <BottleneckIndicator />
            <PerformancePanel />
            <OrbitRing
              selectedParts={selectedParts}
              onSelectCategory={setActiveCategory}
              onDeselect={removePart}
            />
            <CaseToggle />
            <UpgradeSuggestion />
          </div>
        ) : (
          <PeripheralsPanel />
        )}
      </div>
```

(If `PerformancePanel`/`UpgradeSuggestion` from Chunk I/J are not yet present when doing K standalone, omit those two lines — but in build order H→I→J→K they exist.)

- [ ] **Step 3: Confirm tests + build**

Run: `npx vitest run`
Expected: PASS.

Run: `npx vite build`
Expected: success.

- [ ] **Step 4: Visual check**

Dev server: a **Build | Peripherals** toggle sits centered under the top bar. Switching to **Peripherals** shows the four categories; clicking an item highlights it and the subtotal updates. Switching back to **Build** shows the 3D tower unaffected, and the component budget bar in the top bar is unchanged by peripheral picks. Screenshot both views.

- [ ] **Step 5: Commit**

```powershell
git add src/components/PeripheralsPanel.jsx src/screens/BuilderScreen.jsx
git commit -m @'
feat(ui): peripherals tab with category picker and subtotal

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Final verification

- [ ] Run the full suite: `npx vitest run` → all green (existing + new: fpsEstimate, valueScore, upgradeAdvisor, store peripherals).
- [ ] `npx vite build` → succeeds.
- [ ] Dev-server pass over the whole flow: tower with glass window (solid + open), Performance panel FPS reacting to the resolution toggle, Upgrade card applying a swap, Peripherals tab with its own subtotal.

---

## Self-review notes (coverage check)

- **Spec Chunk H** → Tasks H1 (panelized tower + glass window in solid mode) + H2 (tower proportions via geometry, motherboard against rear panel, camera framing/declutter). ✓
- **Spec Chunk I** → Tasks I1 (`estimateFps`), I2 (`valuePerPound`/`buildValuePerPound`), I3 (Performance panel), I4 (optional card badge). ✓
- **Spec Chunk J** → Tasks J1 (`suggestUpgrade` honoring compatibility + budget), J2 (suggestion card with apply). ✓
- **Spec Chunk K** → Tasks K1 (`peripheralsData.json`), K2 (store slice + `selPeripheralsTotal`, isolated from build budget), K3 (tab + panel + subtotal). ✓
- **Naming consistency:** `estimateFps`, `valuePerPound`, `buildValuePerPound`, `suggestUpgrade`, `addPeripheral`, `removePeripheral`, `selPeripheralsTotal` used identically across helper, test, and consumer tasks.
- **No placeholders:** every code step shows complete code; every run step shows the command + expected result.
