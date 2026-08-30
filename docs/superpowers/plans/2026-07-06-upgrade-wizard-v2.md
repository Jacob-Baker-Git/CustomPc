# Upgrade Wizard v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the Upgrade wizard into a two-path fork ("Select what I want to upgrade" vs "I'm unsure"), backed by a whole-system upgrade scorer that keeps CPU/GPU as honest FPS drivers and scores supporting parts (RAM, storage, PSU, cooler) on their own merits.

**Architecture:** Two new pure-lib modules (`partQuality`, `systemUpgrades`) plus a rewrite of `UpgradeWizard.jsx` into a local state machine (`screen` × `path`). `systemUpgrades` reuses the existing `upgradeCandidates`/`computeBottleneck`/`checkCompatibility`; nothing touches the store until Apply. `GeneratedBanner` is hardened so upgrades without an FPS number don't render "undefined fps".

**Tech Stack:** React 19, Vitest + Testing Library, Zustand. Node lives at `C:\Program Files\nodejs` — prepend it to PATH in PowerShell if `node`/`npm` aren't found. Tests: `npm run test:run -- <file>`.

**Dependency:** This is Plan 1 of 2. Plan 2 (Build-a-new-PC v2) depends on `src/lib/partQuality.js` created here.

---

### Task 1: `partQuality()` — comparable per-category "better" score

**Files:**
- Create: `src/lib/partQuality.js`
- Test: `src/tests/partQuality.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { partQuality } from '../lib/partQuality'

describe('partQuality', () => {
  it('cpu/gpu score is perfScore', () => {
    expect(partQuality({ category: 'cpu', perfScore: 120 })).toBe(120)
    expect(partQuality({ category: 'gpu', perfScore: 300 })).toBe(300)
  })
  it('ram: capacity dominates, speed tiebreaks', () => {
    const small = partQuality({ category: 'ram', capacityGb: 16, speed: 6000 })
    const big   = partQuality({ category: 'ram', capacityGb: 32, speed: 5200 })
    expect(big).toBeGreaterThan(small)
    const fast = partQuality({ category: 'ram', capacityGb: 32, speed: 6000 })
    expect(fast).toBeGreaterThan(big)
  })
  it('storage rewards read speed and capacity', () => {
    const sata = partQuality({ category: 'storage', capacityGb: 1000, specs: { readMbps: 550 } })
    const nvme = partQuality({ category: 'storage', capacityGb: 1000, specs: { readMbps: 7000 } })
    expect(nvme).toBeGreaterThan(sata)
  })
  it('psu score is wattage', () => {
    expect(partQuality({ category: 'psu', wattage: 750 })).toBe(750)
  })
  it('cooler: AIO outranks air', () => {
    const air = partQuality({ category: 'cooler', specs: { type: 'air', height: 158 } })
    const aio = partQuality({ category: 'cooler', specs: { type: 'AIO', radiator: '360mm' } })
    expect(aio).toBeGreaterThan(air)
  })
  it('null part scores 0', () => {
    expect(partQuality(null)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/partQuality.test.js`
Expected: FAIL — `partQuality` is not defined.

- [ ] **Step 3: Write the implementation**

```js
// Ranks two parts of the SAME category on a comparable "which is the upgrade"
// scale. Not a cross-category metric. Used by the whole-system upgrade scorer
// and by the use-case builder's maximise pass.

function radiatorMm(radiator) {
  const m = /(\d{2,3})/.exec(String(radiator ?? ''))
  return m ? Number(m[1]) : 0
}

export function partQuality(part) {
  if (!part) return 0
  const s = part.specs ?? {}
  switch (part.category) {
    case 'cpu':
    case 'gpu':
      return part.perfScore ?? 0
    case 'ram':
      return (part.capacityGb ?? 0) * 100 + (part.speed ?? 0) / 100
    case 'storage':
      return (s.readMbps ?? 0) + (part.capacityGb ?? 0)
    case 'psu':
      return part.wattage ?? 0
    case 'cooler':
      return s.type === 'AIO' ? 300 + radiatorMm(s.radiator) : (s.height ?? 0)
    default:
      return part.perfScore ?? 0
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/partQuality.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/partQuality.js src/tests/partQuality.test.js
git commit -m "feat: partQuality — per-category upgrade ranking helper"
```

---

### Task 2: `systemUpgrades()` — candidate lists (`byCat`)

**Files:**
- Create: `src/lib/systemUpgrades.js`
- Test: `src/tests/systemUpgrades.test.js`

**Context:** `upgradeCandidates(currentParts, { game, resolution, targetFps, budget }, catalog)` already returns CPU/GPU candidates with `fpsGain / resultFps / meetsGoal / fixesBottleneck / pricePerFps`. This task groups those by category and adds supporting-part candidates for `ram/storage/psu/cooler`. Deficiencies come in Task 3 (return `deficiencies: []` for now).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { systemUpgrades } from '../lib/systemUpgrades'

