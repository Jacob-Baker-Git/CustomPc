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

// ⚠️ TWO builds, and the second one is load-bearing. GPU length is only ever
// decisive against a case that is actually tight: the Fractal Torrent clears
// 467 mm and therefore fits all 79 catalogue GPUs, so in `roomy` NO length
// correction can ever move a verdict. A snapshot of that build alone would be
// blind to the whole point of this project. The Cooler Master Q300L is the
// tightest case in the catalogue at 270 mm and rejects 22 of 79 GPUs today,
// which is what makes a corrected length visible here.
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
