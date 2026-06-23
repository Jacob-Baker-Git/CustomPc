# Catalog Refresh + Real `brand` Field — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add current-gen parts (RTX 50, RX 9000, Ryzen 9000/Zen 5, Intel Core Ultra 200S incl. LGA1851 enablement) to the bundled catalog, give every part a real `brand` field, and surface a brand filter in the part-selection modal — without disturbing existing parts, prices, IDs, or field names.

**Architecture:** Pure-data change to `src/data/partsData.json` (append 25 parts; backfill `brand` on all non-paste parts via a one-shot, idempotent regex script; extend cooler `sockets` for LGA1851), plus three small logic/UI touches (`partFilter.js` gains an optional brand arg, `sortParts.js` gains a name tiebreak, `PartSelector.jsx` gains a brand `<select>`). `perfScore` stays anchor-preserving (new flagships exceed 100); the `fpsEstimate.js` comment is corrected. New data-integrity and filter tests guard the change.

**Tech Stack:** React 19 + Vite, Zustand, Vitest + @testing-library/react. Bundled static JSON (no runtime fetch). Spec: `docs/superpowers/specs/2026-06-23-catalog-refresh-brand-design.md`.

**Conventions (from CLAUDE.md):**
- Work on `main` locally. **Do NOT push** (push auto-deploys to production).
- Node isn't on PATH — every `npm`/`node` command in this plan is prefixed with `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; ` (PowerShell).
- Commit per task with a `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.
- Baseline before starting: **163 tests passing**, build clean.

---

## File Structure

- **Modify** `src/lib/fpsEstimate.js` — correct the "0–100 scale" comment (Task 1).
- **Create** `src/tests/partsData.test.js` — data-integrity guard (Task 2).
- **Modify** `src/data/partsData.json` — cooler sockets + 25 new parts + `brand` on every part (Task 2).
- **Modify** `src/lib/partFilter.js` + `src/tests/partFilter.test.js` — optional brand arg (Task 3).
- **Modify** `src/lib/sortParts.js` + `src/tests/sortParts.test.js` — same-brand name tiebreak (Task 4).
- **Modify** `src/components/PartSelector.jsx` + `src/tests/PartSelector.test.jsx` — brand `<select>` (Task 5).
- **Temp (never committed)** `backfill-brands.mjs` at repo root — one-shot brand backfill, deleted after use (Task 2).

---

## Task 1: Correct the perfScore scale comment

Pure documentation — no test. New flagships legitimately exceed the old 100 ceiling; the comment must not claim a hard 0–100 range.

**Files:**
- Modify: `src/lib/fpsEstimate.js:1-3`

- [ ] **Step 1: Edit the header comment**

Replace the first comment block:

```js
// Transparent FPS heuristic on the 0–100 perfScore scale. FPS is GPU-bound at
// higher resolutions; a weak CPU sets a frame ceiling that bites hardest at low
// resolution (mirrors the bottleneck model). Clearly an estimate, not a benchmark.
```

with:

```js
// Transparent FPS heuristic on the perfScore scale (~100 anchors last-gen
// flagships like the RTX 4090 / i9-14900K; current flagships exceed it). FPS is
// GPU-bound at higher resolutions; a weak CPU sets a frame ceiling that bites
// hardest at low resolution (mirrors the bottleneck model). An estimate, not a benchmark.
```

- [ ] **Step 2: Verify tests still pass (comment-only change)**

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run test:run -- src/tests/fpsEstimate.test.js`
Expected: PASS (unchanged behaviour).

- [ ] **Step 3: Commit**

```powershell
git add src/lib/fpsEstimate.js
git commit -m @'
docs: clarify perfScore is ~100-anchored, not capped at 100

Current-gen flagships (RTX 5090, Ryzen 9 9950X3D) score above 100 on the
existing relative ladder; fpsEstimate's heuristic and all other consumers
are relative/heuristic and handle that fine.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Task 2: Catalog data — new parts, `brand` on every part, LGA1851 enablement

This is the bulk of the work. TDD order: write the integrity test (RED), then make the data changes (GREEN). The `brand` backfill is done with a one-shot **idempotent** script so 188 records aren't hand-edited; the 25 new parts are appended **without** `brand` and pick it up from the same backfill (every new part's brand is derivable from its name).

**Files:**
- Create: `src/tests/partsData.test.js`
- Modify: `src/data/partsData.json`
- Temp: `backfill-brands.mjs` (repo root; deleted in Step 8)

- [ ] **Step 1: Write the failing data-integrity test**

Create `src/tests/partsData.test.js`:

```js
import { describe, it, expect } from 'vitest'
import partsData from '../data/partsData.json'

