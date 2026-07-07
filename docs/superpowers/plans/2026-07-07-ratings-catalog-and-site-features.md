# Ratings synergy, catalog expansion, prebuild→use-case & site pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make part ratings model real pairwise/system synergy (not just CPU↔GPU), grow the catalog by ~50 parts, route prebuilds through the use-case step, and add four real site pages (Feedback, Help, Parts browser, Glossary).

**Architecture:** A new `partSynergy.js` supplies each part's "works-together" cap + a plain-English reason; `rateBuild` consumes it. Catalog grows in `partsData.json` and the live Supabase `parts` table (kept in sync). Prebuild tiers become budget presets that advance to the use-case step. A tiny hash router (`usePageRoute`) renders four content pages inside a shared `SiteChrome`; feedback POSTs to a new insert-only Supabase `feedback` table.

**Tech Stack:** React 19 + Vite, Zustand, Tailwind, Vitest + Testing Library, Supabase REST (plain `fetch`), lucide-react.

**Conventions:** Node is at `C:\Program Files\nodejs` — in PowerShell it's on PATH; in the Bash tool prepend `export PATH="/c/Program Files/nodejs:$PATH"`. Run tests with `npx vitest run <path>`. Work on `main`, commit per task, **do not push** (user pushes/deploys manually). Supabase project ref: `igeggndtnmdpauxovnwv`.

---

## Phase 1 — Ratings synergy layer

### Task 1: Add per-use-case `needs` table to build profiles

**Files:**
- Modify: `src/lib/buildProfiles.js`
- Test: `src/tests/buildProfiles.test.js` (create)

- [ ] **Step 1: Write the failing test**

```js
// src/tests/buildProfiles.test.js
import { describe, it, expect } from 'vitest'
import { BUILD_PROFILES } from '../lib/buildProfiles'

describe('build profiles needs', () => {
  it('every profile has ramGb/storageGb/vram targets', () => {
    for (const [id, p] of Object.entries(BUILD_PROFILES)) {
      expect(p.needs, id).toBeTruthy()
      expect(p.needs.ramGb, id).toBeGreaterThan(0)
      expect(p.needs.storageGb, id).toBeGreaterThan(0)
      expect(p.needs.vram, id).toBeGreaterThan(0)
    }
  })
  it('creation wants more RAM and VRAM than office', () => {
    expect(BUILD_PROFILES.creation.needs.ramGb).toBeGreaterThan(BUILD_PROFILES.office.needs.ramGb)
    expect(BUILD_PROFILES.creation.needs.vram).toBeGreaterThan(BUILD_PROFILES.office.needs.vram)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/buildProfiles.test.js`
Expected: FAIL (`p.needs` is undefined).

- [ ] **Step 3: Add a `needs` line to each profile**

In `src/lib/buildProfiles.js`, add a `needs:` entry to each of the five profiles (place it after `expect:`):

```js
  gaming: {
    weights:      { cpu: .18, gpu: .32, motherboard: .11, ram: .08, storage: .07, psu: .07, case: .08, cooler: .06, fans: .03 },
    expect:       { cpu: 68,  gpu: 75,  motherboard: 35,  ram: 45,  storage: 40,  psu: 45,  case: 30,  cooler: 45,  fans: 30 },
    needs:        { ramGb: 16, storageGb: 1000, vram: 8 },
    upgradeOrder: ['gpu', 'cpu', 'storage', 'ram'], resolution: '1440p',
  },
  office: {
    weights:      { cpu: .20, gpu: .14, motherboard: .11, ram: .10, storage: .14, psu: .08, case: .09, cooler: .08, fans: .06 },
    expect:       { cpu: 35,  gpu: 15,  motherboard: 30,  ram: 40,  storage: 45,  psu: 35,  case: 25,  cooler: 30,  fans: 20 },
    needs:        { ramGb: 16, storageGb: 500, vram: 2 },
    upgradeOrder: ['storage', 'ram', 'cpu'], resolution: '1080p',
  },
  creation: {
    weights:      { cpu: .26, gpu: .24, motherboard: .11, ram: .14, storage: .09, psu: .07, case: .05, cooler: .06, fans: .03 },
    expect:       { cpu: 70,  gpu: 65,  motherboard: 40,  ram: 70,  storage: 60,  psu: 50,  case: 30,  cooler: 55,  fans: 30 },
    needs:        { ramGb: 32, storageGb: 2000, vram: 16 },
    upgradeOrder: ['cpu', 'gpu', 'ram', 'storage'], resolution: '4k',
  },
  programming: {
    weights:      { cpu: .30, gpu: .14, motherboard: .11, ram: .16, storage: .11, psu: .06, case: .06, cooler: .06, fans: .03 },
    expect:       { cpu: 70,  gpu: 30,  motherboard: 35,  ram: 65,  storage: 55,  psu: 40,  case: 25,  cooler: 50,  fans: 20 },
    needs:        { ramGb: 32, storageGb: 1000, vram: 4 },
    upgradeOrder: ['cpu', 'ram', 'storage'], resolution: '1440p',
  },
  streaming: {
    weights:      { cpu: .24, gpu: .28, motherboard: .10, ram: .12, storage: .08, psu: .07, case: .04, cooler: .06, fans: .03 },
    expect:       { cpu: 68,  gpu: 70,  motherboard: 35,  ram: 50,  storage: 45,  psu: 50,  case: 30,  cooler: 50,  fans: 30 },
    needs:        { ramGb: 32, storageGb: 1000, vram: 8 },
    upgradeOrder: ['gpu', 'cpu', 'ram', 'storage'], resolution: '1440p',
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/buildProfiles.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/buildProfiles.js src/tests/buildProfiles.test.js
git commit -m "feat: per-use-case ram/storage/vram needs for synergy"
```

---

### Task 2: `partSynergy` module

**Files:**
- Create: `src/lib/partSynergy.js`
- Test: `src/tests/partSynergy.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/tests/partSynergy.test.js
import { describe, it, expect } from 'vitest'
import { partSynergy, coolerCapacityW, systemDrawW } from '../lib/partSynergy'

const cpuBig = { id: 'c', category: 'cpu', perfScore: 95, tdp: 170 }
const cpuTiny = { id: 'ct', category: 'cpu', perfScore: 20, tdp: 65 }
const gpuBig = { id: 'g', category: 'gpu', perfScore: 100, tdp: 450, specs: { vram: 8 } }

describe('helpers', () => {
  it('systemDrawW sums tdp of present parts', () => {
    expect(systemDrawW({ cpu: cpuBig, gpu: gpuBig })).toBe(620)
  })
  it('coolerCapacityW rates AIO by radiator and air by height', () => {
    expect(coolerCapacityW({ specs: { type: 'AIO', radiator: '360mm' } })).toBe(320)
    expect(coolerCapacityW({ specs: { type: 'Air', height: 165 } })).toBe(220)
    expect(coolerCapacityW({ specs: {} })).toBe(0)
  })
})

describe('partSynergy', () => {
  it('caps a tiny CPU behind a big GPU but floors it at 25 (gaming)', () => {
    const s = partSynergy({ cpu: cpuTiny, gpu: gpuBig }, 'cpu', 'gaming')
    expect(s.balance).toBeGreaterThanOrEqual(25)
    expect(s.balance).toBeLessThan(60)
    expect(s.reason).toMatch(/bottleneck/i)
  })
  it('flags low VRAM on the GPU for creation', () => {
    const s = partSynergy({ cpu: cpuBig, gpu: gpuBig }, 'gpu', 'creation')
    expect(s.balance).toBeLessThan(60) // 8GB vs 16 target -> 50
    expect(s.reason).toMatch(/vram/i)
  })
  it('flags low RAM capacity for programming', () => {
    const s = partSynergy({ cpu: cpuBig, gpu: gpuBig, ram: { category: 'ram', capacityGb: 8 } }, 'ram', 'programming')
    expect(s.balance).toBe(25) // 8/32
    expect(s.reason).toMatch(/ram/i)
  })
  it('flags a PSU with no headroom', () => {
    const s = partSynergy({ cpu: cpuBig, gpu: gpuBig, psu: { category: 'psu', wattage: 600 } }, 'psu', 'gaming')
    expect(s.balance).toBeLessThan(100) // 600 vs 620*1.3=806
    expect(s.reason).toMatch(/headroom/i)
  })
  it('flags an undersized cooler for the CPU', () => {
    const s = partSynergy({ cpu: cpuBig, gpu: gpuBig, cooler: { category: 'cooler', specs: { type: 'Air', height: 100 } } }, 'cooler', 'gaming')
    expect(s.balance).toBeLessThan(100) // 80W cap vs 170W CPU
    expect(s.reason).toMatch(/undersized/i)
  })
  it('never penalises missing metadata (GPU with no vram field)', () => {
    const s = partSynergy({ cpu: cpuBig, gpu: { category: 'gpu', perfScore: 100, tdp: 300 } }, 'gpu', 'creation')
    expect(s.balance).toBe(100)
  })
  it('returns null for categories with no pairwise partner (case)', () => {
    expect(partSynergy({ cpu: cpuBig, gpu: gpuBig, case: { category: 'case' } }, 'case', 'gaming')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/partSynergy.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `partSynergy.js`**

```js
// src/lib/partSynergy.js
import { computeBottleneck } from './bottleneck'
import { BUILD_PROFILES, USE_CASE_LABEL } from './buildProfiles'

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const ratioPct = (have, target) => clamp(Math.round((100 * have) / target), 0, 100)