const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50,  tdp: 65,  socket: 'AM5' }
const cpuHi = { id: 'cpu-hi', category: 'cpu', name: 'CPU Hi', price: 300, perfScore: 250, tdp: 105, socket: 'AM5' }
const gpuLo = { id: 'gpu-lo', category: 'gpu', name: 'GPU Lo', price: 200, perfScore: 300, tdp: 200, length: 250 }
const ram16 = { id: 'ram-16', category: 'ram', name: 'RAM 16', price: 60,  capacityGb: 16, ramType: 'DDR5', speed: 6000 }
const ram32 = { id: 'ram-32', category: 'ram', name: 'RAM 32', price: 110, capacityGb: 32, ramType: 'DDR5', speed: 6000 }
const game  = { id: 'g', name: 'G', fpsFactor: 1, cpuFactor: 1 }
const catalog = [cpuLo, cpuHi, gpuLo, ram16, ram32]
const goal = { game, resolution: '1080p', targetFps: 1 }

describe('systemUpgrades — byCat', () => {
  it('groups the CPU FPS upgrade under byCat.cpu', () => {
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo }, goal, 1000, catalog)
    expect(r.byCat.cpu.map((c) => c.toPart.id)).toContain('cpu-hi')
    expect(r.byCat.cpu[0].fpsGain).toBeGreaterThan(0)
  })
  it('offers a bigger RAM stick with a reason and no fps fields', () => {
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo, ram: ram16 }, goal, 1000, catalog)
    const up = r.byCat.ram.find((c) => c.toPart.id === 'ram-32')
    expect(up).toBeTruthy()
    expect(up.extraCost).toBe(50)
    expect(up.reason).toMatch(/32GB/)
    expect(up.resultFps).toBeUndefined()
  })
  it('respects the upgrade budget for supporting parts', () => {
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo, ram: ram16 }, goal, 40, catalog)
    expect(r.byCat.ram).toBeUndefined() // +50 over the £40 cap
  })
  it('omits categories with no meaningful upgrade axis', () => {
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo }, goal, 1000, catalog)
    expect(r.byCat.case).toBeUndefined()
    expect(r.byCat.motherboard).toBeUndefined()
    expect(r.byCat.fans).toBeUndefined()
  })
  it('returns a bottleneck object when cpu+gpu present', () => {
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo }, goal, 1000, catalog)
    expect(r.bottleneck).toBeTruthy()
    expect(typeof r.bottleneck.limitedBy).toBe('string')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/systemUpgrades.test.js`
Expected: FAIL — `systemUpgrades` is not defined.

- [ ] **Step 3: Write the implementation**

```js
import { upgradeCandidates, sortCandidates } from './upgradeAdvisor'
import { computeBottleneck } from './bottleneck'
import { checkCompatibility } from './compatibility'
import { partQuality } from './partQuality'

// Supporting parts that have an honest, non-FPS upgrade axis. case / motherboard
// / fans deliberately excluded — no real performance ranking, so we route the
// user to the Build tab instead of fabricating one.
const SUPPORTING = ['ram', 'storage', 'psu', 'cooler']
const MAX_PER_CAT = 3

function reasonFor(category, part) {
  const read = part.specs?.readMbps ?? 0
  switch (category) {
    case 'ram':
      return `${part.capacityGb}GB${part.speed ? ` · ${part.speed}MT/s` : ''}`
    case 'storage':
      if (read >= 5000) return 'PCIe 4.0 NVMe — far faster loads'
      if (read >= 2000) return 'NVMe SSD'
      if (read >= 400)  return 'SATA SSD — quicker than a hard drive'
      return `${part.capacityGb ?? 0}GB — more space`
    case 'psu':
      return `${part.wattage}W — comfortable headroom`
    case 'cooler':
      return 'handles a hot CPU with less noise'
    default:
      return ''
  }
}

function supportingCandidates(currentParts, category, budget, catalog) {
  const current = currentParts[category]
  if (!current) return []
  const curQ = partQuality(current)
  return catalog
    .filter((p) => p.category === category && partQuality(p) > curQ)
    .map((p) => ({
      category,
      fromPart: current,
      toPart: p,
      extraCost: p.price - current.price,
      reason: reasonFor(category, p),
    }))
    .filter((c) => c.extraCost > 0 && c.extraCost <= budget)
    .filter((c) => checkCompatibility(currentParts, c.toPart).compatible)
    .sort((a, b) => a.extraCost - b.extraCost)
    .slice(0, MAX_PER_CAT)
}

