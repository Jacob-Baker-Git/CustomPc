import { describe, it, expect } from 'vitest'
import { checkCompatibility } from '../lib/compatibility'
import partsData from '../data/partsData.json'

// Research changes what the app blocks. That is the point — but it should never
// change SILENTLY. This snapshots the verdict spread against fixed reference
// builds, so every tranche's effect on selectability shows up as a diff a human
// reads and approves, rather than something discovered by a user.
//
// ⚠️ It lives under Vitest rather than in a script because `src/lib` uses
// extensionless imports that plain node cannot resolve, and `vite-node` is NOT
// a local dependency — npx fetches it from the registry.
//
// To accept a change: `npx vitest run src/tests/verdictSpread.test.js -u`, then
// READ THE DIFF before committing it.
const byId = (id) => partsData.find((p) => p.id === id)

// ⚠️ TWO builds, and the second one is the tight one. The Fractal Torrent
// clears 461 mm and fits every catalogue GPU, so `roomy` can never show a
// length correction; `cramped` is the small-case counterpart.
//
// 🛑 GPU LENGTH NOW BLOCKS NOTHING, and that is a finding rather than a fault.
// This comment used to say the Q300L was "the tightest case in the catalogue at
// 270 mm and rejects 22 of 79 GPUs". Cooler Master states 360 mm; the 270 mm
// was wrong by 90 mm, and it was refusing 25 of 79 cards. With the case
// catalogue researched, the longest card is 320 mm and the tightest case clears
// 320 mm, so ZERO of the 4,661 GPU/case pairs are length-blocked.
//
// So this snapshot is no longer sensitive to GPU length at all. It is kept for
// the dimensions that DO still decide verdicts here — cooler height, board form
// factor, slot thickness — and the length rule itself is covered by a synthetic
// fixture in compatibility.test.js, which the catalogue cannot invalidate.
const REFERENCE_BUILDS = {
  roomy: {
    motherboard: byId('mb-asus-x670e'),
    cpu: byId('cpu-ryzen-7-7700x'),
    case: byId('case-fractal-torrent'),
    psu: byId('psu-corsair-rm1000x'),
  },
  cramped: {
    // mATX, because the Q300L takes no ATX board — a build that is itself
    // incompatible would make the counts meaningless.
    motherboard: byId('mb-msi-b650m-mortar'),
    cpu: byId('cpu-ryzen-7-7700x'),
    case: byId('case-cm-q300l'),
    psu: byId('psu-corsair-rm1000x'),
  },
}

const spreadFor = (build) => {
  const spread = {}
  for (const part of partsData) {
    const { status } = checkCompatibility(build, part)
    spread[part.category] ??= { ok: 0, blocked: 0, unverified: 0 }
    spread[part.category][status]++
  }
  return Object.fromEntries(Object.entries(spread).sort(([a], [b]) => a.localeCompare(b)))
}

describe('verdict spread', () => {
  for (const [name, build] of Object.entries(REFERENCE_BUILDS)) {
    it(`matches the committed snapshot (${name})`, () => {
      expect(spreadFor(build)).toMatchSnapshot()
    })
  }

  // ⚠️ The load-bearing invariant, independent of the snapshot: an unverified
  // rule means we could not check, which is never grounds for taking a part
  // away from somebody.
  it('never lets an unverified verdict make a part incompatible', () => {
    for (const build of Object.values(REFERENCE_BUILDS)) {
      for (const part of partsData) {
        const r = checkCompatibility(build, part)
        if (r.status === 'unverified') expect(r.compatible, part.id).toBe(true)
      }
    }
  })
})