// A bottlenecked part is a weak link but still runs — floor it at 25, not 0.
const soften = (pct) => Math.round(25 + 0.75 * pct)

function radiatorMm(radiator) {
  const m = /(\d{2,3})/.exec(String(radiator ?? ''))
  return m ? Number(m[1]) : 0
}

// Rough heat-dissipation rating in watts. 0 = unknown (no penalty upstream).
export function coolerCapacityW(cooler) {
  const s = cooler?.specs ?? {}
  if (s.type === 'AIO') {
    const mm = radiatorMm(s.radiator)
    if (mm >= 360) return 320
    if (mm >= 280) return 260
    if (mm >= 240) return 220
    if (mm > 0) return 160
    return 0
  }
  const h = s.height ?? 0
  if (h <= 0) return 0
  if (h >= 160) return 220
  if (h >= 145) return 180
  if (h >= 120) return 130
  return 80
}

export function systemDrawW(parts) {
  return Object.values(parts).reduce((sum, p) => sum + (p?.tdp ?? 0), 0)
}

const OK = { balance: 100, reason: null }

// How well `category` pairs with the rest of the build for `useCase`.
// Returns { balance 0-100, reason string|null } for the six pairwise-scored
// categories, or null for categories with no strong partner (mobo/case/fans)
// so the caller can fall back to a tier comparison. Missing catalog metadata
// never lowers the score — an absent field yields 100.
export function partSynergy(parts, category, useCase) {
  const part = parts[category]
  if (!part) return OK
  const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
  const label = USE_CASE_LABEL[useCase] ?? 'this use'
  const needs = profile.needs ?? {}

  if (category === 'cpu' || category === 'gpu') {
    const bn = computeBottleneck(parts.cpu, parts.gpu, profile.resolution)
    let balance = 100
    let reason = null
    if (bn && bn.limitedBy === category) {
      balance = soften(bn.balancePct)
      reason = category === 'cpu'
        ? `Bottlenecks the ${parts.gpu?.name ?? 'GPU'} for ${label}`
        : `Held back by the ${parts.cpu?.name ?? 'CPU'}`
    }
    if (category === 'gpu' && typeof part.specs?.vram === 'number' && needs.vram) {
      const v = ratioPct(part.specs.vram, needs.vram)
      if (v < balance) {
        balance = v
        reason = `${part.specs.vram}GB VRAM is tight for ${label}`
      }
    }
    return { balance, reason }
  }

  if (category === 'ram') {
    if (!(part.capacityGb > 0) || !needs.ramGb) return OK
    const b = ratioPct(part.capacityGb, needs.ramGb)
    return { balance: b, reason: b < 100 ? `${part.capacityGb}GB RAM — ${label} wants ${needs.ramGb}GB+` : null }
  }

  if (category === 'storage') {
    const capB = part.capacityGb > 0 && needs.storageGb ? ratioPct(part.capacityGb, needs.storageGb) : 100
    const type = part.storageType ?? ''
    const heavy = useCase === 'gaming' || useCase === 'creation'
    const typeB = /HDD/i.test(type) ? (heavy ? 45 : 75) : /SATA/i.test(type) ? 85 : 100
    const balance = Math.min(capB, typeB)
    let reason = null
    if (typeB <= capB && typeB < 100) reason = 'A slow disk holds back load and scratch times'
    else if (capB < 100) reason = `Low capacity for ${label}`
    return { balance, reason }
  }

  if (category === 'psu') {
    const draw = systemDrawW(parts)
    if (!(part.wattage > 0) || draw <= 0) return OK
    const recommended = draw * 1.3
    const b = clamp(Math.round((100 * part.wattage) / recommended), 0, 100)
    return { balance: b, reason: b < 100 ? `Little headroom over a ${draw}W system draw` : null }
  }

  if (category === 'cooler') {
    const cap = coolerCapacityW(part)
    const tdp = parts.cpu?.tdp ?? 0
    if (cap <= 0 || tdp <= 0) return OK
    const b = clamp(Math.round((100 * cap) / tdp), 0, 100)
    return { balance: b, reason: b < 100 ? `Undersized for a ${tdp}W CPU` : null }
  }

  return null // motherboard / case / fans — no pairwise partner
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/partSynergy.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/partSynergy.js src/tests/partSynergy.test.js
git commit -m "feat: partSynergy — pairwise/system 'works together' scoring"
```

---

### Task 3: Wire `rateBuild` to the synergy layer + expose `reason`

**Files:**
- Modify: `src/lib/partRatings.js:27-63`
- Test: `src/tests/partRatings.test.js` (extend)

- [ ] **Step 1: Add a failing test for the surfaced reason**

Add these two `it` blocks inside the existing `describe('rateBuild', ...)` in `src/tests/partRatings.test.js` (they use the file's existing fixtures plus a low-VRAM GPU):

```js
  it('surfaces a synergy reason on a held-back part', () => {
    const gVram = { id: 'gv', category: 'gpu', perfScore: 400, price: 900, tdp: 300, length: 300, specs: { vram: 8 } }
    const cat = [cW, cM, cS, gW, gM, gVram, rS]
    const r = rateBuild({ cpu: cS, gpu: gVram, ram: rS }, 'creation', cat)
    expect(r.parts.gpu.reason).toMatch(/vram/i)
    expect(r.parts.gpu.score).toBeLessThan(80)
  })
  it('softens a severe CPU bottleneck instead of zeroing balance', () => {
    // cM has a non-zero level, so its score reflects the softened balance floor.
    const r = rateBuild({ cpu: cM, gpu: gS }, 'gaming', ratingCatalog)
    expect(r.parts.cpu.score).toBeGreaterThan(0)
    expect(r.parts.cpu.score).toBeLessThan(r.parts.gpu.score)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/partRatings.test.js`
Expected: FAIL (`r.parts.gpu.reason` undefined).

- [ ] **Step 3: Rewrite the scoring loop in `rateBuild`**

In `src/lib/partRatings.js`, add the import and replace the per-part loop (lines ~46-57, the `const bn = ...` through the `for (const c of cats)` block that builds `out`). Keep `partLevel`, `verdictFor`, `partUpgradeOptions`, `D`, and the overall computation unchanged.

Add near the top imports:

```js
import { partSynergy } from './partSynergy'
```

Replace from `const bn = computeBottleneck(...)` through the end of the `out` loop with:

```js
  const out = {}
  for (const c of cats) {
    const adequacy = clamp(Math.round((100 * level[c]) / Math.max(expect[c] ?? 1, 1)), 0, 100)
    const syn = partSynergy(parts, c, useCase)
    let balance
    let synReason = null
    if (syn) {
      balance = syn.balance
      synReason = syn.reason
    } else {
      balance = clamp(Math.round((100 * level[c]) / Math.max(D, 1)), 0, 100)
    }
    const score = Math.round(Math.min(adequacy, balance))
    const reason = balance < adequacy ? synReason : adequacy < 70 ? `Underpowered for ${label}` : null
    out[c] = { score, level: level[c], part: parts[c], isWeakLink: score < 70, reason }
  }
```

`computeBottleneck` is no longer used directly in `partRatings.js` — remove its now-unused import (line 2) if ESLint flags it.

- [ ] **Step 4: Run the full ratings + dashboard suites**

Run: `npx vitest run src/tests/partRatings.test.js src/tests/partSynergy.test.js`
Expected: PASS. If an older assertion (e.g. "mid build higher for office than gaming") drifts, adjust the relevant `expect`/`needs` numbers in `buildProfiles.js` and re-run — do not weaken the test's intent.

- [ ] **Step 5: Run the whole unit suite to catch downstream users of `rateBuild`**

Run: `npx vitest run`
Expected: PASS (UpgradeWizard consumes `rateBuild`; it now also gets `.reason`, which is additive).

- [ ] **Step 6: Commit**

```bash
git add src/lib/partRatings.js src/tests/partRatings.test.js
git commit -m "feat: rateBuild uses partSynergy + surfaces per-part reasons"
```

---

### Task 4: Show the "why" reason in the Upgrade dashboard

**Files:**
- Modify: `src/components/UpgradeWizard.jsx` (the part-row render)

- [ ] **Step 1: Locate the part-row render**

Run: `npx vitest run` is not needed here. Open `src/components/UpgradeWizard.jsx` and find where `rateBuild` results render each part row (search for `.score` and `isWeakLink`). Confirm the row has access to the rated object (which now includes `.reason`).

- [ ] **Step 2: Render the reason under the score bar**

In the part row, where the part name / score bar renders, add (adjust class names to match the surrounding rows):

```jsx
{rated.reason && (
  <p className="text-[11px] text-amber-300/80 mt-0.5">{rated.reason}</p>
)}
```

(`rated` = the per-part object from `rateBuild(...).parts[cat]`. Use whatever local variable the existing map uses.)

- [ ] **Step 3: Verify in the browser**

Use the preview workflow (`preview_start`, then drive: Upgrade your PC → build a CPU-limited rig such as a weak CPU + strong GPU → gaming). Confirm a reason line like "Bottlenecks the …" appears under the weak part. Screenshot for the summary.

- [ ] **Step 4: Commit**

```bash
git add src/components/UpgradeWizard.jsx
git commit -m "feat: show the synergy reason on each dashboard part row"
```

---

## Phase 2 — Catalog expansion

### Task 5: Add ~50 real parts to the JSON snapshot

**Files:**
- Modify: `src/data/partsData.json`
- Test: `src/tests/partsCatalog.test.js:48-56` (bump minimums)

- [ ] **Step 1: Inspect what already exists (avoid dup ids and unusable sockets)**

Run (Bash tool):

```bash
export PATH="/c/Program Files/nodejs:$PATH"
node -e "const p=require('./src/data/partsData.json');const by={};for(const x of p)by[x.category]=(by[x.category]||0)+1;console.log('counts',by);console.log('sockets',[...new Set(p.filter(x=>x.category==='cpu').map(x=>x.socket))]);console.log('mobo sockets',[...new Set(p.filter(x=>x.category==='motherboard').map(x=>x.socket))]);console.log('case ff',[...new Set(p.flatMap(x=>x.category==='case'?x.supportedFormFactors:[]))]);console.log('ids',p.map(x=>x.id).length,'unique',new Set(p.map(x=>x.id)).size)"
```

Note the existing CPU/mobo **sockets** and case **form factors**. Every new CPU must use a socket that a motherboard also uses (add a matching motherboard if you introduce a new socket), and every new motherboard `formFactor` must be in some case's `supportedFormFactors`.

- [ ] **Step 2: Append the new parts**

Add **~5 parts per category** (cpu, gpu, motherboard, ram, storage, psu, case, cooler, fans) and **~2** paste, following the exact existing object shape for each category. Rules:

- Unique `id` (kebab, e.g. `cpu-ryzen-7-9700x`), not already present.
- Real product names + curated `price` (GBP) consistent with neighbours.
- `perfScore` for cpu/gpu interpolated against existing parts on the current 0–100 scale (RTX 4090 = 100, Ryzen 9 7950X = 98). Do not exceed the current top unless the part genuinely beats it.
- `modelPath` = the same per-category `/models/*.glb` existing parts use.
- Keep every category-specific field the `partsCatalog.test.js` integrity test requires (cpu: `socket`,`perfScore`; gpu: `perfScore`,`length`; motherboard: `socket`,`ramType`,`formFactor`; ram: `ramType`,`capacityGb`; psu: `wattage`; case: `maxGpuLength`,`maxCoolerHeight`,`supportedFormFactors[]`; cooler: `sockets[]`). Include `tdp` on everything (psu/case/paste use 0), and `specs` where the category uses it (gpu `vram`/`memType`, cooler `type`/`height`|`radiator`, storage `readMbps`, etc.).

Two complete shape examples to copy:

```json
{ "id": "gpu-rtx-4070-super", "category": "gpu", "name": "NVIDIA GeForce RTX 4070 Super", "brand": "NVIDIA", "price": 599.99, "tdp": 220, "length": 305, "perfScore": 78, "modelPath": "/models/gpu.glb", "specs": { "vram": 12, "memType": "GDDR6X" } }
```

```json
{ "id": "cpu-ryzen-7-9700x", "category": "cpu", "name": "AMD Ryzen 7 9700X", "brand": "AMD", "price": 329.99, "socket": "AM5", "tdp": 65, "perfScore": 88, "modelPath": "/models/cpu.glb", "specs": { "cores": 8, "boostClock": 5.5 } }
```

Suggested additions (adjust to avoid ids already present in Step 1): CPUs — Ryzen 7 9700X, Ryzen 9 9950X, Ryzen 5 9600X, Core i5-14600K, Core i7-14700K. GPUs — RTX 4070 Super (12GB), RTX 4070 Ti Super (16GB), RTX 4060 (8GB), RX 7800 XT (16GB), RX 7600 (8GB). Motherboards — a B650 (AM5/DDR5/ATX), B650 mATX, X670 ATX, plus two matching the existing Intel socket. RAM — DDR5-6000 32GB, DDR5-6000 64GB, DDR5-5200 16GB, plus two DDR4 kits matching existing DDR4 boards. Storage — 1TB NVMe, 4TB NVMe, 2TB SATA SSD, 2TB HDD, 4TB HDD (set `storageType` to `NVMe SSD` / `SATA SSD` / `HDD` and `specs.readMbps` accordingly, HDD ~200). PSU — 650W/750W/850W/1200W across 80+ Gold/Platinum. Cases — one mATX, one ITX, two ATX with varied `maxGpuLength`/`maxCoolerHeight`. Coolers — a 240mm AIO, a 360mm AIO, a low-profile air (height ~55), a tower air (height ~158). Fans — a 140mm triple pack, an RGB 120mm triple. Paste — Thermal Grizzly Kryonaut, Noctua NT-H2.

- [ ] **Step 3: Bump the catalog minimums**

In `src/tests/partsCatalog.test.js`, raise each `minimums` value to the new per-category count from a fresh count:

```bash
export PATH="/c/Program Files/nodejs:$PATH"
node -e "const p=require('./src/data/partsData.json');const by={};for(const x of p)by[x.category]=(by[x.category]||0)+1;console.log(by)"
```

Set each `minimums[cat]` to exactly the printed count.

- [ ] **Step 4: Run catalog + build integrity tests**

Run: `npx vitest run src/tests/partsCatalog.test.js src/tests/tiers.test.js src/tests/compatibility.test.js`
Expected: PASS (unique ids, required fields present, tiers still generate compatible in-budget builds).

- [ ] **Step 5: Commit**

```bash
git add src/data/partsData.json src/tests/partsCatalog.test.js
git commit -m "feat: expand catalog with ~50 real parts across all categories"
```

---

### Task 6: Mirror the new parts into the live Supabase `parts` table

**Files:** none (DB migration via Supabase management tools).

- [ ] **Step 1: Generate INSERT SQL from the new rows**

Compute the set of parts in `partsData.json` that are **not yet** in the DB. Simplest: the new ids added in Task 5. Generate one `insert` with the full object in `data`:

```bash
export PATH="/c/Program Files/nodejs:$PATH"
node -e "
const all=require('./src/data/partsData.json');
const NEW_IDS=require('./scratch-new-ids.json'); // array of the ids you added
const rows=all.filter(p=>NEW_IDS.includes(p.id));
const vals=rows.map(p=>\`('\${p.id}', \$\$\${p.name}\$\$, '\${p.category}', \${p.price}, '\${JSON.stringify(p).replace(/'/g,\"''\")}'::jsonb)\`).join(',\n');
console.log('insert into public.parts (id,name,category,price,data) values\n'+vals+'\non conflict (id) do nothing;');
" > scratch-insert.sql
```

(Write the ids you added to `scratch-new-ids.json` first; both scratch files live in the scratchpad, not the repo.)

- [ ] **Step 2: Apply the migration**

Load the Supabase tool schema, then apply the SQL from Step 1:

- `ToolSearch` query `select:mcp__51f89bb7-2a4d-409b-9c71-f0411ea95252__apply_migration,mcp__51f89bb7-2a4d-409b-9c71-f0411ea95252__execute_sql`
- Call `apply_migration` with `project_id: igeggndtnmdpauxovnwv`, `name: add_parts_2026_07`, `query:` the generated insert SQL.

- [ ] **Step 3: Verify DB ≡ JSON (count + price-sum)**

Call `execute_sql` with `project_id: igeggndtnmdpauxovnwv`,
`query: select count(*)::int as n, round(sum(price)::numeric,2) as total from public.parts;`

Compare to JSON:

```bash
export PATH="/c/Program Files/nodejs:$PATH"
node -e "const p=require('./src/data/partsData.json');console.log(p.length, p.reduce((s,x)=>s+x.price,0).toFixed(2))"
```

Both `n` and `total` must match the JSON count and price sum. If not, reconcile before continuing.

- [ ] **Step 4: Commit (no repo change — record the sync in the message of a no-op or skip)**

No repo files changed. Note the sync in the next commit or with an empty marker commit is unnecessary — proceed to Phase 3. (The JSON snapshot committed in Task 5 is the record.)

---

## Phase 3 — Prebuilds route through use case

### Task 7: Turn tiers into budget presets

**Files:**
- Modify: `src/lib/tiers.js`
- Test: `src/tests/tiers.test.js` (rewrite)

- [ ] **Step 1: Rewrite the tiers test**

Replace `src/tests/tiers.test.js` with:

```js
import { describe, it, expect } from 'vitest'
import { TIERS } from '../lib/tiers'

describe('tiers', () => {
  it('are budget presets in ascending order with no fixed use case', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['budget', 'mainstream', 'ultimate'])
    for (const t of TIERS) {
      expect(t.budget).toBeGreaterThan(0)
      expect(typeof t.label).toBe('string')
      expect(t).not.toHaveProperty('useCase')
    }
    const budgets = TIERS.map((t) => t.budget)
    expect([...budgets].sort((a, b) => a - b)).toEqual(budgets)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/tiers.test.js`
Expected: FAIL (`useCase` still present, `partsForTier` import removed).

- [ ] **Step 3: Simplify `tiers.js`**

Replace `src/lib/tiers.js` with:

```js
// Quick-start budget presets. Selecting one fills the budget and advances to
// the use-case step — the actual parts depend on the use case the user then
// picks, so £900 gaming ≠ £900 office.
export const TIERS = [
  { id: 'budget',     label: 'Entry',     budget: 900 },
  { id: 'mainstream', label: 'Mid',       budget: 1700 },
  { id: 'ultimate',   label: 'High-end',  budget: 3800 },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/tiers.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tiers.js src/tests/tiers.test.js
git commit -m "refactor: tiers are budget presets (no fixed use case)"
```

---

### Task 8: BudgetEntry — tier click advances to the use-case step

**Files:**
- Modify: `src/components/BudgetEntry.jsx`
- Test: `src/tests/BudgetEntry.test.jsx` (update the tier test)

- [ ] **Step 1: Update the tier test**

In `src/tests/BudgetEntry.test.jsx`, replace the last test (`'a quick-start tier applies a generated build and its budget'`) with:

```js
  it('a budget preset prefills the budget and jumps to the use-case step', () => {
    render(<BudgetEntry onSubmit={() => {}} onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /entry · £900/i }))
    expect(screen.getByText(/what will you use/i)).toBeInTheDocument()
  })

  it('same budget, different use case yields different builds', () => {
    const onSubmit = vi.fn()
    const { unmount } = render(<BudgetEntry onSubmit={onSubmit} onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /entry · £900/i }))
    fireEvent.click(screen.getByRole('button', { name: /gaming/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate build/i }))
    const gamingGpu = useBuilderStore.getState().selectedParts.gpu?.id
    unmount()
    useBuilderStore.setState({ budget: 0, selectedParts: {}, resolution: '1440p' })
    render(<BudgetEntry onSubmit={onSubmit} onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /entry · £900/i }))
    fireEvent.click(screen.getByRole('button', { name: /everyday & office/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate build/i }))
    const officeGpu = useBuilderStore.getState().selectedParts.gpu?.id
    expect(gamingGpu).not.toBe(officeGpu)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/BudgetEntry.test.jsx`
Expected: FAIL (tier still instant-builds; no `entry · £900` button label).

- [ ] **Step 3: Update `BudgetEntry.jsx`**

- Change the import `import { TIERS, partsForTier } from '../lib/tiers'` to `import { TIERS } from '../lib/tiers'`.
- Delete the `tierBuilds` `useMemo` and the `applyTier` function.
- Remove the now-unused imports if they become unused (`partsForTier`; keep `buildForUseCase`, `useCatalogStore`, etc.).
- Replace the tier chip block (the `{tierBuilds.map(...)}` list) with:

```jsx
            <div className="rise rise-3 mt-8 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-slate-500">or start from a preset:</span>
              {TIERS.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => { setValue(String(tier.budget)); setStep(2) }}
                  className="text-xs font-mono px-3 py-1.5 rounded-sm border border-slate-700/70 text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {tier.label} · £{tier.budget}
                </button>
              ))}
            </div>
```

Note: `generate()` and `startEmpty()` use `budgetNum = parseFloat(value)`, so setting `value` from the preset makes them work unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/BudgetEntry.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/BudgetEntry.jsx src/tests/BudgetEntry.test.jsx
git commit -m "feat: budget presets advance to the use-case step"
```

---

## Phase 4 — Site pages + routing

### Task 9: `usePageRoute` hash router hook

**Files:**
- Create: `src/hooks/usePageRoute.js`
- Test: `src/tests/usePageRoute.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/tests/usePageRoute.test.js
import { renderHook, act } from '@testing-library/react'
import { usePageRoute } from '../hooks/usePageRoute'

beforeEach(() => { window.location.hash = '' })

describe('usePageRoute', () => {
  it('is null with no hash and for builder view hashes', () => {
    window.location.hash = '#build'
    const { result } = renderHook(() => usePageRoute())
    expect(result.current.page).toBeNull()
  })
  it('reads a content page from #/help', () => {
    window.location.hash = '#/help'
    const { result } = renderHook(() => usePageRoute())
    expect(result.current.page).toBe('help')
  })
  it('navigate sets and clears the hash', () => {
    const { result } = renderHook(() => usePageRoute())
    act(() => result.current.navigate('parts'))
    expect(window.location.hash).toBe('#/parts')
    expect(result.current.page).toBe('parts')
    act(() => result.current.navigate(null))
    expect(result.current.page).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/usePageRoute.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the hook**

```js
// src/hooks/usePageRoute.js
import { useEffect, useState } from 'react'

const PAGES = ['help', 'parts', 'glossary', 'feedback']

// Content pages use slashed hashes (#/help) so they never collide with the
// builder's single-word view hashes (#build, #summary) from useHashView.
const fromHash = () => {
  const h = window.location.hash.replace(/^#\/?/, '')
  return PAGES.includes(h) ? h : null
}

export function usePageRoute() {
  const [page, setPage] = useState(fromHash)
  useEffect(() => {
    const onHash = () => setPage(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const navigate = (p) => {
    window.location.hash = p ? `/${p}` : ''
    setPage(p ?? null)
  }
  return { page, navigate }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/usePageRoute.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePageRoute.js src/tests/usePageRoute.test.js
git commit -m "feat: usePageRoute hash router for content pages"
```

---

### Task 10: `SiteChrome` + `SiteFooter`, wire into `App.jsx`

**Files:**
- Create: `src/components/SiteChrome.jsx`, `src/components/SiteFooter.jsx`
- Modify: `src/App.jsx`, `src/components/MainMenu.jsx`

- [ ] **Step 1: Create `SiteFooter.jsx`**

```jsx
// src/components/SiteFooter.jsx
// Simple anchor nav — hrefs drive usePageRoute via hashchange, no prop drilling.
const LINKS = [
  { href: '#/help', label: 'Help & FAQ' },
  { href: '#/parts', label: 'Parts browser' },
  { href: '#/glossary', label: 'Glossary' },
  { href: '#/feedback', label: 'Feedback' },
]

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} className="hover:text-cyan-300 transition-colors">{l.label}</a>
        ))}
      </nav>
      <p className="mt-4">Prices are curated estimates (July 2026). Free · no sign-up.</p>
    </footer>
  )
}
```

- [ ] **Step 2: Create `SiteChrome.jsx`**

```jsx
// src/components/SiteChrome.jsx
import { ArrowLeft } from 'lucide-react'
import SiteFooter from './SiteFooter'

export default function SiteChrome({ onBack, children }) {
  return (
    <div className="min-h-screen bg-[#05080f] text-white">
      <header className="sticky top-0 z-40 bg-slate-950/70 backdrop-blur-md border-b border-slate-800/60 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-7 h-7 flex items-center justify-center rounded-sm border border-slate-800/60 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
        </button>
        <span className="font-bold text-lg tracking-tight">PC <span className="text-cyan-400">Builder</span></span>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  )
}
```

- [ ] **Step 3: Wire `App.jsx`**

Replace `src/App.jsx` with:

```jsx
import { useEffect } from 'react'
import BudgetEntry from './components/BudgetEntry'
import BuilderScreen from './screens/BuilderScreen'
import MainMenu from './components/MainMenu'
import UpgradeWizard from './components/UpgradeWizard'
import SiteChrome from './components/SiteChrome'
import HelpPage from './components/HelpPage'
import PartsBrowser from './components/PartsBrowser'
import GlossaryPage from './components/GlossaryPage'
import FeedbackPage from './components/FeedbackPage'
import useBuilderStore from './store/useBuilderStore'
import { loadCatalog } from './store/useCatalogStore'
import { usePageRoute } from './hooks/usePageRoute'

const PAGES = { help: HelpPage, parts: PartsBrowser, glossary: GlossaryPage, feedback: FeedbackPage }

export default function App() {
  const budget    = useBuilderStore((s) => s.budget)
  const setBudget = useBuilderStore((s) => s.setBudget)
  const flow      = useBuilderStore((s) => s.flow)
  const setFlow   = useBuilderStore((s) => s.setFlow)
  const { page, navigate } = usePageRoute()

  useEffect(() => { loadCatalog() }, [])

  if (page) {
    const Page = PAGES[page]
    return <SiteChrome onBack={() => navigate(null)}><Page /></SiteChrome>
  }
  if (budget > 0) return <BuilderScreen />
  if (flow === 'new')     return <BudgetEntry onSubmit={setBudget} onBack={() => setFlow('menu')} />
  if (flow === 'upgrade') return <UpgradeWizard onBack={() => setFlow('menu')} />
  return <MainMenu onNew={() => setFlow('new')} onUpgrade={() => setFlow('upgrade')} />
}
```

- [ ] **Step 4: Add the footer to `MainMenu.jsx`**

In `src/components/MainMenu.jsx`, import the footer and render it at the bottom of the outer div (after the buttons container, still inside the root `div`):

```jsx
import SiteFooter from './SiteFooter'
```

Add just before the final closing `</div></div>`:

```jsx
        <div className="w-full max-w-2xl"><SiteFooter /></div>
```

- [ ] **Step 5: Verify the app still builds and routes**

Run: `npx vitest run` (existing App/menu tests must still pass; page components are created in later tasks — if `npx vitest run` fails only because `HelpPage`/etc. don't exist yet, implement Tasks 11–16 before running the full suite, or temporarily verify with `npm run build` after those tasks). To keep this task self-contained, create minimal stub files now and flesh them out in their tasks:

```jsx
// src/components/HelpPage.jsx (stub — replaced in Task 14)
export default function HelpPage() { return <h1 className="text-2xl font-bold">Help</h1> }
```

Create equivalent one-line stubs for `PartsBrowser.jsx`, `GlossaryPage.jsx`, `FeedbackPage.jsx` so imports resolve.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/SiteChrome.jsx src/components/SiteFooter.jsx src/components/MainMenu.jsx src/components/HelpPage.jsx src/components/PartsBrowser.jsx src/components/GlossaryPage.jsx src/components/FeedbackPage.jsx
git commit -m "feat: hash-routed content pages via SiteChrome + footer nav"
```

---

### Task 11: Feedback validation + submit lib

**Files:**
- Modify: `src/lib/supabaseCatalog.js` (export URL/key)
- Create: `src/lib/feedback.js`
- Test: `src/tests/feedback.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/tests/feedback.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateFeedback, submitFeedback } from '../lib/feedback'

describe('validateFeedback', () => {
  it('accepts a complete valid entry', () => {
    expect(validateFeedback({ rating: 5, type: 'idea', message: 'Great tool' }).ok).toBe(true)
  })
  it('rejects a bad rating, type, empty message, and malformed email', () => {
    expect(validateFeedback({ rating: 0, type: 'idea', message: 'x' }).errors.rating).toBeTruthy()
    expect(validateFeedback({ rating: 5, type: 'nope', message: 'x' }).errors.type).toBeTruthy()
    expect(validateFeedback({ rating: 5, type: 'bug', message: '  ' }).errors.message).toBeTruthy()
    expect(validateFeedback({ rating: 5, type: 'bug', message: 'hi', email: 'bad' }).errors.email).toBeTruthy()
  })
  it('allows an omitted email', () => {
    expect(validateFeedback({ rating: 3, type: 'other', message: 'ok' }).ok).toBe(true)
  })
})

describe('submitFeedback', () => {
  beforeEach(() => { global.fetch = vi.fn().mockResolvedValue({ ok: true }) })
  it('POSTs a trimmed payload and resolves on success', async () => {
    await submitFeedback({ rating: 4, type: 'praise', message: '  nice  ', email: '' })
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toMatch(/\/rest\/v1\/feedback$/)
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body).toEqual({ rating: 4, type: 'praise', message: 'nice', email: null })
  })
  it('throws on an invalid entry without calling fetch', async () => {
    await expect(submitFeedback({ rating: 9, type: 'bug', message: 'x' })).rejects.toThrow()
    expect(global.fetch).not.toHaveBeenCalled()
  })
  it('throws on a non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    await expect(submitFeedback({ rating: 4, type: 'bug', message: 'x' })).rejects.toThrow(/500/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/feedback.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Export the Supabase URL/key**

In `src/lib/supabaseCatalog.js`, change the two `const SUPABASE_URL` / `const SUPABASE_KEY` declarations to `export const SUPABASE_URL` / `export const SUPABASE_KEY`.

- [ ] **Step 4: Implement `feedback.js`**

```js
// src/lib/feedback.js
import { SUPABASE_URL, SUPABASE_KEY } from './supabaseCatalog'

const TYPES = ['bug', 'idea', 'praise', 'other']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateFeedback({ rating, type, message, email } = {}) {
  const errors = {}
  if (!(Number.isInteger(rating) && rating >= 1 && rating <= 5)) errors.rating = 'Pick a rating from 1 to 5.'
  if (!TYPES.includes(type)) errors.type = 'Choose a category.'
  const msg = (message ?? '').trim()
  if (msg.length < 1) errors.message = 'Please write a short message.'
  else if (msg.length > 2000) errors.message = 'Keep it under 2000 characters.'
  if (email != null && email !== '') {
    if (!EMAIL_RE.test(email) || email.length > 200) errors.email = 'That email address looks off.'
  }
  return { ok: Object.keys(errors).length === 0, errors }
}

export async function submitFeedback(input) {
  if (!validateFeedback(input).ok) throw new Error('Invalid feedback')
  const email = input.email?.trim()
  const body = { rating: input.rating, type: input.type, message: input.message.trim(), email: email || null }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Feedback failed: HTTP ${res.status}`)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/tests/feedback.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabaseCatalog.js src/lib/feedback.js src/tests/feedback.test.js
git commit -m "feat: feedback validation + Supabase submit lib"
```

---

### Task 12: Create the Supabase `feedback` table (insert-only)

**Files:** none (DB migration).

- [ ] **Step 1: Apply the migration**

Load the tool schema if not already: `ToolSearch` query `select:mcp__51f89bb7-2a4d-409b-9c71-f0411ea95252__apply_migration,mcp__51f89bb7-2a4d-409b-9c71-f0411ea95252__execute_sql`.

Call `apply_migration` with `project_id: igeggndtnmdpauxovnwv`, `name: create_feedback_table`, `query`:

```sql
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  rating int check (rating between 1 and 5),
  type text check (type in ('bug','idea','praise','other')),
  message text not null check (char_length(message) between 1 and 2000),
  email text check (email is null or char_length(email) <= 200)
);
alter table public.feedback enable row level security;
create policy "anon can insert feedback" on public.feedback
  for insert to anon
  with check (char_length(message) between 1 and 2000);
```

- [ ] **Step 2: Verify insert works and read is blocked**

Call `execute_sql` (`project_id: igeggndtnmdpauxovnwv`):
`select policyname, cmd from pg_policies where tablename = 'feedback';`
Expected: exactly one policy, `cmd = INSERT`. (No SELECT policy ⇒ anon cannot read.)

- [ ] **Step 3: Live smoke via the public REST endpoint (optional)**

Confirm an anon insert returns 2xx and an anon select returns `[]` (RLS blocks reads):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST 'https://igeggndtnmdpauxovnwv.supabase.co/rest/v1/feedback' \
  -H "apikey: sb_publishable_Iu7O2Gu9K693IjISZb7GMw_CHtE5tvs" \
  -H "Authorization: Bearer sb_publishable_Iu7O2Gu9K693IjISZb7GMw_CHtE5tvs" \
  -H "Content-Type: application/json" -H "Prefer: return=minimal" \
  --data '{"rating":5,"type":"other","message":"plan smoke test"}'
```

Expected: `201`. Then a GET should return `[]`. (Delete the smoke row later via the dashboard/`execute_sql` if desired.)

---

### Task 13: FeedbackPage component

**Files:**
- Replace: `src/components/FeedbackPage.jsx` (stub from Task 10)
- Test: `src/tests/FeedbackPage.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/tests/FeedbackPage.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import FeedbackPage from '../components/FeedbackPage'
import * as feedback from '../lib/feedback'

it('submits valid feedback and shows a thank-you', async () => {
  const spy = vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  render(<FeedbackPage />)
  fireEvent.click(screen.getByRole('button', { name: /rate 5/i }))
  fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Really useful' } })
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))
  await waitFor(() => expect(screen.getByText(/thank/i)).toBeInTheDocument())
  expect(spy).toHaveBeenCalled()
})

it('blocks submit and shows an error when the message is empty', () => {
  const spy = vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  render(<FeedbackPage />)
  fireEvent.click(screen.getByRole('button', { name: /rate 4/i }))
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))
  expect(screen.getByText(/short message/i)).toBeInTheDocument()
  expect(spy).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/FeedbackPage.test.jsx`
Expected: FAIL (stub has no form).

- [ ] **Step 3: Implement `FeedbackPage.jsx`**

```jsx
// src/components/FeedbackPage.jsx
import { useState } from 'react'
import { Star } from 'lucide-react'
import { validateFeedback, submitFeedback } from '../lib/feedback'

const TYPES = [
  { id: 'idea', label: 'Idea' },
  { id: 'bug', label: 'Bug' },
  { id: 'praise', label: 'Praise' },
  { id: 'other', label: 'Other' },
]

export default function FeedbackPage() {
  const [rating, setRating] = useState(0)
  const [type, setType] = useState('idea')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | done | error

  async function onSubmit(e) {
    e.preventDefault()
    const v = validateFeedback({ rating, type, message, email })
    setErrors(v.errors)
    if (!v.ok) return
    if (company) { setStatus('done'); return } // bot filled the honeypot — silently succeed
    setStatus('sending')
    try {
      await submitFeedback({ rating, type, message, email })
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="text-center py-16">
        <h1 className="text-3xl font-bold mb-3">Thank you! 🙌</h1>
        <p className="text-slate-400">Your feedback helps make the builder better.</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Feedback</h1>
        <p className="text-slate-400 text-sm">Tell us what works, what doesn't, or what you'd like next.</p>
      </div>

      <div>
        <span className="block text-sm text-slate-300 mb-2">Your rating</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Rate ${n}`}
              onClick={() => setRating(n)}
              className="p-1"
            >
              <Star size={26} className={n <= rating ? 'fill-cyan-400 text-cyan-400' : 'text-slate-600'} />
            </button>
          ))}
        </div>
        {errors.rating && <p className="text-xs text-red-400 mt-1">{errors.rating}</p>}
      </div>

      <div>
        <span className="block text-sm text-slate-300 mb-2">Category</span>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={type === t.id}
              onClick={() => setType(t.id)}
              className={`px-3 py-1.5 rounded-sm border text-sm transition-colors ${type === t.id ? 'border-cyan-400 text-cyan-200 bg-cyan-500/15' : 'border-slate-700/70 text-slate-300 hover:border-cyan-400'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="fb-msg" className="block text-sm text-slate-300 mb-2">Message</label>
        <textarea
          id="fb-msg"
          value={message}
          maxLength={2000}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full bg-slate-950/60 border border-slate-700/70 rounded-sm px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
        />
        <div className="flex justify-between text-xs mt-1">
          <span className="text-red-400">{errors.message}</span>
          <span className="text-slate-500">{message.length}/2000</span>
        </div>
      </div>

      <div>
        <label htmlFor="fb-email" className="block text-sm text-slate-300 mb-2">Email <span className="text-slate-500">(optional, if you want a reply)</span></label>
        <input
          id="fb-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-slate-950/60 border border-slate-700/70 rounded-sm px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
        />
        {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
      </div>

      {/* Honeypot: hidden from humans, tempting to bots. */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />

      {status === 'error' && <p className="text-sm text-red-400">Something went wrong sending that. Please try again.</p>}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold px-8 py-3 rounded-sm transition-colors"
      >
        {status === 'sending' ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/FeedbackPage.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FeedbackPage.jsx src/tests/FeedbackPage.test.jsx
git commit -m "feat: feedback page with rating, category, honeypot"
```

---

### Task 14: `browseParts` lib + PartsBrowser page

**Files:**
- Create: `src/lib/browseParts.js`
- Replace: `src/components/PartsBrowser.jsx` (stub from Task 10)
- Test: `src/tests/browseParts.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/tests/browseParts.test.js
import { describe, it, expect } from 'vitest'
import { browseParts } from '../lib/browseParts'

const parts = [
  { id: 'a', category: 'cpu', name: 'Zen Chip', brand: 'AMD', price: 300, perfScore: 90 },
  { id: 'b', category: 'gpu', name: 'Big GPU', brand: 'NVIDIA', price: 900, perfScore: 100 },
  { id: 'c', category: 'cpu', name: 'Blue Chip', brand: 'Intel', price: 250, perfScore: 80 },
]

describe('browseParts', () => {
  it('filters by category', () => {
    expect(browseParts(parts, { category: 'cpu' }).map((p) => p.id)).toEqual(['c', 'a'])
  })
  it('searches name and brand case-insensitively', () => {
    expect(browseParts(parts, { query: 'intel' }).map((p) => p.id)).toEqual(['c'])
    expect(browseParts(parts, { query: 'gpu' }).map((p) => p.id)).toEqual(['b'])
  })
  it('sorts by price and performance', () => {
    expect(browseParts(parts, { sort: 'price-desc' }).map((p) => p.id)).toEqual(['b', 'a', 'c'])
    expect(browseParts(parts, { sort: 'perf' }).map((p) => p.id)).toEqual(['b', 'a', 'c'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/browseParts.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `browseParts.js`**

```js
// src/lib/browseParts.js
const SORTS = {
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  perf: (a, b) => (b.perfScore ?? 0) - (a.perfScore ?? 0),
  name: (a, b) => a.name.localeCompare(b.name),
}

export function browseParts(parts, { category = 'all', query = '', sort = 'price-asc' } = {}) {
  const q = query.trim().toLowerCase()
  const out = parts.filter((p) => {
    if (category !== 'all' && p.category !== category) return false
    if (q && !`${p.name} ${p.brand}`.toLowerCase().includes(q)) return false
    return true
  })
  return out.sort(SORTS[sort] ?? SORTS['price-asc'])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/browseParts.test.js`
Expected: PASS.

- [ ] **Step 5: Implement `PartsBrowser.jsx`**

```jsx
// src/components/PartsBrowser.jsx
import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import useCatalogStore from '../store/useCatalogStore'
import { browseParts } from '../lib/browseParts'
import { searchUrl } from '../lib/retailerLinks'

const CATEGORIES = ['all', 'cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans', 'paste']
const SORTS = [
  { id: 'price-asc', label: 'Price ↑' },
  { id: 'price-desc', label: 'Price ↓' },
  { id: 'perf', label: 'Performance' },
  { id: 'name', label: 'Name' },
]

export default function PartsBrowser() {
  const parts = useCatalogStore((s) => s.parts)
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('price-asc')

  const results = useMemo(() => browseParts(parts, { category, query, sort }), [parts, category, query, sort])

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Parts browser</h1>
      <p className="text-slate-400 text-sm mb-6">Explore every component in the catalog.</p>

      <div className="flex flex-wrap gap-2 mb-3">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`px-3 py-1 rounded-sm border text-xs capitalize transition-colors ${category === c ? 'border-cyan-400 text-cyan-200 bg-cyan-500/15' : 'border-slate-700/70 text-slate-300 hover:border-cyan-400'}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center mb-6">
        <input
          type="search"
          placeholder="Search name or brand…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-48 bg-slate-950/60 border border-slate-700/70 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort by"
          className="bg-slate-950/60 border border-slate-700/70 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
        >
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <p className="text-xs text-slate-500 mb-3">{results.length} parts</p>
      <ul className="space-y-2">
        {results.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 border border-slate-800/70 rounded-sm px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-white truncate">{p.name}</p>
              <p className="text-xs text-slate-500 capitalize">{p.category} · {p.brand}{p.perfScore ? ` · perf ${p.perfScore}` : ''}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-sm text-cyan-300">£{p.price.toFixed(2)}</span>
              <a href={searchUrl(p.name, p.brand)} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-cyan-300" aria-label={`Search ${p.name} on Amazon`}>
                <ExternalLink size={15} />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/browseParts.js src/components/PartsBrowser.jsx src/tests/browseParts.test.js
git commit -m "feat: parts browser page with filter/search/sort"
```

---

### Task 15: HelpPage content

**Files:**
- Replace: `src/components/HelpPage.jsx` (stub from Task 10)

- [ ] **Step 1: Implement `HelpPage.jsx`**

```jsx
// src/components/HelpPage.jsx
const FAQS = [
  { q: 'How does "Build a new PC" work?', a: 'Enter a budget and pick how you\'ll use the PC. We pick the strongest set of compatible parts that fits your budget for that use case — so the same budget produces a different build for gaming than for office work.' },
  { q: 'What do the use-case ratings mean?', a: 'Each part is scored out of 100 two ways: how well it suits your task, and how well it works with the rest of the build (a great GPU held back by a weak CPU, too little RAM, or an undersized PSU loses points). The lower of the two is the part\'s score, and we tell you what\'s holding it back.' },
  { q: 'How does "Upgrade your PC" work?', a: 'Enter your current parts (or load a saved build), choose a use case, and you get a ratings dashboard. Click any part to see cheaper-first upgrades that would raise its score — with the extra cost and, for gaming, the FPS gain.' },
  { q: 'Are the prices real?', a: 'Prices are curated estimates from July 2026, shown so builds compare sensibly. Use the "View on Amazon" links to check live pricing.' },
  { q: 'What does compatibility checking cover?', a: 'CPU/motherboard sockets, DDR4 vs DDR5, GPU length vs case, air-cooler height vs case, and PSU wattage headroom. Incompatible parts are shown locked with the reason.' },
  { q: 'Do I need an account?', a: 'No. It\'s free with no sign-up — your builds are saved in your browser only.' },
]

export default function HelpPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Help &amp; FAQ</h1>
      <p className="text-slate-400 text-sm mb-6">How the builder and upgrade tools work.</p>
      <div className="space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="group border border-slate-800/70 rounded-sm px-4 py-3">
            <summary className="cursor-pointer text-white font-medium list-none flex justify-between items-center">
              {f.q}
              <span className="text-slate-500 group-open:rotate-180 transition-transform">⌄</span>
            </summary>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it renders**

Run: `npx vitest run` (no dedicated test; ensure the suite still passes with the real component in place).

- [ ] **Step 3: Commit**

```bash
git add src/components/HelpPage.jsx
git commit -m "feat: Help & FAQ page content"
```

---

### Task 16: GlossaryPage + siteContent

**Files:**
- Create: `src/lib/siteContent.js`
- Replace: `src/components/GlossaryPage.jsx` (stub from Task 10)

- [ ] **Step 1: Create `siteContent.js`**

```js
// src/lib/siteContent.js
export const GLOSSARY = [
  { term: 'CPU', def: 'The processor — runs the operating system, games logic, compilers. More cores help multitasking, rendering and compiling; high clock speed helps single-threaded work and game frame rates.' },
  { term: 'GPU', def: 'The graphics card — renders games and accelerates video/AI work. The single biggest factor in gaming frame rates.' },
  { term: 'VRAM', def: 'Memory on the GPU. Higher resolutions, texture detail and creative workloads need more; 8GB is fine for 1080p, 16GB+ suits 4K and content creation.' },
  { term: 'TDP', def: 'Thermal Design Power (watts) — roughly how much heat a part makes and power it draws. Used to size the cooler and PSU.' },
  { term: 'Socket', def: 'The physical CPU-to-motherboard connector (e.g. AM5, LGA1700). The CPU and motherboard sockets must match.' },
  { term: 'Form factor', def: 'Board/case size class — ATX (large), mATX (medium), ITX (small). The case must support the motherboard\'s form factor.' },
  { term: 'DDR4 / DDR5', def: 'RAM generations. A motherboard supports one or the other, not both — match your RAM to the board.' },
  { term: 'NVMe SSD', def: 'The fastest common storage, plugged straight into the motherboard. Much quicker than SATA SSDs and far quicker than hard drives (HDDs).' },
  { term: 'PSU', def: 'Power supply. Should comfortably exceed the system\'s total draw — aim for ~30% headroom. 80+ Gold/Platinum ratings mean better efficiency.' },
  { term: 'AIO', def: 'All-in-one liquid cooler. Larger radiators (240/360mm) dissipate more heat and suit high-TDP CPUs; big air coolers are a quieter, simpler alternative.' },
]

export const BUYING_TIPS = [
  { cat: 'CPU', tip: 'Match to your task: gaming favours high clocks and 6–8 strong cores; creation, programming and streaming benefit from more cores. Make sure the socket matches your motherboard.' },
  { cat: 'GPU', tip: 'Buy the most GPU your budget allows for gaming and creation. Check it physically fits your case length, and that VRAM suits your resolution.' },
  { cat: 'RAM', tip: '16GB is the floor; 32GB is the sweet spot for creation, programming and streaming. Match DDR4/DDR5 to the board and buy two sticks for dual-channel.' },
  { cat: 'Storage', tip: 'A 1TB+ NVMe SSD as the main drive is the biggest felt speed-up. Add a big HDD only for cheap bulk storage.' },
  { cat: 'PSU', tip: 'Size it above your total draw with headroom for future upgrades, and prefer an 80+ Gold or better unit from a reputable brand.' },
  { cat: 'Cooler', tip: 'Match cooling to the CPU\'s TDP. A big air tower or a 240mm+ AIO for hot chips; check air-cooler height fits the case.' },
]
```

- [ ] **Step 2: Implement `GlossaryPage.jsx`**

```jsx
// src/components/GlossaryPage.jsx
import { GLOSSARY, BUYING_TIPS } from '../lib/siteContent'

export default function GlossaryPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Glossary &amp; buying guide</h1>
      <p className="text-slate-400 text-sm mb-6">Plain-English PC terms and how to choose each part.</p>

      <h2 className="text-lg font-semibold text-cyan-300 mb-3">Buying tips by part</h2>
      <div className="space-y-2 mb-10">
        {BUYING_TIPS.map((t) => (
          <div key={t.cat} className="border border-slate-800/70 rounded-sm px-4 py-3">
            <p className="text-white font-medium text-sm">{t.cat}</p>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">{t.tip}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-cyan-300 mb-3">Glossary</h2>
      <dl className="space-y-3">
        {GLOSSARY.map((g) => (
          <div key={g.term}>
            <dt className="text-white font-medium text-sm">{g.term}</dt>
            <dd className="text-sm text-slate-400 leading-relaxed">{g.def}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/siteContent.js src/components/GlossaryPage.jsx
git commit -m "feat: glossary & buying guide page"
```

---

### Task 17: Add a Feedback link to the builder TopBar

**Files:**
- Modify: `src/components/TopBar.jsx`

- [ ] **Step 1: Add an unobtrusive Feedback anchor**

In `src/components/TopBar.jsx`, add a link inside the header (e.g. just before the `<div className="hidden md:flex gap-6 ml-auto">` block, or append to it). Since the builder renders when `budget > 0` and content pages render above it via `usePageRoute`, an anchor is enough:

```jsx
      <a
        href="#/feedback"
        className="ml-auto md:ml-0 text-xs text-slate-400 hover:text-cyan-300 transition-colors"
      >
        Feedback
      </a>
```

Adjust `ml-auto` so the existing DynamicBars block stays right-aligned (keep `ml-auto` on whichever element should push right; if both, wrap them). Verify layout at 375px and desktop with the preview tools — the header must stay one row on mobile (a wrapped header covers the view tabs, per the known mobile gotcha).

- [ ] **Step 2: Verify in the browser**

Preview: in a build, click Feedback in the TopBar → the feedback page opens → Back returns to the in-progress build (parts still present).

- [ ] **Step 3: Commit**

```bash
git add src/components/TopBar.jsx
git commit -m "feat: feedback link in the builder top bar"
```

---

### Task 18: Full verification pass

- [ ] **Step 1: Run the whole unit suite**

Run: `npx vitest run`
Expected: all pass. Fix any regressions in the touched areas before proceeding.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean (watch for unused imports removed in Tasks 3 & 8, and the `use*`/rules-of-hooks gotcha — no new `use`-prefixed non-hook functions).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Browser walkthrough (preview tools)**

Drive each new/changed flow and screenshot for the summary:
1. Menu → footer links open Help, Parts, Glossary, Feedback; Back returns to menu.
2. New PC → a budget preset (Entry · £900) jumps to the use-case step; generate for gaming vs office yields visibly different builds.
3. Upgrade → a CPU-limited rig shows a synergy reason under the weak part.
4. Parts browser → category filter + search + sort work; a "View on Amazon" link opens.
5. Feedback → submit a test entry → thank-you screen (delete the test row via the Supabase dashboard afterwards).

- [ ] **Step 5: Final commit if any fixups were needed**

```bash
git add -A
git commit -m "chore: verification fixups for ratings/catalog/site-features"
```

---

## Notes for the executor

- **Do not push or deploy** — the user runs push+deploy manually (see the project's no-auto-push rule).
- **DB writes go to the live project** `igeggndtnmdpauxovnwv`; always verify DB≡JSON (count + price-sum) after the parts insert.
- If a ratings assertion needs a threshold nudge, tune `expect`/`needs`/`weights` in `buildProfiles.js` — never weaken a test's intent.
- The two scratch files in Task 6 (`scratch-new-ids.json`, `scratch-insert.sql`) belong in the scratchpad dir, not the repo.