// Whole-system upgrade analysis. CPU/GPU carry real FPS gains (via
// upgradeCandidates); supporting parts carry an honest `reason` string.
// `budget` is the extra spend allowed for a swap (not the whole build).
export function systemUpgrades(currentParts, goal, budget, catalog) {
  const { cpu, gpu } = currentParts
  const bottleneck = cpu && gpu ? computeBottleneck(cpu, gpu, goal.resolution) : null

  const fpsList = cpu && gpu
    ? upgradeCandidates(currentParts, { ...goal, budget }, catalog)
    : []

  const byCat = {}
  const cpuList = sortCandidates(fpsList.filter((c) => c.category === 'cpu'), 'value')
  const gpuList = sortCandidates(fpsList.filter((c) => c.category === 'gpu'), 'value')
  if (cpuList.length) byCat.cpu = cpuList
  if (gpuList.length) byCat.gpu = gpuList
  for (const cat of SUPPORTING) {
    const list = supportingCandidates(currentParts, cat, budget, catalog)
    if (list.length) byCat[cat] = list
  }

  return { bottleneck, byCat, deficiencies: [] }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/systemUpgrades.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/systemUpgrades.js src/tests/systemUpgrades.test.js
git commit -m "feat: systemUpgrades — grouped CPU/GPU + supporting-part candidates"
```

---

### Task 3: `systemUpgrades()` — deficiency flags

**Files:**
- Modify: `src/lib/systemUpgrades.js`
- Test: `src/tests/systemUpgrades.test.js` (append)

- [ ] **Step 1: Write the failing tests (append to the existing describe block file)**

```js
describe('systemUpgrades — deficiencies', () => {
  const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50, tdp: 65, socket: 'AM5' }
  const gpuLo = { id: 'gpu-lo', category: 'gpu', name: 'GPU Lo', price: 200, perfScore: 300, tdp: 200, length: 250 }
  const game  = { id: 'g', name: 'G', fpsFactor: 1, cpuFactor: 1 }
  const goal  = { game, resolution: '1080p', targetFps: 1 }
  const has = (r, cat, sev) => r.deficiencies.some((d) => d.category === cat && d.severity === sev)

  it('flags RAM under 16GB as high severity', () => {
    const ram8 = { id: 'r8', category: 'ram', name: 'R8', price: 30, capacityGb: 8, ramType: 'DDR5', speed: 5200 }
    const psu  = { id: 'p', category: 'psu', name: 'PSU', price: 80, wattage: 850 }
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo, ram: ram8, psu }, goal, 1000, [])
    expect(has(r, 'ram', 'high')).toBe(true)
  })
  it('does not flag 16GB RAM', () => {
    const ram16 = { id: 'r16', category: 'ram', name: 'R16', price: 60, capacityGb: 16, ramType: 'DDR5', speed: 6000 }
    const psu   = { id: 'p', category: 'psu', name: 'PSU', price: 80, wattage: 850 }
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo, ram: ram16, psu }, goal, 1000, [])
    expect(r.deficiencies.some((d) => d.category === 'ram')).toBe(false)
  })
  it('flags an HDD as medium severity', () => {
    const hdd = { id: 'h', category: 'storage', name: 'HDD', price: 40, capacityGb: 2000, storageType: 'HDD', specs: { readMbps: 180 } }
    const psu = { id: 'p', category: 'psu', name: 'PSU', price: 80, wattage: 850 }
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo, storage: hdd, psu }, goal, 1000, [])
    expect(has(r, 'storage', 'medium')).toBe(true)
  })
  it('flags a PSU with under ~30% headroom as high', () => {
    const psuSmall = { id: 'ps', category: 'psu', name: 'PSU Small', price: 50, wattage: 300 } // draw 265 * 1.3 = 344 > 300
    const r = systemUpgrades({ cpu: cpuLo, gpu: gpuLo, psu: psuSmall }, goal, 1000, [])
    expect(has(r, 'psu', 'high')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/systemUpgrades.test.js`
Expected: FAIL — deficiencies is always `[]`.

- [ ] **Step 3: Implement `deficiencies` and wire it in**

Add this helper above `systemUpgrades`:

```js
const drawOf = (parts) => Object.values(parts).reduce((s, p) => s + (p?.tdp ?? 0), 0)

function deficienciesFor(currentParts, bottleneck) {
  const out = []
  const { ram, storage, psu } = currentParts

  if (ram && (ram.capacityGb ?? 0) < 16) {
    out.push({ category: 'ram', severity: 'high',
      reason: `${ram.capacityGb}GB RAM holds modern games back — 16GB is the baseline.` })
  }
  if (storage) {
    if (storage.storageType === 'HDD') {
      out.push({ category: 'storage', severity: 'medium', reason: 'An SSD would cut load times dramatically.' })
    } else if ((storage.capacityGb ?? 0) < 1000) {
      out.push({ category: 'storage', severity: 'low', reason: 'Under 1TB fills up fast — consider more space.' })
    }
  }
  const draw = drawOf(currentParts)
  if (!psu || draw * 1.3 > (psu.wattage ?? 0)) {
    out.push({ category: 'psu', severity: 'high',
      reason: psu ? 'Your PSU leaves under ~30% headroom for this build.' : 'No power supply selected.' })
  }
  if (bottleneck && bottleneck.limitedBy === 'cpu') {
    out.push({ category: 'cpu', severity: 'high', reason: bottleneck.verdict })
  }
  return out
}
```

Then change the return line from `deficiencies: []` to:

```js
  return { bottleneck, byCat, deficiencies: deficienciesFor(currentParts, bottleneck) }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/systemUpgrades.test.js`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/systemUpgrades.js src/tests/systemUpgrades.test.js
git commit -m "feat: systemUpgrades — RAM/storage/PSU/CPU deficiency flags"
```

---

### Task 4: Harden `GeneratedBanner` for FPS-less upgrades

**Files:**
- Modify: `src/components/GeneratedBanner.jsx`
- Test: `src/tests/GeneratedBanner.test.jsx` (append one case)

**Context:** Today the banner assumes `info.estFps/gameName/targetFps`. A supporting-only upgrade (e.g. applying a RAM swap in Path A) sets `lastGenerated` without `estFps`, so the current `!info.met` branch would render "Closest to your undefined fps target: ~undefined fps". Guard the FPS copy behind `info.estFps != null` and add a generic upgrade line.

- [ ] **Step 1: Write the failing test (append)**

```js
it('shows a generic line for an FPS-less upgrade (no "undefined fps")', () => {
  useBuilderStore.setState({
    lastGenerated: { upgrade: true },
    budget: 1000, resolution: '1440p',
    selectedParts: { cpu: { price: 300 }, gpu: { price: 400 } },
  })
  render(<GeneratedBanner />)
  expect(screen.getByRole('status').textContent).not.toMatch(/undefined/)
  expect(screen.getByText(/upgrade applied/i)).toBeInTheDocument()
})
```

(Check the file's existing imports — it already imports `render`, `screen`, `useBuilderStore`, `GeneratedBanner`. Reuse them; do not re-import.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/GeneratedBanner.test.jsx`
Expected: FAIL — renders "undefined" / no "Upgrade applied" text.

- [ ] **Step 3: Update the paragraph render**

In `src/components/GeneratedBanner.jsx`, replace the message paragraph (the `<p className="text-xs text-slate-200"> … </p>` block) with:

```jsx
      <p className="text-xs text-slate-200">
        {info.estFps != null && info.gameName
          ? (info.met
              ? <>This build hits <span className={`${TELEMETRY} text-cyan-300 font-semibold`}>~{info.estFps} fps</span> in {info.gameName} at {resLabel}</>
              : <>Closest to your {info.targetFps} fps target: <span className={`${TELEMETRY} text-amber-300 font-semibold`}>~{info.estFps} fps</span> in {info.gameName} at {resLabel}</>)
          : <>Upgrade applied</>}
        {info.quality && info.quality !== 'high' && <> on <span className="text-slate-100">{info.quality}</span> settings</>}
        {leftover > 0 && <> — <span className={`${TELEMETRY} text-emerald-300`}>£{leftover.toFixed(0)}</span> under budget</>}
      </p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/tests/GeneratedBanner.test.jsx`
Expected: PASS (existing cases + the new one).

- [ ] **Step 5: Commit**

```bash
git add src/components/GeneratedBanner.jsx src/tests/GeneratedBanner.test.jsx
git commit -m "fix: GeneratedBanner handles upgrades without an FPS estimate"
```

---

### Task 5: Rewrite `UpgradeWizard` into the two-path fork

**Files:**
- Modify: `src/components/UpgradeWizard.jsx` (full rewrite)
- Test: `src/tests/UpgradeWizard.test.jsx` (rewrite)

**Context:** The current wizard is linear (Current PC → Goal → Upgrades) with a single "Next: goal" button. It becomes a state machine: `screen ∈ {specs, highlight, goal, results}` × `path ∈ {select, unsure}`. Step 1 keeps the Build/Saved tabs and `hasCore` gate but its footer offers two path buttons. Path A adds a highlight screen and filters results to highlighted categories; Path B skips highlight and shows a diagnosis (Limiter + Plan + "Apply all"). Reuse `systemUpgrades`, `sortCandidates`, `checkCompatibility`, `enterBuildTab`.

- [ ] **Step 1: Rewrite the test file**

Replace the entire contents of `src/tests/UpgradeWizard.test.jsx` with:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import UpgradeWizard from '../components/UpgradeWizard'
import useBuilderStore from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'
import useCatalogStore from '../store/useCatalogStore'
import { encodeBuild } from '../lib/buildCodec'

const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50,  tdp: 65,  socket: 'AM5' }
const cpuHi = { id: 'cpu-hi', category: 'cpu', name: 'CPU Hi', price: 300, perfScore: 250, tdp: 105, socket: 'AM5' }
const gpuLo = { id: 'gpu-lo', category: 'gpu', name: 'GPU Lo', price: 200, perfScore: 300, tdp: 200, length: 250 }
const game  = { id: 'fortnite', name: 'Fortnite', fpsFactor: 1, cpuFactor: 1 }

function loadSavedRig() {
  fireEvent.click(screen.getByRole('button', { name: /select saved build/i }))
  fireEvent.click(screen.getByRole('button', { name: /my rig/i }))
}

beforeEach(() => {
  window.location.hash = ''
  useCatalogStore.setState({ parts: [cpuLo, cpuHi, gpuLo], games: [game] })
  useBuilderStore.setState({ budget: 0, flow: 'upgrade', selectedParts: {}, resolution: '1440p' })
  const code = encodeBuild({ budget: 0, resolution: '1440p', parts: { cpu: cpuLo, gpu: gpuLo }, peripherals: {} })
  useSavedStore.setState({ saved: [{ id: 's1', name: 'My rig', savedAt: 1, code }] })
})

describe('UpgradeWizard fork', () => {
  it('disables both path buttons until CPU and GPU are set', () => {
    render(<UpgradeWizard onBack={() => {}} />)
    expect(screen.getByRole('button', { name: /select what i want to upgrade/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /i'm unsure/i })).toBeDisabled()
  })

  it('Path A: highlight CPU → goal → apply the CPU upgrade', () => {
    window.location.hash = 'summary'
    render(<UpgradeWizard onBack={() => {}} />)
    loadSavedRig()
    fireEvent.click(screen.getByRole('button', { name: /select what i want to upgrade/i }))
    // highlight screen: pick CPU
    fireEvent.click(screen.getByRole('button', { name: /cpu lo/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    // goal screen
    fireEvent.click(screen.getByRole('button', { name: /see upgrades/i }))
    fireEvent.click(screen.getAllByRole('button', { name: /^apply$/i })[0])

    const s = useBuilderStore.getState()
    expect(s.selectedParts.cpu.id).toBe('cpu-hi')
    expect(s.budget).toBe(700) // (100 + 200) + 400
    expect(window.location.hash).toBe('#build')
  })

  it('Path B: skips highlight, shows a diagnosis, Apply all swaps the CPU', () => {
    render(<UpgradeWizard onBack={() => {}} />)
    loadSavedRig()
    fireEvent.click(screen.getByRole('button', { name: /i'm unsure/i }))
    fireEvent.click(screen.getByRole('button', { name: /see upgrades/i }))
    // diagnosis renders a plan with "Apply all recommended"
    fireEvent.click(screen.getByRole('button', { name: /apply all recommended/i }))
    const s = useBuilderStore.getState()
    expect(s.selectedParts.cpu.id).toBe('cpu-hi')
    expect(window.location.hash).toBe('#build')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/tests/UpgradeWizard.test.jsx`
Expected: FAIL — old wizard has no "select what i want to upgrade" button.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `src/components/UpgradeWizard.jsx` with:

```jsx
import { useState, useMemo } from 'react'
import Backdrop from './Backdrop'
import CategoryList from './CategoryList'
import PartSelector from './PartSelector'
import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import { decodeBuild } from '../lib/buildCodec'
import { sortCandidates } from '../lib/upgradeAdvisor'
import { systemUpgrades } from '../lib/systemUpgrades'
import { checkCompatibility } from '../lib/compatibility'
import { enterBuildTab } from '../lib/enterBuildTab'
import { PANEL, BTN_PRIMARY, TELEMETRY } from '../lib/uiTokens'

const RES_OPTIONS = [
  { id: '1080p', label: '1080p' },
  { id: '1440p', label: '1440p' },
  { id: '4k',    label: '4K' },
]
const TARGETS = [60, 120, 144, 240]
const SORT_LABELS = [
  { key: 'value', label: 'Best £/FPS' },
  { key: 'gain',  label: 'Most FPS' },
  { key: 'cost',  label: 'Cheapest' },
]
const NON_UPGRADEABLE = new Set(['case', 'motherboard', 'fans'])
const APPLY_ORDER = ['cpu', 'gpu', 'ram', 'cooler', 'storage', 'psu']
const CAT_LABEL = {
  cpu: 'CPU', gpu: 'GPU', ram: 'RAM', storage: 'Storage', psu: 'PSU',
  cooler: 'Cooler', motherboard: 'Motherboard', case: 'Case', fans: 'Fans',
}
const totalOf = (parts) => Object.values(parts).reduce((s, p) => s + (p?.price ?? 0), 0)

function buildPlan(analysis) {
  const plan = []
  const perf = sortCandidates([...(analysis.byCat.cpu ?? []), ...(analysis.byCat.gpu ?? [])], 'value')
  const best = perf.find((c) => c.meetsGoal) ?? perf[0]
  if (best) plan.push(best)
  for (const d of analysis.deficiencies) {
    if (d.severity === 'low' || d.category === 'cpu') continue
    const fix = (analysis.byCat[d.category] ?? [])[0]
    if (fix && !plan.some((p) => p.category === fix.category)) plan.push(fix)
  }
  return plan
}

function CandidateCard({ c, targetFps, onApply }) {
  const isFps = c.resultFps != null
  return (
    <div className="border border-slate-700/70 rounded-sm px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-100">
          <span className="uppercase text-[10px] text-slate-500 mr-1">{CAT_LABEL[c.category] ?? c.category}</span>
          {c.toPart.name}
        </span>
        {isFps
          ? <span className={`${TELEMETRY} text-emerald-300 text-sm font-semibold`}>+{c.fpsGain} fps</span>
          : <span className="text-[11px] text-slate-400">{c.reason}</span>}
      </div>
      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
        <span>{c.extraCost <= 0 ? 'no extra cost' : `+£${c.extraCost.toFixed(0)}`}</span>
        {isFps && c.extraCost > 0 && <span>· £{c.pricePerFps.toFixed(1)}/fps</span>}
        {isFps && c.meetsGoal && <span className="text-cyan-300">· hits {targetFps} fps</span>}
        {isFps && c.fixesBottleneck && <span className="text-amber-300">· fixes bottleneck</span>}
      </div>
      <button onClick={onApply} className={`mt-2 w-full ${BTN_PRIMARY} text-sm font-medium py-1.5 rounded-sm transition-colors`}>
        Apply
      </button>
    </div>
  )
}

export default function UpgradeWizard({ onBack }) {
  const [screen, setScreen] = useState('specs')   // 'specs' | 'highlight' | 'goal' | 'results'
  const [path, setPath] = useState(null)          // 'select' | 'unsure'
  const [tab, setTab] = useState('build')
  const [currentParts, setCurrentParts] = useState({})
  const [selectedCats, setSelectedCats] = useState(() => new Set())
  const [pickerCategory, setPickerCategory] = useState(null)
  const [gameId, setGameId] = useState('fortnite')
  const [resolution, setResolution] = useState('1440p')
  const [fps, setFps] = useState(120)
  const [upgradeBudget, setUpgradeBudget] = useState(400)
  const [sortKey, setSortKey] = useState('value')

  const saved      = useSavedStore((s) => s.saved)
  const partsData  = useCatalogStore((s) => s.parts)
  const gamesData  = useCatalogStore((s) => s.games)
  const setBuild           = useBuilderStore((s) => s.setBuild)
  const setBudget          = useBuilderStore((s) => s.setBudget)
  const setStoreResolution = useBuilderStore((s) => s.setResolution)
  const setLastGenerated   = useBuilderStore((s) => s.setLastGenerated)

  const hasCore = Boolean(currentParts.cpu && currentParts.gpu)
  const gameObj = gamesData.find((g) => g.id === gameId)

  const analysis = useMemo(
    () => (screen === 'results' && hasCore && gameObj
      ? systemUpgrades(currentParts, { game: gameObj, resolution, targetFps: fps }, upgradeBudget, partsData)
      : null),
    [screen, hasCore, gameObj, currentParts, resolution, fps, upgradeBudget, partsData],
  )

  function selectPart(part) { setCurrentParts((p) => ({ ...p, [part.category]: part })); setPickerCategory(null) }
  function deselect(category) { setCurrentParts((p) => { const n = { ...p }; delete n[category]; return n }) }
  function loadSaved(code) {
    const d = decodeBuild(code)
    if (!d) return
    setCurrentParts(d.parts)
    if (d.resolution) setResolution(d.resolution)
  }
  function toggleCat(cat) {
    setSelectedCats((prev) => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n })
  }

  function commit(nextParts, headline) {
    enterBuildTab()
    setBuild(nextParts)
    setStoreResolution(resolution)
    setLastGenerated(headline)
    setBudget(totalOf(currentParts) + upgradeBudget) // flips App → BuilderScreen on the Build tab
  }
  function apply(c) {
    commit({ ...currentParts, [c.category]: c.toPart }, {
      upgrade: true, gameName: gameObj?.name, quality: 'high',
      met: c.meetsGoal, estFps: c.resultFps, targetFps: fps,
    })
  }
  function applyPlan(plan) {
    let parts = { ...currentParts }
    const byCat = Object.fromEntries(plan.map((c) => [c.category, c]))
    for (const cat of APPLY_ORDER) {
      const c = byCat[cat]
      if (c && checkCompatibility(parts, c.toPart).compatible) parts = { ...parts, [cat]: c.toPart }
    }
    const perf = plan.find((c) => c.resultFps != null)
    commit(parts, {
      upgrade: true, gameName: gameObj?.name, quality: 'high',
      met: perf?.meetsGoal, estFps: perf?.resultFps, targetFps: fps,
    })
  }

  const catCandidates = (cat) => {
    const list = analysis?.byCat[cat] ?? []
    return (cat === 'cpu' || cat === 'gpu') ? sortCandidates(list, sortKey) : list
  }
  const plan = analysis && path === 'unsure' ? buildPlan(analysis) : []
  const highSeverity = analysis ? analysis.deficiencies.filter((d) => d.severity === 'high') : []

  const activeLabel = screen === 'specs' ? 'Current PC'
    : screen === 'highlight' ? 'Choose parts'
    : screen === 'goal' ? 'Goal'
    : path === 'select' ? 'Upgrades' : 'Diagnosis'
  const steps = path === 'select' ? ['Current PC', 'Choose parts', 'Goal', 'Upgrades']
    : path === 'unsure' ? ['Current PC', 'Goal', 'Diagnosis']
    : ['Current PC']

  return (
    <div className="relative min-h-screen flex flex-col items-center text-white bg-[#05080f] py-12">
      <Backdrop />
      <div className="relative z-10 w-full max-w-2xl px-4">
        <h1 className="text-3xl font-bold mb-1 text-center">Upgrade your PC</h1>
        <ol className="flex items-center justify-center gap-2 mb-8 text-[11px] uppercase tracking-wider">
          {steps.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <span className="text-slate-700">→</span>}
              <span className={activeLabel === label ? 'text-cyan-300' : 'text-slate-500'}>{i + 1} {label}</span>
            </li>
          ))}
        </ol>

        {screen === 'specs' && (
          <div className={`${PANEL} p-5`}>
            <div className="inline-flex rounded-sm border border-slate-800/60 p-0.5 mb-4">
              <button onClick={() => setTab('build')} className={`px-3 py-1 text-xs rounded-sm ${tab === 'build' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}>Build current PC</button>
              <button onClick={() => setTab('saved')} className={`px-3 py-1 text-xs rounded-sm ${tab === 'saved' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}>Select saved build</button>
            </div>

            {tab === 'build' ? (
              <CategoryList selectedParts={currentParts} onSelectCategory={setPickerCategory} onDeselect={deselect} />
            ) : saved.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No saved builds yet. Build one first, or use the "Build current PC" tab.</p>
            ) : (
              <div className="space-y-1">
                {saved.map((b) => (
                  <button key={b.id} onClick={() => loadSaved(b.code)} className="w-full flex items-center justify-between border-t border-slate-800/50 py-2 text-left hover:text-cyan-300">
                    <span className="text-sm text-slate-100">{b.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{new Date(b.savedAt).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-500 mt-4">CPU and GPU are required — they drive the estimate.</p>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={() => { setPath('select'); setScreen('highlight') }}
                disabled={!hasCore}
                className={`${BTN_PRIMARY} px-5 py-2 rounded-sm text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
              >
                Select what I want to upgrade →
              </button>
              <button
                onClick={() => { setPath('unsure'); setScreen('goal') }}
                disabled={!hasCore}
                className="px-5 py-2 rounded-sm border border-slate-700/70 text-slate-200 text-sm hover:border-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                I'm unsure of my upgrade path →
              </button>
            </div>
            <button onClick={onBack} className="mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back to menu</button>
          </div>
        )}

        {screen === 'highlight' && (
          <div className={`${PANEL} p-5`}>
            <p className="text-sm text-slate-300 mb-4">Tap the parts you'd like to upgrade.</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(currentParts).map((cat) => {
                const on = selectedCats.has(cat)
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCat(cat)}
                    aria-pressed={on}
                    className={`px-3 py-2 rounded-sm border text-left text-sm transition-colors
                      ${on ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}
                  >
                    <span className="uppercase text-[10px] text-slate-500 block">{CAT_LABEL[cat] ?? cat}</span>
                    {currentParts[cat].name}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={() => setScreen('goal')}
                disabled={selectedCats.size === 0}
                className={`${BTN_PRIMARY} px-6 py-2 rounded-sm text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
              >
                Continue →
              </button>
              <button onClick={() => setScreen('specs')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Current PC</button>
            </div>
          </div>
        )}

        {screen === 'goal' && (
          <div className={`${PANEL} p-5`}>
            <div className="flex items-center gap-3 mb-5">
              <label htmlFor="upgrade-game" className="text-sm text-slate-400">Game</label>
              <select id="upgrade-game" value={gameId} onChange={(e) => setGameId(e.target.value)} className="bg-slate-950/60 border border-slate-700/70 rounded-sm text-sm text-slate-100 px-3 py-2 focus:outline-none focus:border-cyan-400">
                {gamesData.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {RES_OPTIONS.map((r) => (
                <button key={r.id} onClick={() => setResolution(r.id)} aria-pressed={resolution === r.id}
                  className={`px-4 py-2 rounded-sm border text-sm transition-colors ${resolution === r.id ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {TARGETS.map((t) => (
                <button key={t} onClick={() => setFps(t)} aria-pressed={fps === t}
                  className={`px-4 py-2 rounded-sm border font-mono text-sm transition-colors ${fps === t ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}>
                  {t} fps
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setScreen('results')} className={`${BTN_PRIMARY} px-6 py-2 rounded-sm text-sm font-medium transition-colors`}>See upgrades</button>
              <button onClick={() => setScreen(path === 'select' ? 'highlight' : 'specs')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back</button>
            </div>
          </div>
        )}

        {screen === 'results' && analysis && (
          <div className={`${PANEL} p-5`}>
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <label htmlFor="upgrade-budget" className="text-slate-400">Upgrade budget</label>
                <span className={`${TELEMETRY} text-cyan-300`}>£{upgradeBudget}</span>
              </div>
              <input id="upgrade-budget" type="range" min="0" max="2000" step="50" value={upgradeBudget} onChange={(e) => setUpgradeBudget(Number(e.target.value))} className="w-full accent-cyan-500" />
            </div>
            <div className="flex gap-2 mb-4">
              {SORT_LABELS.map((s) => (
                <button key={s.key} onClick={() => setSortKey(s.key)} aria-pressed={sortKey === s.key}
                  className={`px-3 py-1.5 rounded-sm border text-xs transition-colors ${sortKey === s.key ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700/70 text-slate-300 hover:border-slate-500'}`}>
                  {s.label}
                </button>
              ))}
            </div>

            {path === 'select' ? (
              <div className="space-y-5">
                {[...selectedCats].map((cat) => {
                  const list = catCandidates(cat)
                  return (
                    <section key={cat}>
                      <h3 className="text-sm text-white font-semibold mb-2">{CAT_LABEL[cat] ?? cat}</h3>
                      {NON_UPGRADEABLE.has(cat) ? (
                        <p className="text-xs text-slate-400">This part doesn't change performance — swap it directly in the Build tab if you want a different one.</p>
                      ) : list.length === 0 ? (
                        <p className="text-xs text-slate-400">Your {CAT_LABEL[cat] ?? cat} is already well-specced for this goal.</p>
                      ) : (
                        <div className="space-y-2">
                          {list.map((c) => <CandidateCard key={`${c.category}-${c.toPart.id}`} c={c} targetFps={fps} onApply={() => apply(c)} />)}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-5">
                <section>
                  <h3 className="text-sm text-white font-semibold mb-2">The limiter</h3>
                  {analysis.bottleneck && (
                    <p className="text-xs text-slate-300 mb-2">{analysis.bottleneck.verdict}</p>
                  )}
                  {highSeverity.length === 0 ? (
                    <p className="text-xs text-emerald-300">Nothing's holding this build back at your target — it's well balanced.</p>
                  ) : (
                    <div className="space-y-1">
                      {highSeverity.map((d) => (
                        <p key={`${d.category}-${d.reason}`} className="text-xs text-amber-200 border border-amber-500/40 bg-amber-500/10 rounded-sm px-3 py-2">{d.reason}</p>
                      ))}
                    </div>
                  )}
                </section>
                <section>
                  <h3 className="text-sm text-white font-semibold mb-2">The plan</h3>
                  {plan.length === 0 ? (
                    <p className="text-xs text-slate-400">No upgrade beats your current parts within £{upgradeBudget}. Try raising the budget.</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {plan.map((c) => <CandidateCard key={`${c.category}-${c.toPart.id}`} c={c} targetFps={fps} onApply={() => apply(c)} />)}
                      </div>
                      <button onClick={() => applyPlan(plan)} className={`mt-3 w-full ${BTN_PRIMARY} text-sm font-medium py-2 rounded-sm transition-colors`}>
                        Apply all recommended
                      </button>
                    </>
                  )}
                </section>
              </div>
            )}

            <button onClick={() => setScreen('goal')} className="mt-5 text-xs text-slate-500 hover:text-slate-300 transition-colors">← Goal</button>
          </div>
        )}
      </div>

      {pickerCategory && (
        <PartSelector category={pickerCategory} contextParts={currentParts} ignoreBudget onSelect={selectPart} onClose={() => setPickerCategory(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test file to verify it passes**

Run: `npm run test:run -- src/tests/UpgradeWizard.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite + lint**

Run: `npm run test:run`
Expected: all green (no regressions).
Run: `npm run lint`
Expected: no NEW errors (2 pre-existing `SpecSheet.jsx` errors are unrelated and allowed).

- [ ] **Step 6: Commit**

```bash
git add src/components/UpgradeWizard.jsx src/tests/UpgradeWizard.test.jsx
git commit -m "feat: two-path Upgrade wizard (select-parts vs diagnosis)"
```

---

## Final review

After all tasks, dispatch a code-reviewer over the whole diff (Tasks 1–5) and confirm:
- `systemUpgrades` never fabricates rankings for `case`/`motherboard`/`fans`.
- Path A filters strictly to `selectedCats`; Path B's `applyPlan` sizes PSU last and skips incompatible swaps.
- No regression in the 286 existing tests; lint clean except the 2 known `SpecSheet.jsx` errors.
- Then proceed to Plan 2 (`2026-07-06-new-pc-flow-v2.md`).

## Notes for the implementer

- `checkCompatibility(selectedParts, candidate)` returns `{ compatible, ... }`.
- `sortCandidates(list, 'value'|'gain'|'cost')` sorts CPU/GPU candidate objects; supporting candidates are pre-sorted by cost inside `systemUpgrades`.
- Do not touch `upgradeCandidates`, `suggestUpgrade`, `computeBottleneck`, or `targetBuild` — reuse only.
- "Apply all recommended" always shows on Path B when the plan is non-empty; a single-item plan still applies through `applyPlan` for consistent store writes (each card also has its own Apply).
```