describe('partsData integrity', () => {
  it('gives every part a non-empty string brand', () => {
    const missing = partsData.filter(
      (p) => typeof p.brand !== 'string' || p.brand.trim() === ''
    )
    expect(missing.map((p) => p.id)).toEqual([])
  })

  it('has unique ids', () => {
    const ids = partsData.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes the current-gen anchor parts', () => {
    const ids = new Set(partsData.map((p) => p.id))
    for (const id of [
      'gpu-rtx-5090', 'gpu-rx-9070xt', 'gpu-intel-arc-b580',
      'cpu-ryzen-9-9950x3d', 'cpu-intel-ultra-9-285k',
    ]) {
      expect(ids.has(id), `missing ${id}`).toBe(true)
    }
    expect(
      partsData.some((p) => p.category === 'motherboard' && p.socket === 'LGA1851')
    ).toBe(true)
  })

  it('keeps required per-category fields on every part', () => {
    for (const p of partsData) {
      expect(typeof p.price, p.id).toBe('number')
      if (p.category === 'cpu') {
        expect(typeof p.socket, p.id).toBe('string')
        expect(typeof p.perfScore, p.id).toBe('number')
      }
      if (p.category === 'gpu') {
        expect(typeof p.length, p.id).toBe('number')
        expect(typeof p.perfScore, p.id).toBe('number')
      }
      if (p.category === 'motherboard') {
        expect(typeof p.socket, p.id).toBe('string')
        expect(typeof p.ramType, p.id).toBe('string')
      }
    }
  })

  it('every LGA1851 CPU has a socket-compatible motherboard and cooler', () => {
    const intelCpus = partsData.filter((p) => p.category === 'cpu' && p.socket === 'LGA1851')
    expect(intelCpus.length).toBeGreaterThan(0)
    const boards = partsData.filter((p) => p.category === 'motherboard')
    const coolers = partsData.filter((p) => p.category === 'cooler')
    for (const cpu of intelCpus) {
      expect(boards.some((mb) => mb.socket === cpu.socket), `no board for ${cpu.id}`).toBe(true)
      expect(coolers.some((c) => Array.isArray(c.sockets) && c.sockets.includes(cpu.socket)),
        `no cooler for ${cpu.id}`).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run it to confirm RED**

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run test:run -- src/tests/partsData.test.js`
Expected: FAIL — "gives every part a non-empty string brand" lists the ~183 non-paste IDs, and the anchor/LGA1851 checks fail (parts not added yet).

- [ ] **Step 3: Extend cooler sockets for LGA1851 (one replace-all edit)**

Every air/AIO cooler that supports Intel currently has the exact array `["AM5", "AM4", "LGA1700", "LGA1200"]` (the AM5/AM4-only Noctua NH-L9a does not and must stay unchanged). Use a single **replace-all** Edit on `src/data/partsData.json`:

- old (replace all occurrences): `"sockets": ["AM5", "AM4", "LGA1700", "LGA1200"]`
- new: `"sockets": ["AM5", "AM4", "LGA1700", "LGA1851", "LGA1200"]`

- [ ] **Step 4: Append the 25 new parts (no `brand` yet — backfill adds it in Step 6)**

In `src/data/partsData.json`, replace the final paste object + closing bracket:

old_string:
```json
    "id": "paste-cm-mastergel", "category": "paste", "name": "Cooler Master MasterGel Pro",
    "brand": "Cooler Master", "price": 5.49, "tdp": 0
  }
]
```

new_string:
```json
    "id": "paste-cm-mastergel", "category": "paste", "name": "Cooler Master MasterGel Pro",
    "brand": "Cooler Master", "price": 5.49, "tdp": 0
  },
  {
    "id": "mb-asus-z890-e", "category": "motherboard", "name": "ASUS ROG Strix Z890-E Gaming WiFi",
    "price": 449.99, "socket": "LGA1851", "formFactor": "ATX", "ramType": "DDR5", "tdp": 16,
    "modelPath": "/models/motherboard.glb", "specs": { "chipset": "Z890" }
  },
  {
    "id": "mb-msi-z890-tomahawk", "category": "motherboard", "name": "MSI MAG Z890 Tomahawk WiFi",
    "price": 289.99, "socket": "LGA1851", "formFactor": "ATX", "ramType": "DDR5", "tdp": 15,
    "modelPath": "/models/motherboard.glb", "specs": { "chipset": "Z890" }
  },
  {
    "id": "mb-asrock-z890-pro-rs", "category": "motherboard", "name": "ASRock Z890 Pro RS WiFi",
    "price": 219.99, "socket": "LGA1851", "formFactor": "ATX", "ramType": "DDR5", "tdp": 13,
    "modelPath": "/models/motherboard.glb", "specs": { "chipset": "Z890" }
  },
  {
    "id": "mb-gigabyte-b860m", "category": "motherboard", "name": "Gigabyte B860M Gaming X",
    "price": 169.99, "socket": "LGA1851", "formFactor": "mATX", "ramType": "DDR5", "tdp": 11,
    "modelPath": "/models/motherboard.glb", "specs": { "chipset": "B860" }
  },
  {
    "id": "cpu-ryzen-9-9950x3d", "category": "cpu", "name": "AMD Ryzen 9 9950X3D",
    "price": 699.99, "socket": "AM5", "tdp": 170, "perfScore": 106, "modelPath": "/models/cpu.glb",
    "specs": { "cores": 16, "boostClock": 5.7 }
  },
  {
    "id": "cpu-ryzen-9-9950x", "category": "cpu", "name": "AMD Ryzen 9 9950X",
    "price": 549.99, "socket": "AM5", "tdp": 170, "perfScore": 103, "modelPath": "/models/cpu.glb",
    "specs": { "cores": 16, "boostClock": 5.7 }
  },
  {
    "id": "cpu-ryzen-7-9800x3d", "category": "cpu", "name": "AMD Ryzen 7 9800X3D",
    "price": 449.99, "socket": "AM5", "tdp": 120, "perfScore": 100, "modelPath": "/models/cpu.glb",
    "specs": { "cores": 8, "boostClock": 5.2 }
  },
  {
    "id": "cpu-ryzen-9-9900x", "category": "cpu", "name": "AMD Ryzen 9 9900X",
    "price": 399.99, "socket": "AM5", "tdp": 120, "perfScore": 94, "modelPath": "/models/cpu.glb",
    "specs": { "cores": 12, "boostClock": 5.6 }
  },
  {
    "id": "cpu-ryzen-7-9700x", "category": "cpu", "name": "AMD Ryzen 7 9700X",
    "price": 329.99, "socket": "AM5", "tdp": 65, "perfScore": 84, "modelPath": "/models/cpu.glb",
    "specs": { "cores": 8, "boostClock": 5.5 }
  },
  {
    "id": "cpu-ryzen-5-9600x", "category": "cpu", "name": "AMD Ryzen 5 9600X",
    "price": 229.99, "socket": "AM5", "tdp": 65, "perfScore": 74, "modelPath": "/models/cpu.glb",
    "specs": { "cores": 6, "boostClock": 5.4 }
  },
  {
    "id": "cpu-intel-ultra-9-285k", "category": "cpu", "name": "Intel Core Ultra 9 285K",
    "price": 549.99, "socket": "LGA1851", "tdp": 125, "perfScore": 101, "modelPath": "/models/cpu.glb",
    "specs": { "cores": 24, "boostClock": 5.7 }
  },
  {
    "id": "cpu-intel-ultra-7-265k", "category": "cpu", "name": "Intel Core Ultra 7 265K",
    "price": 379.99, "socket": "LGA1851", "tdp": 125, "perfScore": 90, "modelPath": "/models/cpu.glb",
    "specs": { "cores": 20, "boostClock": 5.5 }
  },
  {
    "id": "cpu-intel-ultra-5-245k", "category": "cpu", "name": "Intel Core Ultra 5 245K",
    "price": 279.99, "socket": "LGA1851", "tdp": 125, "perfScore": 80, "modelPath": "/models/cpu.glb",
    "specs": { "cores": 14, "boostClock": 5.2 }
  },
  {
    "id": "gpu-rtx-5090", "category": "gpu", "name": "NVIDIA GeForce RTX 5090",
    "price": 1899.99, "tdp": 575, "length": 357, "perfScore": 132, "modelPath": "/models/gpu.glb",
    "specs": { "vram": 32, "memType": "GDDR7" }
  },
  {
    "id": "gpu-rtx-5080", "category": "gpu", "name": "NVIDIA GeForce RTX 5080",
    "price": 999.99, "tdp": 360, "length": 340, "perfScore": 93, "modelPath": "/models/gpu.glb",
    "specs": { "vram": 16, "memType": "GDDR7" }
  },
  {
    "id": "gpu-rtx-5070ti", "category": "gpu", "name": "NVIDIA GeForce RTX 5070 Ti",
    "price": 729.99, "tdp": 300, "length": 300, "perfScore": 86, "modelPath": "/models/gpu.glb",
    "specs": { "vram": 16, "memType": "GDDR7" }
  },
  {
    "id": "gpu-rtx-5070", "category": "gpu", "name": "NVIDIA GeForce RTX 5070",
    "price": 539.99, "tdp": 250, "length": 250, "perfScore": 70, "modelPath": "/models/gpu.glb",
    "specs": { "vram": 12, "memType": "GDDR7" }
  },
  {
    "id": "gpu-rtx-5060ti", "category": "gpu", "name": "NVIDIA GeForce RTX 5060 Ti 16GB",
    "price": 399.99, "tdp": 180, "length": 245, "perfScore": 55, "modelPath": "/models/gpu.glb",
    "specs": { "vram": 16, "memType": "GDDR7" }
  },
  {
    "id": "gpu-rtx-5060", "category": "gpu", "name": "NVIDIA GeForce RTX 5060",
    "price": 289.99, "tdp": 145, "length": 200, "perfScore": 46, "modelPath": "/models/gpu.glb",
    "specs": { "vram": 8, "memType": "GDDR7" }
  },
  {
    "id": "gpu-rx-9070xt", "category": "gpu", "name": "AMD Radeon RX 9070 XT",
    "price": 579.99, "tdp": 304, "length": 287, "perfScore": 80, "modelPath": "/models/gpu.glb",
    "specs": { "vram": 16, "memType": "GDDR6" }
  },
  {
    "id": "gpu-rx-9070", "category": "gpu", "name": "AMD Radeon RX 9070",
    "price": 519.99, "tdp": 220, "length": 267, "perfScore": 72, "modelPath": "/models/gpu.glb",
    "specs": { "vram": 16, "memType": "GDDR6" }
  },
  {
    "id": "gpu-rx-9060xt", "category": "gpu", "name": "AMD Radeon RX 9060 XT 16GB",
    "price": 319.99, "tdp": 160, "length": 245, "perfScore": 53, "modelPath": "/models/gpu.glb",
    "specs": { "vram": 16, "memType": "GDDR6" }
  },
  {
    "id": "gpu-intel-arc-b580", "category": "gpu", "name": "Intel Arc B580",
    "price": 249.99, "tdp": 190, "length": 270, "perfScore": 43, "modelPath": "/models/gpu.glb",
    "specs": { "vram": 12, "memType": "GDDR6" }
  },
  {
    "id": "ram-gskill-ddr5-8000-32", "category": "ram", "name": "G.Skill Trident Z5 CK CUDIMM DDR5-8000 32GB",
    "price": 199.99, "ramType": "DDR5", "speed": 8000, "capacityGb": 32, "tdp": 7,
    "modelPath": "/models/ram.glb", "specs": { "sticks": 2 }
  },
  {
    "id": "ram-kingston-fury-ddr5-6400-32", "category": "ram", "name": "Kingston Fury Renegade DDR5-6400 32GB",
    "price": 139.99, "ramType": "DDR5", "speed": 6400, "capacityGb": 32, "tdp": 6,
    "modelPath": "/models/ram.glb", "specs": { "sticks": 2 }
  }
]
```

- [ ] **Step 5: Create the one-shot backfill script**

Create `backfill-brands.mjs` at the repo root. It appends `"brand": "<derived>"` after every non-paste part's name (pastes already have `brand` on their own line and are skipped). It is idempotent (re-running rewrites the same value) and validates the result.

```js
import { readFileSync, writeFileSync } from 'node:fs'

const PATH = 'src/data/partsData.json'

// Non-CPU/GPU brands taken from the manufacturer token at the start of the name.
// Longest/most-specific first so multi-word brands win (e.g. "Cooler Master").
const BRANDS = [
  'Fractal Design', 'Cooler Master', 'Lian Li', 'be quiet!', 'G.Skill',
  'Thermalright', 'TeamGroup', 'Phanteks', 'Montech', 'Noctua', 'Arctic',
  'DeepCool', 'Corsair', 'NZXT', 'Seasonic', 'Thermaltake', 'EVGA', 'MSI',
  'ASRock', 'ASUS', 'Gigabyte', 'Samsung', 'WD', 'Crucial', 'Seagate', 'Kingston',
]

function deriveBrand(category, name) {
  // CPU/GPU brand is the silicon vendor = the first word (AMD / Intel / NVIDIA).
  if (category === 'cpu' || category === 'gpu') return name.split(' ')[0]
  const hit = BRANDS.find((b) => name.startsWith(b))
  if (!hit) throw new Error(`No brand mapping for: ${name}`)
  return hit
}

let content = readFileSync(PATH, 'utf8')
const re = /"category": "([^"]+)", "name": "([^"]+)"(, "brand": "[^"]*")?/g
content = content.replace(re, (full, category, name) => {
  if (category === 'paste') return full // pastes keep their existing brand line
  return `"category": "${category}", "name": "${name}", "brand": "${deriveBrand(category, name)}"`
})

writeFileSync(PATH, content)

const data = JSON.parse(content) // throws if the edit broke JSON
const missing = data.filter((p) => typeof p.brand !== 'string' || !p.brand.trim())
if (missing.length) {
  console.error('Missing brand:', missing.map((p) => p.id))
  process.exit(1)
}
console.log(`OK: ${data.length} parts, all have a brand`)
```

- [ ] **Step 6: Run the backfill script**

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; node backfill-brands.mjs`
Expected: `OK: 213 parts, all have a brand` (188 existing + 25 new). If it prints "No brand mapping for: …", a new part's name doesn't match a known vendor — fix the name or extend `BRANDS`, then re-run.

- [ ] **Step 7: Run the integrity test to confirm GREEN**

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run test:run -- src/tests/partsData.test.js`
Expected: PASS (all 5 cases).

- [ ] **Step 8: Delete the temp script**

Run: `Remove-Item backfill-brands.mjs`
(The script is a one-shot migration; `brand` now lives in the JSON as data. It must NOT be committed.)

- [ ] **Step 9: Run the full suite + build (catch any downstream surprise)**

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run test:run`
Expected: PASS — baseline 163 + 5 new = **168**. `autoBuilder`/`tiers` are structural and stay green with the added parts.

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run build`
Expected: build succeeds (Vite re-validates the JSON).

- [ ] **Step 10: Commit (data + test only — never the script)**

```powershell
git add src/data/partsData.json src/tests/partsData.test.js
git commit -m @'
feat: current-gen catalog refresh + brand on every part

Add RTX 50, RX 9000, Ryzen 9000/Zen 5 and Intel Core Ultra 200S parts
(25 SKUs incl. LGA1851 Z890/B860 boards + DDR5 kits), extend cooler
sockets with LGA1851, and give every part a real brand field. perfScore
stays anchor-preserving (new flagships exceed 100). Existing parts,
prices and IDs unchanged. New partsData integrity test guards it.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Task 3: `filterParts` optional brand argument

**Files:**
- Modify: `src/lib/partFilter.js`
- Test: `src/tests/partFilter.test.js`

- [ ] **Step 1: Add failing brand-filter tests**

Append these cases inside the existing `describe('filterParts', …)` block in `src/tests/partFilter.test.js` (the file already imports `filterParts` and `partsData`, and defines `const cpus = partsData.filter((p) => p.category === 'cpu')`):

```js
  it('brand filter narrows results to a single brand', () => {
    const res = filterParts(cpus, {}, 0, '', 'AMD')
    expect(res.length).toBeGreaterThan(0)
    expect(res.every((r) => r.part.brand === 'AMD')).toBe(true)
  })

  it("brand 'all' or undefined returns the unfiltered set", () => {
    const all = filterParts(cpus, {}, 0, '').map((r) => r.part.id)
    const explicit = filterParts(cpus, {}, 0, '', 'all').map((r) => r.part.id)
    expect(explicit).toEqual(all)
  })

  it('brand and search combine (both narrow)', () => {
    const res = filterParts(cpus, {}, 0, 'core', 'Intel')
    expect(res.length).toBeGreaterThan(0)
    expect(res.every((r) => r.part.brand === 'Intel')).toBe(true)
    expect(res.every((r) => /core/i.test(r.part.name))).toBe(true)
  })
```

- [ ] **Step 2: Run to confirm RED**

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run test:run -- src/tests/partFilter.test.js`
Expected: FAIL — the 5th arg is ignored, so the "narrows to a single brand" assertion finds Intel parts in the AMD result.

- [ ] **Step 3: Implement the brand arg**

Replace the body of `src/lib/partFilter.js` (keep the leading comment) with:

```js
import { checkCompatibility } from './compatibility'

// Returns [{ part, compatible, reason }]. Default view: compatible + within 60%
// of total budget. When a search query is present, returns every name match
// regardless of compatibility/budget (so they're findable, shown marked). An
// optional brand ('all'/falsy = no brand filter) narrows results in both branches.
export function filterParts(parts, selectedParts, budget, query, brand) {
  const q = (query || '').trim().toLowerCase()
  const maxPrice = budget * 0.6
  const brandOk = (part) => !brand || brand === 'all' || part.brand === brand

  const annotated = parts.map((part) => {
    const { compatible, reason } = checkCompatibility(selectedParts, part)
    return { part, compatible, reason }
  })

  if (q) {
    return annotated.filter(({ part }) => part.name.toLowerCase().includes(q) && brandOk(part))
  }

  return annotated.filter(({ part, compatible }) => {
    if (!compatible) return false
    if (budget > 0 && part.price > maxPrice) return false
    return brandOk(part)
  })
}
```

- [ ] **Step 4: Run to confirm GREEN**

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run test:run -- src/tests/partFilter.test.js`
Expected: PASS (original 5 cases + 3 new).

- [ ] **Step 5: Commit**

```powershell
git add src/lib/partFilter.js src/tests/partFilter.test.js
git commit -m @'
feat: optional brand argument for filterParts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Task 4: `sortParts` same-brand name tiebreak

So that "Brand (A–Z)" leaves same-brand items in name order instead of input order.

**Files:**
- Modify: `src/lib/sortParts.js:12`
- Test: `src/tests/sortParts.test.js`

- [ ] **Step 1: Add a failing tiebreak test**

Add inside the existing `describe('sortParts', …)` block in `src/tests/sortParts.test.js`:

```js
  it('breaks brand ties by name (A-Z)', () => {
    const items = [
      { id: 'z', name: 'Zeta', brand: 'Acme', price: 1, tdp: 0 },
      { id: 'a', name: 'Alpha', brand: 'Acme', price: 2, tdp: 0 },
    ]
    expect(sortParts(items, 'brand-asc').map((p) => p.id)).toEqual(['a', 'z'])
  })
```

- [ ] **Step 2: Run to confirm RED**

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run test:run -- src/tests/sortParts.test.js`
Expected: FAIL — without a tiebreak the equal-brand items keep input order `['z', 'a']`.

- [ ] **Step 3: Add the name tiebreak**

In `src/lib/sortParts.js`, replace the `brand-asc` case (line 12):

```js
    case 'brand-asc': return arr.sort((a, b) => (a.brand ?? a.name).localeCompare(b.brand ?? b.name))
```

with:

```js
    case 'brand-asc': return arr.sort((a, b) =>
      (a.brand ?? a.name).localeCompare(b.brand ?? b.name) || a.name.localeCompare(b.name))
```

- [ ] **Step 4: Run to confirm GREEN**

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run test:run -- src/tests/sortParts.test.js`
Expected: PASS (original 6 cases + 1 new).

- [ ] **Step 5: Commit**

```powershell
git add src/lib/sortParts.js src/tests/sortParts.test.js
git commit -m @'
feat: tiebreak Brand (A-Z) sort by name

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Task 5: Brand filter in the part-selection modal

**Files:**
- Modify: `src/components/PartSelector.jsx`
- Test: `src/tests/PartSelector.test.jsx`

- [ ] **Step 1: Add failing component tests**

Replace `src/tests/PartSelector.test.jsx` with (adds `fireEvent`, a second `describe`):

```jsx
import { render, screen, within, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import PartSelector from '../components/PartSelector'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => {
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {} })
})

describe('PartSelector sorting', () => {
  it('renders a sort control with the four options', () => {
    render(<PartSelector category="gpu" onSelect={() => {}} onClose={() => {}} />)
    const select = screen.getByLabelText(/sort parts/i)
    expect(within(select).getByText('Price: High to Low')).toBeInTheDocument()
    expect(within(select).getByText('Power Draw (TDP)')).toBeInTheDocument()
  })
})

describe('PartSelector brand filter', () => {
  it('lists the brands present in the category', () => {
    render(<PartSelector category="cpu" onSelect={() => {}} onClose={() => {}} />)
    const select = screen.getByLabelText(/filter by brand/i)
    expect(within(select).getByText('All brands')).toBeInTheDocument()
    expect(within(select).getByText('AMD')).toBeInTheDocument()
    expect(within(select).getByText('Intel')).toBeInTheDocument()
  })

  it('filtering by brand hides other brands', () => {
    render(<PartSelector category="cpu" onSelect={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/filter by brand/i), { target: { value: 'Intel' } })
    expect(screen.queryByText(/AMD Ryzen/)).toBeNull()
    expect(screen.getAllByText(/Intel Core/).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to confirm RED**

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run test:run -- src/tests/PartSelector.test.jsx`
Expected: FAIL — no element labelled "filter by brand" exists yet.

- [ ] **Step 3: Add the brand `<select>` to PartSelector**

Edit `src/components/PartSelector.jsx`:

a) Update the React import (line 1) to add `useEffect`:

```jsx
import { useEffect, useMemo, useState } from 'react'
```

b) After the existing `const [sortKey, setSortKey] = useState('price-asc')` line, add brand state, a reset-on-category effect, and the derived brand list:

```jsx
  const [brandFilter, setBrandFilter] = useState('all')

  // The brand set differs per category, so reset when the modal switches category.
  useEffect(() => { setBrandFilter('all') }, [category])

  const brands = useMemo(
    () => [...new Set(parts.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [parts]
  )
```

c) Pass `brandFilter` to `filterParts` (the `visible` memo):

```jsx
  const visible = useMemo(
    () => filterParts(sorted, selectedParts, budget, query, brandFilter),
    [sorted, selectedParts, budget, query, brandFilter]
  )
```

d) Add the brand `<select>` immediately before the existing sort `<select>` (i.e. before the `<select value={sortKey} …>` element):

```jsx
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            aria-label="Filter by brand"
            className="bg-slate-950/60 border border-slate-700/70 rounded-sm text-xs text-slate-100 px-2 py-2 focus:outline-none focus:border-cyan-400"
          >
            <option value="all">All brands</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
```

- [ ] **Step 4: Run to confirm GREEN**

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run test:run -- src/tests/PartSelector.test.jsx`
Expected: PASS (sorting + brand-filter cases).

- [ ] **Step 5: Commit**

```powershell
git add src/components/PartSelector.jsx src/tests/PartSelector.test.jsx
git commit -m @'
feat: brand filter in the part-selection modal

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Task 6: Final verification

