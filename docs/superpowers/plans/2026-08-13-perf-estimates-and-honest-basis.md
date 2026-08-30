# Estimates backed by hardware facts, and an honest basis for every row — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the performance tab answer for every build instead of two builds in three, at every resolution instead of two, without any estimate being mistakable for a measurement.

**Architecture:** Three widening levers, each gated behind labelling that ships first. Tasks 1–3 plumb a four-tier basis through the engine and UI while changing no numbers at all; tasks 4–9 then turn on 1080p fitting, spec-derived part indices, and GPU-limited rows, each landing into a UI already able to label it. The ordering is load-bearing: reversing it produces an intermediate state where an estimate renders exactly like a benchmark.

**Tech Stack:** Node ESM scripts (`scripts/*.mjs`), plain-JS engine modules under `src/lib/perfEngine/`, React components under `src/components/performance/`, Vitest. `npx vite-node` for any script importing app modules — plain `node` cannot resolve this project's extensionless imports.

**Spec:** `docs/superpowers/specs/2026-08-13-perf-estimates-and-honest-basis-design.md`

---

## ⚠️ Testing discipline: prove each test can fail

**Before committing any task, break the thing the test is meant to protect and
confirm a test goes red. Then revert.** Not optional, and not satisfied by
watching the suite pass.

This was learned the expensive way twice in the first two tasks of this very
plan, on tests written into this document:

- Task 1's `errorPct` test set **both** sides to `prior`, so reading the wrong
  side's error still produced `max(35, 5.5) = 35` and passed. It could not
  distinguish correct attribution from swapped attribution.
- Task 2's wiring test passed with the entire `composeBasis` call replaced by a
  hardcoded object — so it verified nothing about the wiring it existed to
  verify.

Neither showed up as a failure. Both were found only by deliberately breaking
the code. The failure mode is always the same shape: **an assertion that is
already true for reasons other than the behaviour under test.** Watch for a
fixture where the interesting case is absent, a filter that can iterate zero
times, and any assertion satisfiable by a default value.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/perfEngine/rowBasis.js` | Compose a row's tier + caveats from its inputs, plus `onlyRealData`/`basisMix`. Pure. | **Create** |
| `src/lib/perfEngine/gpuBound.js` | "Did the GPU set this frame rate?" — both the declared-cap rule and the peer-ratio rule | **Create** |
| `src/lib/perfEngine/prior.js` | Apply stored regression coefficients + band lookup. No fitting. | **Create** |
| `src/lib/perfEngine/index.js` | Use `rowBasis`; admit `A`-only cells as `ceiling` | Modify |
| `src/lib/perfEngine/indices.js` | Return `basis: 'prior'` + `errorPct` when no measurement exists | Modify |
| `scripts/fit-perf-model.mjs` | Fit the priors; fit 1080p behind `gpuBound`; write both into the artefact | Modify |
| `src/components/performance/FpsCard.jsx` | Tier badge, "up to", `±` band, per-row expander | Modify |
| `src/components/performance/BasisBar.jsx` | The mix line, the real-data toggle, the explainer popover | **Create** |
| `src/components/performance/PerformanceScreen.jsx` | Own the filter state; render `BasisBar` | Modify |

`BasisBar` is a new file rather than more of `SummaryStrip`. That strip has one
job — three headline tiles, with a comment explaining why it deliberately shows
no single headline frame rate — and a filter control is a different concern that
would blur it.

### ⚠️ Two names that already exist — do not invent new ones

- **`spec-derived`** is already in `FpsCard.jsx:13`'s `BASIS_LABEL`, against a tier the engine never produced. That is the prior tier. Do not add `estimated` beside it.
- **`game.fpsCap`** already exists in `perfGames.json` (`elden-ring` 60, `gta5` 180, `apex` 300) and `applyFpsCap` already uses it when *producing* a row. Task 4 uses the same field in the opposite direction, to *reject* a row from a fit.

---

### Task 1: `rowBasis.js` — compose the tier and its caveats

A row is only as strong as its weakest input. Putting that rule in one pure module keeps `estimateGame` from growing a second branching pyramid, and makes the founding-rule assertion testable without constructing a whole report.

**Files:**
- Create: `src/lib/perfEngine/rowBasis.js`
- Test: `src/tests/rowBasis.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/rowBasis.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { composeBasis } from '../lib/perfEngine/rowBasis'

const inputs = (over = {}) => ({
  exactMeasured: false, hasCellB: true,
  gpuBasis: 'measured', cpuBasis: 'measured',
  gpuErrorPct: null, cpuErrorPct: null, resolutionCopied: false,
  ...over,
})

describe('composeBasis', () => {
  it('reports measured only for an exact measurement of this combination', () => {
    expect(composeBasis(inputs({ exactMeasured: true })).basis).toBe('measured')
  })

  it('reports modelled when both constants and both indices are measured', () => {
    expect(composeBasis(inputs()).basis).toBe('modelled')
  })

  it('demotes to spec-derived when ANY index came from a prior', () => {
    expect(composeBasis(inputs({ gpuBasis: 'prior' })).basis).toBe('spec-derived')
    expect(composeBasis(inputs({ cpuBasis: 'prior' })).basis).toBe('spec-derived')
  })

  it('demotes to ceiling when the cell has no CPU constant, prior or not', () => {
    expect(composeBasis(inputs({ hasCellB: false })).basis).toBe('ceiling')
    expect(composeBasis(inputs({ hasCellB: false, gpuBasis: 'prior' })).basis).toBe('ceiling')
  })

  it('NEVER reports measured for a row that was not exactly measured', () => {
    // The founding rule, as an assertion: the only route to `measured` is an
    // exact benchmark of this combination.
    for (const over of [{ gpuBasis: 'prior' }, { cpuBasis: 'prior' }, { hasCellB: false }, {}]) {
      expect(composeBasis(inputs(over)).basis).not.toBe('measured')
    }
  })

  it('keeps an exact measurement measured however its indices were obtained', () => {
    // The indices feed the SPLIT, never the frame time. exactFor does not
    // require a part to be indexed, so a benchmark of an unindexed chip is
    // reachable — and demoting it would hide a real reading behind the "only
    // show real data" filter. Understating the evidence is the same class of
    // error as overstating it.
    const out = composeBasis(inputs({
      exactMeasured: true, gpuBasis: 'prior', cpuBasis: 'prior', hasCellB: false,
    }))
    expect(out.basis).toBe('measured')
    expect(out.bound).toBe('point')
  })

  it('puts no caveats on an exact measurement', () => {
    // Every caveat describes how a number was DERIVED. On a measured row they
    // would all be false — "this is the graphics card's ceiling" is simply
    // untrue of a reading somebody took. FpsCard already says "Split not
    // modelled" where the attribution is missing.
    expect(composeBasis(inputs({
      exactMeasured: true, gpuBasis: 'prior', hasCellB: false, resolutionCopied: true,
    })).caveats).toEqual([])
  })

  it('marks only ceiling rows as an upper bound', () => {
    expect(composeBasis(inputs({ hasCellB: false })).bound).toBe('upper')
    expect(composeBasis(inputs()).bound).toBe('point')
  })

  it('names every specific reason in caveats', () => {
    const out = composeBasis(inputs({
      hasCellB: false, gpuBasis: 'prior', cpuBasis: 'prior', resolutionCopied: true,
    }))
    expect([...out.caveats].sort()).toEqual(
      ['cpu-index-prior', 'gpu-index-prior', 'no-cpu-constant', 'resolution-copied'],
    )
  })

  it('says so when a prior was applied outside the range it was fitted over', () => {
    // No catalogue part is outside today. The catalogue grows, and a regression
    // quietly extrapolated is the moment a "data-derived" number stops being one.
    const out = composeBasis(inputs({ gpuBasis: 'prior', gpuExtrapolated: true }))
    expect(out.caveats).toContain('index-extrapolated')
  })

  it('does not cry extrapolation for a measured index', () => {
    expect(composeBasis(inputs({ gpuExtrapolated: true })).caveats).not.toContain('index-extrapolated')
  })

  it('takes the WORST contributing band as errorPct, never a combination', () => {
    // These are held-out prediction errors, not measurement uncertainties.
    // Combining in quadrature would imply they are independent and quantified.
    const out = composeBasis(inputs({
      gpuBasis: 'prior', gpuErrorPct: 35, cpuBasis: 'prior', cpuErrorPct: 5.5,
    }))
    expect(out.errorPct).toBe(35)
  })

  it('gives a ceiling row no errorPct from the missing constant', () => {
    // The missing B is unbounded below, which is WHY the row is an upper bound.
    // Folding it into a percentage would claim a bound it does not have.
    expect(composeBasis(inputs({ hasCellB: false })).errorPct).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/rowBasis.test.js
```

Expected: FAIL — cannot resolve `../lib/perfEngine/rowBasis`.

- [ ] **Step 3: Implement**

Create `src/lib/perfEngine/rowBasis.js`:

```js
// What a row's number is worth, and why — in one place.
//
// A row is only as strong as its WEAKEST input. Spreading that rule across
// estimateGame's branches is how a prior-derived number ends up rendered
// identically to a benchmark: each branch looks locally reasonable and nothing
// owns the composition. This module owns it.
//
// Tier names are the ones the codebase already uses. `spec-derived` is not new
// — FpsCard.jsx has carried it in BASIS_LABEL against a tier the engine never
// produced. `ceiling` is the only genuinely new one.

// Strongest to weakest. A row lands on the weakest tier any input justifies.
const ORDER = ['measured', 'modelled', 'spec-derived', 'ceiling']
const weakest = (a, b) => (ORDER.indexOf(a) > ORDER.indexOf(b) ? a : b)

export function composeBasis({
  exactMeasured, hasCellB, gpuBasis, cpuBasis, gpuErrorPct, cpuErrorPct, resolutionCopied,
  gpuExtrapolated = false, cpuExtrapolated = false,
}) {
  // An exact benchmark of THIS combination is a reading, not a derivation. The
  // indices feed the split and nothing else, so neither a prior index nor a
  // missing CPU constant changes what the frame time is worth — and every
  // caveat below describes a derivation that did not happen here. Demoting
  // would hide a real measurement behind the "only show real data" filter,
  // which understates the evidence exactly as badly as overstating it.
  if (exactMeasured) {
    return { basis: 'measured', bound: 'point', caveats: [], errorPct: null }
  }

  const caveats = []
  if (gpuBasis === 'prior') caveats.push('gpu-index-prior')
  if (cpuBasis === 'prior') caveats.push('cpu-index-prior')
  if (!hasCellB) caveats.push('no-cpu-constant')
  if (resolutionCopied) caveats.push('resolution-copied')
  // Only meaningful for a prior — a measured index was not extrapolated from
  // anything, so the flag is ignored unless it came from the regression.
  if ((gpuBasis === 'prior' && gpuExtrapolated) || (cpuBasis === 'prior' && cpuExtrapolated)) {
    caveats.push('index-extrapolated')
  }

  // Anything that is not an outright measurement is treated as derived. Not a
  // defensive flourish: indices.js returns basis 'none' for a part with no
  // coverage, and a `=== 'prior'` test would wave that through as if it were a
  // benchmark. This module is meant to be the one place the rule cannot be
  // bypassed, so it fails closed rather than trusting its caller to pre-filter.
  // The caveat ids above stay tied to 'prior' specifically — 'gpu-index-prior'
  // would be a false statement about a 'none' index — so only the tier widens.
  const derivedIndex = gpuBasis !== 'measured' || cpuBasis !== 'measured'

  let basis = 'modelled'
  if (derivedIndex) basis = weakest(basis, 'spec-derived')
  if (!hasCellB) basis = weakest(basis, 'ceiling')

  // The worst contributing band, NOT a combination. See the test.
  const bandErrors = [
    gpuBasis === 'prior' ? gpuErrorPct : null,
    cpuBasis === 'prior' ? cpuErrorPct : null,
  ].filter((v) => v != null)

  return {
    basis,
    bound: basis === 'ceiling' ? 'upper' : 'point',
    caveats,
    errorPct: bandErrors.length ? Math.max(...bandErrors) : null,
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/tests/rowBasis.test.js
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/perfEngine/rowBasis.js src/tests/rowBasis.test.js
git commit -m "feat: compose a row's tier and caveats from its weakest input"
```

---

### Task 2: Route the engine's existing rows through `rowBasis`

Behaviour-preserving on purpose. Today's rows are `measured`, `modelled` or `none`; after this they still are, but the composition and the `caveats`/`bound`/`errorPct` fields now exist for tasks 6–8 to populate.

**Files:**
- Modify: `src/lib/perfEngine/index.js:59-108`
- Test: `src/tests/perfEngineBasis.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/perfEngineBasis.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { estimateBuildPerformance } from '../lib/perfEngine'
import model from '../data/perfModel.json'
import games from '../data/perfGames.json'
import parts from '../data/partsData.json'

const list = Array.isArray(parts) ? parts : parts.parts
const pick = (id) => list.find((p) => p.id === id)
const gameList = Array.isArray(games) ? games : games.games

const report = (cpuId, gpuId, resolution = '1440p') => estimateBuildPerformance({
  parts: { cpu: pick(cpuId), gpu: pick(gpuId) }, resolution, model, games: gameList,
})

describe('every answered row carries a complete basis', () => {
  const rows = report('cpu-ryzen-5-7600', 'gpu-rtx-4070').games.filter((r) => r.avgFps > 0)

  it('answers at all, so the assertions below are not vacuous', () => {
    expect(rows.length).toBeGreaterThan(0)
  })

  it('gives every answered row a bound and a caveats array', () => {
    for (const r of rows) {
      expect(['point', 'upper'], `${r.rowId}`).toContain(r.bound)
      expect(Array.isArray(r.caveats), `${r.rowId}`).toBe(true)
    }
  })

  it('marks a point-estimate row as a point, not an upper bound', () => {
    for (const r of rows.filter((x) => x.basis === 'modelled')) {
      expect(r.bound, `${r.rowId}`).toBe('point')
    }
  })

  it('leaves an unanswered row alone', () => {
    const none = report('cpu-ryzen-5-7600', 'gpu-rtx-4070').games.find((r) => r.basis === 'none')
    expect(none.avgFps).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/perfEngineBasis.test.js
```

Expected: FAIL — `bound` is `undefined`, so the `toContain` assertion fails.

- [ ] **Step 3: Import and call `composeBasis`**

In `src/lib/perfEngine/index.js`, add to the imports at the top:

```js
import { composeBasis } from './rowBasis'
```

Replace the `source` block (currently lines 59-64) with:

```js
  // A real measurement of this exact combination beats a model of it.
  const source = measured
    ? { ms: measured.frameTimeMs, sources: measured.sources }
    : modelled
      ? { ms: modelled.frameTimeMs, sources: cell.sources ?? 0 }
      : null

  // The tier is composed from the inputs, never asserted here — see rowBasis.js.
  const tier = composeBasis({
    exactMeasured: Boolean(measured),
    hasCellB: cell?.B > 0,
    gpuBasis: gpuIdx.basis,
    cpuBasis: cpuIdx.basis,
    gpuErrorPct: gpuIdx.errorPct ?? null,
    cpuErrorPct: cpuIdx.errorPct ?? null,
    resolutionCopied: gpuIdx.resolutionCopied,
    gpuExtrapolated: gpuIdx.extrapolated ?? false,
    cpuExtrapolated: cpuIdx.extrapolated ?? false,
  })
```

Replace the no-source early return (currently lines 66-70) with:

```js
  if (!source) {
    return { ...base, avgFps: null, lowFps: null, frameTimeMs: null,
             lowFrameTimeMs: null, lowBasis: 'none', cpuShare: null,
             limitedBy: null, atEngineCap: false, basis: 'none', sources: 0,
             bound: 'point', caveats: [], errorPct: null }
  }
```

In the final `return` (currently lines 92-108), replace the `basis` line and add three fields:

```js
    basis: tier.basis,
    bound: tier.bound,
    caveats: tier.caveats,
    errorPct: tier.errorPct,
    sources: source.sources,
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/tests/perfEngineBasis.test.js src/tests/perfEngine.test.js
```

Expected: PASS. If a pre-existing `perfEngine` test asserts on `basis`, it must still pass unchanged — this task changes no tier for any current row.

- [ ] **Step 5: Prove no number moved**

```bash
npx vitest run
```

Expected: 1031 passing, same as before. A changed count here means the refactor altered behaviour, which it must not.

- [ ] **Step 6: Commit**

```bash
git add src/lib/perfEngine/index.js src/tests/perfEngineBasis.test.js
git commit -m "refactor: compose every row's tier through rowBasis"
```

---

### Task 3: The UI tiers and the three controls

Still no new numbers. This is the labelling arriving before the thing it labels.

**Files:**
- Modify: `src/components/performance/FpsCard.jsx`
- Modify: `src/components/performance/SummaryStrip.jsx`
- Test: `src/tests/FpsCard.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/FpsCard.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FpsCard from '../components/performance/FpsCard'

const row = (over = {}) => ({
  rowId: 'g|ultra|native', gameId: 'g', name: 'Test Game', preset: 'Ultra',
  presetId: 'ultra', presetTier: 4, upscaling: 'native', presetExact: true,
  avgFps: 94, lowFps: 71, frameTimeMs: 10.6, lowFrameTimeMs: 14.1,
  lowBasis: 'modelled', cpuShare: 0.4, limitedBy: 'gpu', atEngineCap: false,
  basis: 'modelled', sources: 3, bound: 'point', caveats: [], errorPct: null,
  ...over,
})

describe('FpsCard tiers', () => {
  it('labels a benchmarked row', () => {
    render(<FpsCard row={row({ basis: 'measured' })} />)
    expect(screen.getByText(/benchmarked/i)).toBeInTheDocument()
  })

  it('labels a modelled row as backed by real data', () => {
    render(<FpsCard row={row()} />)
    expect(screen.getByText(/backed by real data/i)).toBeInTheDocument()
  })

  it('labels a spec-derived row as an estimate and shows its band', () => {
    render(<FpsCard row={row({ basis: 'spec-derived', errorPct: 35 })} />)
    expect(screen.getByText(/estimate/i)).toBeInTheDocument()
    expect(screen.getByText(/±35%/)).toBeInTheDocument()
  })

  it('renders a ceiling row as "up to", never as a bare number', () => {
    // A bare figure would claim a point estimate the row cannot support.
    render(<FpsCard row={row({ basis: 'ceiling', bound: 'upper', caveats: ['no-cpu-constant'] })} />)
    expect(screen.getByText(/up to/i)).toBeInTheDocument()
    // The label assertion is NOT redundant with the one above: "up to" is driven
    // by `bound`, so without this line the test stays green even if
    // BASIS_LABEL.ceiling is changed to say "benchmarked". Verified by mutation.
    expect(screen.getByText(/estimate/i)).toBeInTheDocument()
  })

  it('hides caveats until the expander is used, then shows them', async () => {
    const user = userEvent.setup()
    render(<FpsCard row={row({ basis: 'spec-derived', caveats: ['gpu-index-prior'] })} />)
    expect(screen.queryByText(/graphics card index came from its specs/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: /why/i }))
    expect(screen.getByText(/graphics card index came from its specs/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/FpsCard.test.jsx
```

Expected: FAIL — the current card renders "modelled", not "backed by real data".

- [ ] **Step 3: Update `FpsCard.jsx`**

Replace the `BASIS_LABEL` map (lines 10-14) with:

```js
// How each tier is named on the card. The wording draws the line a reader
// actually cares about: did somebody measure this, or did we work it out?
const BASIS_LABEL = {
  measured: 'benchmarked',
  modelled: 'backed by real data',
  'spec-derived': 'estimate',
  ceiling: 'estimate',
}

// Why, in words a reader can act on. Keys are the caveat ids from rowBasis.js.
const CAVEAT_TEXT = {
  'gpu-index-prior': 'The graphics card index came from its specs, not a benchmark of this card.',
  'cpu-index-prior': 'The processor index came from its specs, not a benchmark of this chip.',
  'no-cpu-constant': 'No review has measured processor performance in this game, so this is the graphics card’s ceiling.',
  'resolution-copied': 'No data at this resolution for this card; the figure is carried across from 1440p.',
  'index-extrapolated': 'This part sits outside the range the estimate was worked out over, so it is rougher than the ± figure suggests.',
}
```

Add a `useState` import at the top of the file:

```jsx
import { useState } from 'react'
```

Inside the component, **above the early `return` for `row.basis === 'none'`** — not
merely above `splitKnown` — add:

```jsx
  // Above the no-data early return, not below it: a Hook after a conditional
  // return is a rules-of-hooks violation and `npm run lint` fails on it. Neither
  // value is read in the 'none' branch, so hoisting them is semantically free.
  const [showWhy, setShowWhy] = useState(false)
  const isUpper = row.bound === 'upper'
```

Replace the average figure block (currently lines 51-54) with:

```jsx
        <div>
          <div className="font-mono text-2xl leading-none text-ink">
            {isUpper && <span className="mr-1 font-sans text-sm text-muted">up to</span>}
            {row.avgFps}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted">average</div>
        </div>
```

Replace the basis badge block (currently lines 65-69) with:

```jsx
          <div className={`text-[10px] uppercase tracking-wider ${
            row.basis === 'measured' ? 'text-good' : 'text-muted'}`}
          >
            {BASIS_LABEL[row.basis] ?? row.basis}
            {row.errorPct != null && ` ±${Math.round(row.errorPct)}%`}
          </div>
```

Add the expander immediately before the component's closing `</div>`:

```jsx
      {row.caveats.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowWhy((v) => !v)}
            aria-expanded={showWhy}
            className="text-[10px] uppercase tracking-wider text-muted underline decoration-dotted"
          >
            {showWhy ? 'Hide why' : 'Why?'}
          </button>
          {showWhy && (
            <ul className="mt-1.5 space-y-1">
              {row.caveats.map((c) => (
                <li key={c} className="text-[11px] leading-snug text-muted">{CAVEAT_TEXT[c] ?? c}</li>
              ))}
            </ul>
          )}
        </div>
      )}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/tests/FpsCard.test.jsx
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Create `BasisBar.jsx`**

Create `src/components/performance/BasisBar.jsx`:

```jsx
import { useState } from 'react'
import { basisMix } from '../../lib/perfEngine/rowBasis'

// What the numbers below are worth, and a way to see only the solid ones.
//
// Separate from SummaryStrip on purpose: that strip answers "how fast, held back
// by what, drawing what". This answers "how much of that did anybody measure",
// which is a different question and deserves its own row.
export default function BasisBar({ rows, realOnly, onRealOnlyChange }) {
  const [showHelp, setShowHelp] = useState(false)

  // ⚠️ Counted from the UNFILTERED rows, always. If these totals moved when the
  // filter went on, the control could be used to make a thin evidence base look
  // solid — the exact failure this whole feature exists to prevent.
  const mix = basisMix(rows)
  if (mix.measured + mix.modelled + mix.estimated === 0) return null

  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-[11px] text-muted">
          <span className="text-good">{mix.measured} benchmarked</span>
          {' · '}{mix.modelled} backed by real data
          {' · '}{mix.estimated} estimated
        </p>

        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
          className="text-[11px] text-muted underline decoration-dotted"
        >
          How is this worked out?
        </button>

        <label className="ml-auto flex items-center gap-2 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={realOnly}
            onChange={(e) => onRealOnlyChange(e.target.checked)}
            className="accent-accent"
          />
          Only show real data
        </label>
      </div>

      {showHelp && (
        <dl className="mt-2.5 space-y-1.5 border-t border-line pt-2.5 text-[11px] leading-snug text-muted">
          <div><dt className="inline text-ink">Benchmarked</dt>{' — '}
            <dd className="inline">a reviewer ran this exact processor, graphics card, game and settings.</dd></div>
          <div><dt className="inline text-ink">Backed by real data</dt>{' — '}
            <dd className="inline">worked out from benchmarks of both parts in this game, rather than of this pairing.</dd></div>
          <div><dt className="inline text-ink">Estimate</dt>{' — '}
            <dd className="inline">no review has charted one of these parts, so its speed is inferred from the
              specifications. The inference is checked by predicting parts that were held out of it, and the
              typical error of that check is the ± figure on the row.</dd></div>
          <div><dt className="inline text-ink">Up to</dt>{' — '}
            <dd className="inline">no review has measured processor performance in this game, so the figure is
              the graphics card’s ceiling and the real number may be lower.</dd></div>
        </dl>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Wire it into `PerformanceScreen.jsx`**

Add the import and the state, and filter the rows fed to the grid. The state lives
here, not in `BasisBar`, because the grid is the thing that has to change:

```jsx
import { useState } from 'react'
import BasisBar from './BasisBar'
import { onlyRealData } from '../../lib/perfEngine/rowBasis'
```

```jsx
  const [realOnly, setRealOnly] = useState(false)
  const allRows = report?.games ?? []
  const shownRows = realOnly ? onlyRealData(allRows) : allRows
```

Render `<BasisBar rows={allRows} realOnly={realOnly} onRealOnlyChange={setRealOnly} />`
directly beneath `<SummaryStrip … />`, and pass `shownRows` — **not** `report.games` —
to the card grid.

> `onlyRealData`, `basisMix` and their tests (`src/tests/performanceFilter.test.js`)
> were built in **Task 1**, alongside the tier definition they depend on. Nothing
> to add here — just import them.

- [ ] **Step 7: Run everything and verify in the browser**

```bash
npx vitest run
```

```bash
npm run lint
```

Then start the dev server and confirm the Performance tab still renders, the badges read "benchmarked"/"backed by real data", the explainer opens, and the toggle hides nothing yet because no estimates exist.

- [ ] **Step 8: Commit**

```bash
git add src/components/performance src/tests/FpsCard.test.jsx
git commit -m "feat: label every row's tier, with caveats and a real-data filter"
```

> **CHECKPOINT — safe to ship.** Everything to here is labelling. No number has
> changed and no estimate exists yet. Tasks 4 onward widen what the engine
> answers, and each lands into a UI that can already label it honestly.

---

### Task 4: `gpuBound.js` — reject rows the GPU did not limit

**Files:**
- Create: `src/lib/perfEngine/gpuBound.js`
- Test: `src/tests/gpuBound.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/gpuBound.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { atDeclaredCap, peerRatioOutliers, GPU_BOUND_SHORTFALL_PCT } from '../lib/perfEngine/gpuBound'

describe('atDeclaredCap', () => {
  it('rejects a row sitting at a game’s declared engine cap', () => {
    // elden-ring declares fpsCap 60 in perfGames.json. A row reading 60 there
    // measured the cap, not the card.
    expect(atDeclaredCap({ avgFps: 60 }, { fpsCap: 60 })).toBe(true)
    expect(atDeclaredCap({ avgFps: 59.4 }, { fpsCap: 60 })).toBe(true)
  })

  it('keeps a row comfortably under the cap', () => {
    expect(atDeclaredCap({ avgFps: 48 }, { fpsCap: 60 })).toBe(false)
  })

  it('keeps every row for a game with no declared cap', () => {
    expect(atDeclaredCap({ avgFps: 300 }, { fpsCap: null })).toBe(false)
    expect(atDeclaredCap({ avgFps: 300 }, {})).toBe(false)
  })
})

describe('peerRatioOutliers', () => {
  // A card GPU-bound at both resolutions has a 1080p/1440p ratio set by the
  // GPU's own work, consistent across a cell. A card held down at 1080p — by a
  // CPU wall, a vsync, anything — falls BELOW its peers.
  const cell = [
    { gpuId: 'a', fps1080: 138, fps1440: 100 },
    { gpuId: 'b', fps1080: 137, fps1440: 100 },
    { gpuId: 'c', fps1080: 140, fps1440: 101 },
    { gpuId: 'd', fps1080: 100, fps1440: 100 },  // held down: ratio 1.00 vs ~1.38
  ]

  it('flags the card whose ratio falls short of its peers', () => {
    expect(peerRatioOutliers(cell)).toEqual(['d'])
  })

  it('flags nothing when every card scales alike', () => {
    expect(peerRatioOutliers(cell.slice(0, 3))).toEqual([])
  })

  it('refuses to judge a cell too small to have peers', () => {
    // With fewer than four cards the median is not a peer group, and one
    // outlier would drag it far enough to hide itself.
    //
    // ⚠️ BOTH cases below INCLUDE the outlier `d`, deliberately. A three-card
    // cell of a/b/c would return [] whether or not the MIN_PEERS guard exists —
    // there is nothing in it to flag — so it would pass against an
    // implementation that had no guard at all. A test that cannot fail is worse
    // than no test. With `d` present, removing the guard makes both of these
    // return ['d'] and the test bites.
    expect(peerRatioOutliers([cell[0], cell[1], cell[3]])).toEqual([])
    expect(peerRatioOutliers([cell[0], cell[3]])).toEqual([])
  })

  it('exports the threshold it used, rather than burying it', () => {
    expect(GPU_BOUND_SHORTFALL_PCT).toBe(12)
  })
})

describe('residualOutlier', () => {
  // The peer test needs the same card at BOTH resolutions, which holds for only
  // 176 of the 1058 1080p rows. This covers the rest: a row delivering far less
  // than the fitted GPU term predicts was held back by something.
  it('rejects a row far below what the GPU term predicts', () => {
    expect(residualOutlier(80, 100)).toBe(true)
  })

  it('keeps a row within tolerance either way', () => {
    expect(residualOutlier(95, 100)).toBe(false)
    expect(residualOutlier(100, 100)).toBe(false)
  })

  it('keeps a row ABOVE prediction, however far above', () => {
    // Only a shortfall indicates a limiter. An overshoot is noise, a favourable
    // test bench, or a fit still settling — never evidence the GPU was capped.
    expect(residualOutlier(140, 100)).toBe(false)
  })

  it('declines to judge without a usable prediction', () => {
    expect(residualOutlier(80, 0)).toBe(false)
    expect(residualOutlier(80, null)).toBe(false)
  })

  it('uses the SAME shortfall threshold as the peer rule', () => {
    // Two rules, one claim: "the GPU did not set this rate". Different
    // thresholds would mean a row's fate depended on whether it happened to
    // have a 1440p partner.
    expect(residualOutlier(100 * (1 - GPU_BOUND_SHORTFALL_PCT / 100) - 0.1, 100)).toBe(true)
    expect(residualOutlier(100 * (1 - GPU_BOUND_SHORTFALL_PCT / 100) + 0.1, 100)).toBe(false)
  })
})
```

Add `residualOutlier` to the import at the top of that test file.

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/gpuBound.test.js
```

Expected: FAIL — cannot resolve `../lib/perfEngine/gpuBound`.

- [ ] **Step 3: Implement**

Create `src/lib/perfEngine/gpuBound.js`:

```js
// "Did the GPU set this frame rate?" — the question a 1080p GPU fit must ask of
// every row before using it.
//
// fit-perf-model.mjs used to answer it by excluding the whole 1080p resolution,
// on the grounds that the CPU limits there. Sound in principle and far too
// broad for this corpus: 1080p is the LARGEST bucket (1058 rows, 47 games) and
// is mostly mid-range cards on fast test CPUs, where the GPU really is the
// limiter. Measured across 30 cells and 176 card-observations, only 8 (4.5%)
// are held down by anything else. The blanket rule threw away ~95% good data to
// avoid ~5% bad.
//
// ⚠️ THE CAUSE MUST NOT BE GUESSED AT. The peer test below was written for CPU
// walls and immediately flagged elden-ring, where rx-6800 and rtx-2060-super
// both sit at ratio exactly 1.00 — that is the game's hard 60 fps engine cap,
// not a processor. A CPU wall, an engine cap and a vsync are equally
// disqualifying for fitting a GPU index and equally indistinguishable in the
// data. So this module asks only whether the GPU set the rate, and never why
// it did not.

// A row within this margin of a DECLARED cap is measuring the cap. Reviewers
// benchmarking a rock-solid 60 fps lock record 59.x as often as 60.0.
const CAP_MARGIN = 0.02

// How far below its peers a card's 1080p/1440p ratio must fall to be rejected.
// Calibrated against the 176 observations whose status is known independently;
// see the corpus test in src/tests/gpuBoundCorpus.test.js.
export const GPU_BOUND_SHORTFALL_PCT = 12

// Fewer than this and the "peers" are not a peer group — with three cards, one
// outlier drags the median far enough to hide itself.
const MIN_PEERS = 4

export function atDeclaredCap(row, game) {
  const cap = game?.fpsCap
  if (!(cap > 0)) return false
  return row.avgFps >= cap * (1 - CAP_MARGIN)
}

const median = (values) => {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

// `cell` is every card measured at BOTH resolutions for one
// cpu|game|preset|upscaling. Returns the gpuIds to exclude from the 1080p fit.
export function peerRatioOutliers(cell) {
  const usable = cell.filter((c) => c.fps1080 > 0 && c.fps1440 > 0)
  if (usable.length < MIN_PEERS) return []
  const ratios = usable.map((c) => ({ gpuId: c.gpuId, ratio: c.fps1080 / c.fps1440 }))
  const med = median(ratios.map((r) => r.ratio))
  return ratios
    .filter((r) => (med - r.ratio) / med * 100 > GPU_BOUND_SHORTFALL_PCT)
    .map((r) => r.gpuId)
}

// The other 880 rows. peerRatioOutliers needs the same card measured at both
// resolutions, which only 176 of the 1058 1080p rows have. This one needs only
// a fitted prediction, so it reaches every row — used as a second pass after an
// initial fit, then the fit is repeated without the rejects.
//
// ONE-SIDED on purpose. A row far BELOW the GPU-only prediction was held back by
// something. A row above it is noise or a kind test bench, and is never evidence
// the card was capped — rejecting those would trim the fit toward its own
// starting guess.
export function residualOutlier(measuredFps, predictedFps) {
  if (!(predictedFps > 0) || !(measuredFps > 0)) return false
  return measuredFps < predictedFps * (1 - GPU_BOUND_SHORTFALL_PCT / 100)
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/tests/gpuBound.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Pin the rule against the real corpus**

Create `src/tests/gpuBoundCorpus.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { peerRatioOutliers } from '../lib/perfEngine/gpuBound'

// resolve off cwd, not import.meta.url: under jsdom that is an http:// URL and
// readFileSync rejects it. Same approach as sitemap.test.js.
const read = (p) => JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8'))

describe('the rejection rule against the committed corpus', () => {
  const entries = read('data/benchmarks/entries.json')
  const rows = Array.isArray(entries) ? entries : entries.entries
  const sources = read('data/benchmarks/sources.json')
  const srcList = Array.isArray(sources) ? sources : sources.sources
  const kindOf = new Map(srcList.map((s) => [s.id, s.kind]))

  const cells = new Map()
  for (const r of rows) {
    if (kindOf.get(r.sourceId) !== 'gpu-scaling') continue
    if (!['1080p', '1440p'].includes(r.resolution) || !(r.avgFps > 0)) continue
    const k = `${r.cpuId}|${r.gameId}|${r.presetId}|${r.upscaling}`
    cells.set(k, cells.get(k) ?? new Map())
    const g = cells.get(k)
    const cur = g.get(r.gpuId) ?? { gpuId: r.gpuId }
    g.set(r.gpuId, { ...cur, [r.resolution === '1080p' ? 'fps1080' : 'fps1440']: r.avgFps })
  }

  let judged = 0, rejected = 0
  for (const g of cells.values()) {
    const cell = [...g.values()].filter((c) => c.fps1080 > 0 && c.fps1440 > 0)
    if (cell.length < 4) continue
    judged += cell.length
    rejected += peerRatioOutliers(cell).length
  }

  it('judges a meaningful number of observations', () => {
    expect(judged).toBeGreaterThan(100)
  })

  it('rejects roughly 5%, not most of the corpus and not none of it', () => {
    // The whole case for fitting 1080p is that the bad rows are RARE. If this
    // moves a long way, either the detector broke or the corpus changed shape,
    // and the 1080p fit needs re-justifying before it ships.
    const pct = rejected / judged * 100
    expect(pct).toBeGreaterThan(1)
    expect(pct).toBeLessThan(12)
  })
})
```

- [ ] **Step 6: Run it**

```bash
npx vitest run src/tests/gpuBoundCorpus.test.js
```

Expected: PASS. The measured figure at time of writing is 8 of 176 = 4.5%.

- [ ] **Step 7: Commit**

```bash
git add src/lib/perfEngine/gpuBound.js src/tests/gpuBound.test.js src/tests/gpuBoundCorpus.test.js
git commit -m "feat: detect rows whose frame rate the GPU did not set"
```

---

### Task 5: Fit 1080p behind the rejection rule

**Files:**
- Modify: `scripts/fit-perf-model.mjs:16-21` and the pass-1 entry filter
- Test: `src/tests/perfModelShape.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/perfModelShape.test.js`:

```js
import { describe, it, expect } from 'vitest'
import model from '../data/perfModel.json'

describe('the fitted artefact covers 1080p', () => {
  const cellsWithA = (res) => Object.values(model.gameConst)
    .flatMap((byRes) => Object.values(byRes[res] ?? {}))
    .filter((cell) => cell?.A > 0).length

  it('has GPU cell constants at 1080p', () => {
    // Zero here is the pre-existing bug: the most common gaming resolution
    // answered nothing at all for anybody.
    expect(cellsWithA('1080p')).toBeGreaterThan(80)
  })

  it('did not lose 1440p or 4K in the process', () => {
    expect(cellsWithA('1440p')).toBeGreaterThan(50)
    expect(cellsWithA('4k')).toBeGreaterThan(30)
  })

  it('reports how many rows the fit rejected', () => {
    expect(model.rejectedNotGpuBound).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/perfModelShape.test.js
```

Expected: FAIL — `cellsWithA('1080p')` is 0.

- [ ] **Step 3: Change the fit script**

In `scripts/fit-perf-model.mjs`, add to the imports:

```js
import { atDeclaredCap, peerRatioOutliers } from '../src/lib/perfEngine/gpuBound.js'
```

Replace the `GPU_FIT_RESOLUTIONS` constant and its comment (lines 18-21) with:

```js
// 1080p was excluded here because "there the CPU is doing the limiting". True
// of high-end cards, and far too broad for this corpus — see gpuBound.js. It is
// now included, with the rows the GPU did not limit rejected individually.
const GPU_FIT_RESOLUTIONS = ['1080p', '1440p', '4k']
```

⚠️ **Group and reject over the `live` entries only.** `fit-perf-model.mjs` already
narrows the corpus to live rows before fitting (superseded entries are excluded).
Zero of the current 2855 are superseded, so this is inert today — but a future
superseded row must not influence the rejection, or a measurement the fit itself
ignores would still be shaping which of its neighbours get thrown out.

Immediately after the existing `gpuEntries` definition (line 83-85), add the rejection:

```js
// Reject rows whose frame rate something other than the GPU set. Two rules, one
// gate: a DECLARED engine cap is exact and needs no peers; everything else is
// caught by a card falling short of its peers between 1080p and 1440p.
const gameById = new Map(games.map((g) => [g.id, g]))
const fps1440 = new Map()
for (const e of gpuEntries) {
  if (e.resolution === '1440p') fps1440.set(`${e.cpuId}|${e.gameId}|${e.presetId}|${e.upscaling}|${e.gpuId}`, e.avgFps)
}
const cells1080 = new Map()
for (const e of gpuEntries) {
  if (e.resolution !== '1080p') continue
  const k = `${e.cpuId}|${e.gameId}|${e.presetId}|${e.upscaling}`
  cells1080.set(k, cells1080.get(k) ?? [])
  cells1080.get(k).push({ gpuId: e.gpuId, fps1080: e.avgFps, fps1440: fps1440.get(`${k}|${e.gpuId}`) ?? 0 })
}
const excluded = new Set()
for (const [k, cell] of cells1080) {
  for (const gpuId of peerRatioOutliers(cell)) excluded.add(`${k}|${gpuId}`)
}
const gpuFitEntries = gpuEntries.filter((e) => {
  if (atDeclaredCap(e, gameById.get(e.gameId))) return false
  if (e.resolution !== '1080p') return true
  return !excluded.has(`${e.cpuId}|${e.gameId}|${e.presetId}|${e.upscaling}|${e.gpuId}`)
})
const rejectedNotGpuBound = gpuEntries.length - gpuFitEntries.length
console.log(`fit: rejected ${rejectedNotGpuBound} rows the GPU did not limit`)
```

Then change the pass-1 loop (line 90) to fit from the filtered set:

```js
  const inRes = gpuFitEntries.filter((e) => e.resolution === res)
```

Add `rejectedNotGpuBound` to the written model object, beside `entryCount`.

- [ ] **Step 4: Add the residual second pass for the rows the peer rule cannot reach**

The peer rule needs a card measured at both resolutions, which is true of only 176
of the 1058 1080p rows. The rest are still unchecked after Step 3. Fit once, reject
rows delivering far less than the fitted GPU term predicts, then fit again without
them.

Extract the existing pass-1 body into a local function so it can be called twice —
keep whatever entry mapping is already inside the loop, unchanged:

```js
const fitRes = (entries) => fitTwoWay(
  entries.map((e) => ({ /* ← the existing mapping from the pass-1 loop, verbatim */ })),
  /* ← the existing remaining arguments, verbatim */
)
```

Then replace the pass-1 loop with:

```js
import { residualOutlier } from '../src/lib/perfEngine/gpuBound.js'   // with the other imports

let rejectedByResidual = 0
for (const res of RESOLUTIONS) {
  const inRes = gpuFitEntries.filter((e) => e.resolution === res)
  const first = fitRes(inRes)

  // Only 1080p gets the second pass. 1440p and 4K were never suspect — the
  // whole reason 1080p needed a rule is that it is where a limiter other than
  // the card plausibly binds.
  if (res !== '1080p') { gpuFits[res] = first; continue }

  const kept = inRes.filter((e) => {
    const A = first.cellConst.get(`${e.gameId}|${e.presetId}|${e.upscaling}`)
    const index = first.index.get(e.gpuId)
    if (!(A > 0) || !(index > 0)) return true          // nothing to predict with
    const predictedFps = 1000 / (A / index)
    return !residualOutlier(e.avgFps, predictedFps)
  })
  rejectedByResidual = inRes.length - kept.length
  gpuFits[res] = kept.length === inRes.length ? first : fitRes(kept)
}
console.log(`fit: rejected ${rejectedByResidual} further 1080p rows on residual`)
```

Add `rejectedByResidual` to the written model object beside `rejectedNotGpuBound`.

**One pass, not iterated to convergence.** Repeated rejection walks the fit toward
whatever it already believed — each round removes the rows that disagree most, and
the next round's threshold is computed from a tamer set. One pass removes the gross
cases and stops.

- [ ] **Step 5: Refit and inspect**

```bash
npm run perf:fit
```

Expected: both rejection lines, then the usual summary. `src/data/perfModel.report.json` should now show a non-zero `parts` count for `1080p` under `gpuFit`.

- [ ] **Step 6: Run the tests**

```bash
npx vitest run src/tests/perfModelShape.test.js
```

Expected: PASS.

- [ ] **Step 7: Sweep before committing the new model**

```bash
npx vite-node scripts/compare-perf-model.mjs
```

Expected: 1440p and 4K cells unchanged; 1080p cells added. **If a 1440p or 4K constant moved, stop** — the rejection is filtering rows it should not, and this gate exists for exactly that.

- [ ] **Step 8: Commit**

```bash
git add scripts/fit-perf-model.mjs src/data/perfModel.json src/data/perfModel.report.json src/tests/perfModelShape.test.js
git commit -m "feat: fit 1080p, rejecting rows the GPU did not limit"
```

---

### Task 6: Fit the spec-derived priors into the artefact

**Files:**
- Modify: `scripts/fit-perf-model.mjs`
- Test: `src/tests/perfPrior.test.js` (the artefact half)

- [ ] **Step 1: Write the failing test**

Create `src/tests/perfPrior.test.js`:

```js
import { describe, it, expect } from 'vitest'
import model from '../data/perfModel.json'

describe('the published prior', () => {
  it('carries a CPU regression with its held-out error', () => {
    const p = model.prior?.cpu
    expect(p?.form).toBe('linear')
    expect(p.n).toBeGreaterThan(10)
    expect(p.bands.at(-1).looMedianPct).toBeGreaterThan(0)
    expect(p.bands.at(-1).looMedianPct).toBeLessThan(15)
  })

  it('carries a GPU regression per fitted resolution', () => {
    for (const res of ['1080p', '1440p', '4k']) {
      expect(model.prior?.gpu?.[res]?.form, res).toBe('loglog')
      expect(model.prior.gpu[res].bands.length, res).toBeGreaterThan(1)
    }
  })

  it('states a WORSE error for the low perfScore bands than the high ones', () => {
    // The whole case for shipping a low-end estimate is that its band says how
    // rough it is. If the bands were flat, the number would be lying.
    const bands = model.prior.gpu['1440p'].bands
    const low = bands.find((b) => b.maxPerfScore === 40)
    const high = bands.at(-1)
    expect(low.looMedianPct).toBeGreaterThan(high.looMedianPct)
  })

  it('declares the domain it was fitted over', () => {
    expect(model.prior.cpu.domain[0]).toBeGreaterThan(0)
    expect(model.prior.cpu.domain[1]).toBeGreaterThan(model.prior.cpu.domain[0])
  })

  it('publishes an error that is ACTUALLY TRUE of the shipped coefficients', () => {
    // The entire claim of this feature is "an estimate, and here is how wrong it
    // usually is". A published figure nobody checks is worse than none: it reads
    // as rigour while being decoration. Recompute leave-one-out here from the
    // shipped cpuIndex and assert the artefact agrees.
    const partsData = JSON.parse(
      readFileSync(resolve(process.cwd(), 'src/data/partsData.json'), 'utf8'),
    )
    const list = Array.isArray(partsData) ? partsData : partsData.parts
    const byId = new Map(list.map((p) => [p.id, p]))

    const pairs = Object.entries(model.cpuIndex)
      .map(([id, row]) => ({ x: byId.get(id)?.perfScore, y: row?.value }))
      .filter((p) => p.x > 0 && p.y > 0)

    const solve = (rows) => {
      const n = rows.length
      const mx = rows.reduce((a, r) => a + r.x, 0) / n
      const my = rows.reduce((a, r) => a + r.y, 0) / n
      const sxx = rows.reduce((a, r) => a + (r.x - mx) ** 2, 0)
      const slope = rows.reduce((a, r) => a + (r.x - mx) * (r.y - my), 0) / sxx
      return { slope, intercept: my - slope * mx }
    }
    const errs = pairs.map((p, i) => {
      const f = solve(pairs.filter((_, j) => j !== i))
      return Math.abs(f.slope * p.x + f.intercept - p.y) / p.y * 100
    }).sort((a, b) => a - b)

    const recomputed = errs[Math.floor(errs.length / 2)]
    expect(recomputed).toBeCloseTo(model.prior.cpu.bands.at(-1).looMedianPct, 0)
  })
})
```

Add the imports this test needs at the top of the file:

```js
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
```

`resolve` off `process.cwd()`, not `import.meta.url` — under jsdom the latter is an
`http://` URL that `readFileSync` rejects. Same approach as `sitemap.test.js`.

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/perfPrior.test.js
```

Expected: FAIL — `model.prior` is undefined.

- [ ] **Step 3: Add the fit**

In `scripts/fit-perf-model.mjs`, add near the other constants:

```js
// Band boundaries are FIXED CONSTANTS, deliberately. The error inside each is
// recomputed every run, but fitting the boundaries themselves against n=40
// would overfit the very tail they exist to describe honestly. 25/40/60 were
// read off the error-vs-perfScore curve; move them by hand or not at all.
const PRIOR_BANDS = [25, 40, 60, null]
```

Add this block after the indices are built and before the model is written:

```js
// The spec-derived prior: what we can say about a part no review has charted.
//
// Scored on LEAVE-ONE-OUT error, never in-sample r². At n=24 an r² of 0.97 is
// mostly the range flattering the fit — predicting each part from a fit that
// EXCLUDED it is the only number that describes what the prior will actually do
// to an unmeasured part. Publishing it is what makes this inference rather than
// a guess.
function fitPrior(pairs, { logY }) {
  const t = (v) => (logY ? Math.log(v) : v)
  const inv = (v) => (logY ? Math.exp(v) : v)
  const tx = (v) => (logY ? Math.log(Math.max(v, 0.5)) : v)
  const solve = (rows) => {
    const n = rows.length
    const mx = rows.reduce((a, r) => a + tx(r.x), 0) / n
    const my = rows.reduce((a, r) => a + t(r.y), 0) / n
    const sxx = rows.reduce((a, r) => a + (tx(r.x) - mx) ** 2, 0)
    const slope = sxx > 0 ? rows.reduce((a, r) => a + (tx(r.x) - mx) * (t(r.y) - my), 0) / sxx : 0
    return { slope, intercept: my - slope * mx }
  }
  const { slope, intercept } = solve(pairs)
  const errs = pairs.map((p, i) => {
    const f = solve(pairs.filter((_, j) => j !== i))
    return { x: p.x, err: Math.abs(inv(f.slope * tx(p.x) + f.intercept) - p.y) / p.y * 100 }
  })
  const band = (lo, hi) => {
    const inBand = errs.filter((e) => e.x >= lo && (hi == null || e.x < hi)).map((e) => e.err)
      .sort((a, b) => a - b)
    if (!inBand.length) return null
    return {
      maxPerfScore: hi,
      looMedianPct: round(inBand[Math.floor(inBand.length / 2)], 1),
      looP90Pct: round(inBand[Math.floor(inBand.length * 0.9)], 1),
    }
  }
  let lo = 0
  const bands = []
  for (const hi of PRIOR_BANDS) {
    const b = band(lo, hi)
    if (b) bands.push(b)
    lo = hi ?? lo
  }
  return {
    form: logY ? 'loglog' : 'linear',
    slope: round(slope, 5), intercept: round(intercept, 5), n: pairs.length,
    domain: [Math.min(...pairs.map((p) => p.x)), Math.max(...pairs.map((p) => p.x))],
    bands,
  }
}

const partById = new Map(parts.map((p) => [p.id, p]))
const cpuPairs = [...cpuIndex.entries?.() ?? Object.entries(cpuIndex)]
  .map(([id, row]) => ({ x: partById.get(id)?.perfScore, y: row?.value }))
  .filter((p) => p.x > 0 && p.y > 0)

const prior = { cpu: fitPrior(cpuPairs, { logY: false }), gpu: {} }
for (const res of RESOLUTIONS) {
  const g = Object.entries(gpuIndex)
    .filter(([, row]) => !row.copiedResolutions?.includes(res))
    .map(([id, row]) => ({ x: partById.get(id)?.perfScore, y: row?.[res] }))
    .filter((p) => p.x > 0 && p.y > 0)
  if (g.length >= 5) prior.gpu[res] = fitPrior(g, { logY: true })
}
```

Add `prior` to the written model object.

- [ ] **Step 4: Refit and run the tests**

```bash
npm run perf:fit
```

```bash
npx vitest run src/tests/perfPrior.test.js
```

Expected: PASS. The CPU band should land near 5.5% median; the GPU `maxPerfScore: 40` band far worse than the top band.

- [ ] **Step 5: Commit**

```bash
git add scripts/fit-perf-model.mjs src/data/perfModel.json src/data/perfModel.report.json src/tests/perfPrior.test.js
git commit -m "feat: fit and publish the spec-derived prior with its held-out error"
```

---

### Task 7: `prior.js` — apply the published prior

**Files:**
- Create: `src/lib/perfEngine/prior.js`
- Test: `src/tests/priorApply.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/priorApply.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { applyPrior } from '../lib/perfEngine/prior'

const linear = {
  form: 'linear', slope: 0.52, intercept: 34.04, n: 24, domain: [40, 106],
  bands: [{ maxPerfScore: null, looMedianPct: 5.5, looP90Pct: 13.5 }],
}
const loglog = {
  form: 'loglog', slope: 1.2, intercept: -1.0, n: 40, domain: [15, 132],
  bands: [
    { maxPerfScore: 40, looMedianPct: 34.2, looP90Pct: 89.6 },
    { maxPerfScore: null, looMedianPct: 6.7, looP90Pct: 13.5 },
  ],
}

describe('applyPrior', () => {
  it('predicts from a linear fit and reports the band error', () => {
    const out = applyPrior(linear, 78)
    expect(out.value).toBeCloseTo(0.52 * 78 + 34.04, 5)
    expect(out.errorPct).toBe(5.5)
    expect(out.basis).toBe('prior')
  })

  it('predicts from a log-log fit', () => {
    const out = applyPrior(loglog, 50)
    expect(out.value).toBeCloseTo(Math.exp(1.2 * Math.log(50) - 1.0), 5)
  })

  it('picks the band the part falls in, not the average', () => {
    // A weak card must carry the weak band's error, or the number claims a
    // precision the fit does not have for it.
    expect(applyPrior(loglog, 30).errorPct).toBe(34.2)
    expect(applyPrior(loglog, 80).errorPct).toBe(6.7)
  })

  it('refuses a part with no perfScore rather than inventing one', () => {
    expect(applyPrior(linear, null)).toBeNull()
    expect(applyPrior(linear, 0)).toBeNull()
  })

  it('refuses when there is no fitted prior at all', () => {
    expect(applyPrior(null, 60)).toBeNull()
    expect(applyPrior(undefined, 60)).toBeNull()
  })

  it('flags a part outside the fitted domain as extrapolation', () => {
    // No catalogue CPU is outside today, but the catalogue grows, and silently
    // extrapolating a regression is how a prior stops being data-derived.
    expect(applyPrior(linear, 120).extrapolated).toBe(true)
    expect(applyPrior(linear, 78).extrapolated).toBe(false)
  })

  it('never returns a non-positive index', () => {
    expect(applyPrior({ ...linear, slope: 0, intercept: -5 }, 50)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/priorApply.test.js
```

Expected: FAIL — cannot resolve `../lib/perfEngine/prior`.

- [ ] **Step 3: Implement**

Create `src/lib/perfEngine/prior.js`:

```js
// Applies the prior that scripts/fit-perf-model.mjs fitted. NEVER fits.
//
// One definition, two readers — the same split pageMeta.js uses. The browser
// must not refit: the corpus is not shipped, and a second implementation of the
// regression is a second thing to drift.
//
// Every return carries `basis: 'prior'` and the error of the BAND this part
// falls in, not the fit's average. A weak card's estimate is much rougher than
// a strong one's, and reporting one number for both would overstate the weak
// case exactly where it is already worst.

export function applyPrior(fit, perfScore) {
  if (!fit || !(perfScore > 0)) return null

  const value = fit.form === 'loglog'
    ? Math.exp(fit.slope * Math.log(Math.max(perfScore, 0.5)) + fit.intercept)
    : fit.slope * perfScore + fit.intercept
  if (!(value > 0)) return null

  // Bands are ordered ascending with a null upper bound last.
  const band = fit.bands.find((b) => b.maxPerfScore == null || perfScore < b.maxPerfScore)

  return {
    value,
    basis: 'prior',
    errorPct: band?.looMedianPct ?? null,
    extrapolated: perfScore < fit.domain[0] || perfScore > fit.domain[1],
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/tests/priorApply.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/perfEngine/prior.js src/tests/priorApply.test.js
git commit -m "feat: apply the published prior, carrying its band's error"
```

---

### Task 8: Wire the prior into the index accessors

**Files:**
- Modify: `src/lib/perfEngine/indices.js:10-31`
- Test: `src/tests/indicesPrior.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/indicesPrior.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { cpuIndexFor, gpuIndexFor } from '../lib/perfEngine/indices'

const model = {
  cpuIndex: { 'cpu-known': { value: 70, basis: 'measured', anchors: 12 } },
  gpuIndex: { 'gpu-known': { '1440p': 60, basis: 'measured', anchors: 9 } },
  prior: {
    cpu: { form: 'linear', slope: 0.52, intercept: 34.04, n: 24, domain: [40, 106],
           bands: [{ maxPerfScore: null, looMedianPct: 5.5, looP90Pct: 13.5 }] },
    gpu: { '1440p': { form: 'loglog', slope: 1.2, intercept: -1, n: 40, domain: [15, 132],
           bands: [{ maxPerfScore: null, looMedianPct: 6.7, looP90Pct: 13.5 }] } },
  },
}

describe('index accessors fall back to the prior', () => {
  it('prefers a measurement over the prior', () => {
    const out = cpuIndexFor(model, { id: 'cpu-known', perfScore: 78 })
    expect(out.basis).toBe('measured')
    expect(out.value).toBe(70)
    expect(out.errorPct).toBeNull()
  })

  it('uses the prior for an unmeasured chip that has a perfScore', () => {
    const out = cpuIndexFor(model, { id: 'cpu-new', perfScore: 78 })
    expect(out.basis).toBe('prior')
    expect(out.value).toBeCloseTo(0.52 * 78 + 34.04, 5)
    expect(out.errorPct).toBe(5.5)
  })

  it('still reports none for a part with no measurement AND no perfScore', () => {
    // A gap in the catalogue is not evidence of a slow part, and inventing a
    // perfScore to feed the prior would be the fabrication this all avoids.
    expect(cpuIndexFor(model, { id: 'cpu-new' }).basis).toBe('none')
    expect(gpuIndexFor(model, { id: 'gpu-new' }, '1440p').basis).toBe('none')
  })

  it('uses the per-resolution GPU prior', () => {
    const out = gpuIndexFor(model, { id: 'gpu-new', perfScore: 50 }, '1440p')
    expect(out.basis).toBe('prior')
    expect(out.value).toBeGreaterThan(0)
  })

  it('reports none where no prior was fitted for that resolution', () => {
    expect(gpuIndexFor(model, { id: 'gpu-new', perfScore: 50 }, '4k').basis).toBe('none')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/indicesPrior.test.js
```

Expected: FAIL — the accessors return `basis: 'none'` for an unmeasured part.

- [ ] **Step 3: Implement**

In `src/lib/perfEngine/indices.js`, add the import:

```js
import { applyPrior } from './prior'
```

Change `EMPTY_INDEX` to carry the new field:

```js
const EMPTY_INDEX = { value: null, basis: 'none', anchors: 0, resolutionCopied: false, errorPct: null }
```

Replace `gpuIndexFor` and `cpuIndexFor` with:

```js
export function gpuIndexFor(model, gpu, resolution) {
  const row = gpu?.id ? model?.gpuIndex?.[gpu.id] : null
  const value = row?.[resolution]
  if (value > 0) {
    return {
      value,
      basis: row.basis ?? 'measured',
      anchors: row.anchors ?? 0,
      resolutionCopied: Boolean(row.copiedResolutions?.includes(resolution)),
      errorPct: null,
    }
  }
  // No measurement. The prior is data-derived and publishes its own error, so
  // it is an answer — but never one that reports itself as measured.
  const p = applyPrior(model?.prior?.gpu?.[resolution], gpu?.perfScore)
  if (!p) return { ...EMPTY_INDEX }
  return { value: p.value, basis: p.basis, anchors: 0, resolutionCopied: false,
           errorPct: p.errorPct, extrapolated: p.extrapolated }
}

export function cpuIndexFor(model, cpu) {
  const row = cpu?.id ? model?.cpuIndex?.[cpu.id] : null
  if (row?.value > 0) {
    return {
      value: row.value,
      basis: row.basis ?? 'measured',
      anchors: row.anchors ?? 0,
      resolutionCopied: false,
      errorPct: null,
    }
  }
  const p = applyPrior(model?.prior?.cpu, cpu?.perfScore)
  if (!p) return { ...EMPTY_INDEX }
  return { value: p.value, basis: p.basis, anchors: 0, resolutionCopied: false,
           errorPct: p.errorPct, extrapolated: p.extrapolated }
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/tests/indicesPrior.test.js src/tests/rowBasis.test.js src/tests/perfEngineBasis.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/perfEngine/indices.js src/tests/indicesPrior.test.js
git commit -m "feat: fall back to the published prior when a part was never charted"
```

---

### Task 9: Admit `A`-only cells as ceiling rows, then verify the whole thing

**Files:**
- Modify: `src/lib/perfEngine/index.js:50-64`
- Test: `src/tests/perfCoverage.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/perfCoverage.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { estimateBuildPerformance } from '../lib/perfEngine'
import model from '../data/perfModel.json'
import games from '../data/perfGames.json'
import parts from '../data/partsData.json'

const list = Array.isArray(parts) ? parts : parts.parts
const pick = (id) => list.find((p) => p.id === id)
const gameList = Array.isArray(games) ? games : games.games
const answered = (cpuId, gpuId, resolution) => estimateBuildPerformance({
  parts: { cpu: pick(cpuId), gpu: pick(gpuId) }, resolution, model, games: gameList,
}).games.filter((r) => r.avgFps > 0)

describe('coverage after the widening', () => {
  it('answers for a CPU no review ever charted', () => {
    // Before this work, an i5-13600K build answered ZERO rows at every
    // resolution — a completely blank tab for 54 of 80 catalogue chips.
    expect(answered('cpu-i5-13600k', 'gpu-rtx-4070', '1440p').length).toBeGreaterThan(20)
  })

  it('answers at 1080p, which used to answer nothing', () => {
    expect(answered('cpu-ryzen-5-7600', 'gpu-rtx-4070', '1080p').length).toBeGreaterThan(20)
  })

  it('answers far more games than the 5 the two-way cells allowed', () => {
    expect(answered('cpu-ryzen-5-7600', 'gpu-rtx-4070', '1440p').length).toBeGreaterThan(20)
  })

  it('marks every ceiling row as an upper bound and none as measured', () => {
    for (const r of answered('cpu-i5-13600k', 'gpu-rtx-4070', '1440p')) {
      if (r.basis === 'ceiling') expect(r.bound, r.rowId).toBe('upper')
      if (r.caveats.length) expect(r.basis, r.rowId).not.toBe('measured')
    }
  })

  it('still short-circuits to a real measurement where one exists', () => {
    // The widening must not cost the exact rows their precedence.
    const rows = answered('cpu-ryzen-7-9800x3d', 'gpu-rtx-4070', '1080p')
    expect(rows.some((r) => r.basis === 'measured')).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/tests/perfCoverage.test.js
```

Expected: FAIL — the 13600K answers 0 rows, because `modelled` requires `cell.B > 0`.

- [ ] **Step 3: Implement**

In `src/lib/perfEngine/index.js`, replace the `modelled` block (currently lines 50-57) with:

```js
  // The two-way split needs B. Only 10 cells in the corpus have one, against
  // 121 with an A — a GPU-scaling review pins one CPU on purpose and so can
  // never produce a B. Refusing an A-only cell threw away 92% of the fitted
  // cells and left a typical build showing five games.
  //
  // So an A-only cell answers with the GPU term ALONE, and the row is reported
  // as an upper bound rather than a point (rowBasis gives it `ceiling`). With
  // the CPU term unknown the GPU term genuinely IS the ceiling, so "up to N" is
  // the honest reading, not a hedge.
  const twoWay = cell?.B > 0 && gpuIdx.value > 0 && cpuIdx.value > 0
  const gpuOnly = !twoWay && cell?.A > 0 && gpuIdx.value > 0

  const modelled = twoWay
    ? (() => {
        const tGpu = cell.A / gpuIdx.value
        const tCpu = (cell.B * (model.resCpuScale?.[resolution] ?? 1)) / cpuIdx.value
        const share = cpuShare(tGpu, tCpu, model.blendK)
        return { frameTimeMs: blendFrameTime(tGpu, tCpu, model.blendK), share, tGpu, tCpu }
      })()
    : gpuOnly
      // No share and no tCpu: the split is unknown, and inventing one here is
      // exactly what the "measurement is a duration, not an attribution" rule
      // above forbids. FpsCard already renders "Split not modelled" for this.
      ? { frameTimeMs: cell.A / gpuIdx.value, share: null, tGpu: cell.A / gpuIdx.value, tCpu: null }
      : null
```

Then update the two derived fields in the final return so they tolerate a null `tCpu`:

```js
    cpuShare: modelled?.share == null ? null : Number(modelled.share.toFixed(3)),
    limitedBy: modelled?.share == null ? null : limitedBy(modelled.share),
    gpuOnlyFps: modelled ? Math.round(msToFps(modelled.tGpu)) : null,
    cpuOnlyFps: modelled?.tCpu == null ? null : Math.round(msToFps(modelled.tCpu)),
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/tests/perfCoverage.test.js
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Full suite, lint, build**

```bash
npx vitest run
```

```bash
npm run lint
```

```bash
npm run build
```

Expected: all green. Some pre-existing perf tests may assert the old "answers nothing" behaviour — those assertions were pinning the bug, and updating them is correct, but read each one and say so in the commit rather than deleting it quietly.

- [ ] **Step 6: The before/after sweep**

Write `scripts/sweep-perf-coverage.mjs` (throwaway, not committed) that prints answered-row counts for a spread of builds across all three resolutions, and run it:

```bash
npx vite-node scripts/sweep-perf-coverage.mjs
```

Expected direction, against the figures measured before this work:

| | before | after |
|---|---|---|
| indexed CPU @ 1440p / 4K | 5 / 5 | ~40 / ~40 |
| indexed CPU @ 1080p | 0 | ~40 |
| the 54 unindexed CPUs | 0 everywhere | comparable to an indexed one |
| `ryzen-7-9800x3d` @ 1080p | 77 | ≥ 77 (exact rows keep precedence) |

**A drop anywhere is a regression, not a rounding difference.** The exact-row
count in particular must not fall: the widening must never cost a measurement its
precedence.

- [ ] **Step 7: Verify in the browser**

Start the dev server and open the Performance tab. Confirm, with a build using an
unindexed CPU such as the i5-13600K:

- rows appear where the tab was previously empty
- estimated rows read **"estimate"** with a `±` figure, ceiling rows read **"up to"**
- the **"Only show real data"** toggle empties most of the list, and the mix line above it does **not** change its totals
- **no console errors**

- [ ] **Step 8: Commit**

```bash
git add src/lib/perfEngine/index.js src/tests/perfCoverage.test.js
git commit -m "feat: answer from a GPU-only cell as an upper bound"
```

---

## Done when

- A build with any catalogue CPU answers rows at 1080p, 1440p and 4K.
- No row reports `measured` unless the exact combination was benchmarked, and
  `rowBasis.test.js` asserts it.
- Every `ceiling` row renders as "up to", never as a bare figure.
- The published prior error matches a recomputation **from the shipped
  coefficients**, and the low `perfScore` bands state a worse error than the high
  ones.
- The 1080p rejection rate sits near 4.5%, and `elden-ring` rows at its 60 fps cap
  stay out of the fit. Both rejection rules — peer-ratio where a 1440p partner
  exists, residual everywhere else — use the same shortfall threshold, so a row's
  fate does not depend on which rule happened to reach it.
- A prior applied outside its fitted domain says so, via the `index-extrapolated`
  caveat.
- The "only show real data" toggle never changes the summary totals.
- `npx vitest run`, `npm run lint`, `npm run build` all green.
- Nothing pushed, nothing deployed, no Supabase write.