- [ ] **Step 1: Full test suite**

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run test:run`
Expected: PASS — **174 tests** (163 baseline + 5 partsData + 3 partFilter + 1 sortParts + 2 PartSelector). Confirm the printed total and that 0 fail. (If the count differs, reconcile before declaring done — don't hand-wave it.)

- [ ] **Step 2: Production build**

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run build`
Expected: build succeeds, no JSON parse errors.

- [ ] **Step 3 (optional manual smoke): dev server**

Run: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run dev` (port 5173). In the modal: open CPU, confirm the brand dropdown shows AMD/Intel and filters; switch to GPU and confirm it shows NVIDIA/AMD/Intel and resets to "All brands"; confirm RTX 5090 / Ryzen 9 9950X3D appear and an Intel Core Ultra 285K can pair with a Z890 board and an existing cooler. Stop the server when done.

- [ ] **Step 4: Confirm clean tree (no stray script)**

Run: `git status`
Expected: clean except the pre-existing untracked `CustomPc.iml`. `backfill-brands.mjs` must be gone. **Do not push** — deployment is the user's call.

---

## Notes / follow-ups (not in this plan)
- Task #2 of the checklist (real Amazon affiliate tag) is next and will flip `retailerLinks.test.js`'s "no tag" expectation — out of scope here.
- `tiers.js` "Ultimate" still references the RTX 4090 build; refreshing it to a 5090/9800X3D flagship build is a flagged follow-up the user can greenlight.
- Last-gen prices are left at their existing values (an "indicative prices" disclaimer is a separate roadmap item).
