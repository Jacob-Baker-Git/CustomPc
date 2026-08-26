import { describe, it, expect } from 'vitest'
import gpuSpecs from '../../data/specs/gpuSpecs.json'

// scripts/check-specs.mjs already verifies that bus width x memory clock / 8
// equals the recorded bandwidth. That check is necessary and not sufficient: it
// is satisfied by any internally consistent triple, so a bus width transcribed
// at double the real value passes it cleanly while the derived numbers are all
// wrong. The RX 9060 XT was recorded at 256-bit / 640 GB/s (the real card is
// 128-bit / 320) and sailed through, because 256 x 20 / 8 really is 640.
//
// These are the cross-row invariants that arithmetic on a single row cannot
// see. They are what actually caught it.
const gpus = gpuSpecs.gpus

// Same silicon, same memory configuration — a capacity variant doubles the
// density of the modules, never the width of the bus or the clock they run at.
// Grouping on the things that identify the die is what makes this a check and
// not a restatement of the data.
const dieKey = (s) => `${s.architecture}|${s.shaders}|${s.boostMhz}`

// ⚠️ A shared die is NOT enough to demand shared bandwidth, and the first draft
// of this file got that wrong. The GTX 1660 and 1660 Super are both 1408
// shaders at 1785 MHz on Turing with 6GB, and they legitimately differ 192 vs
// 336 GB/s — the Super moved the same die from GDDR5 to GDDR6. There is no
// memory-type field here to separate them, so the comparison is narrowed to
// pairs whose CAPACITY differs, which is the case this invariant is actually
// about and which a memory-technology change never is.
const isCapacityVariantPair = (a, b) => a.vramGb !== b.vramGb

describe('GPU spec cross-row integrity', () => {
  const groups = new Map()
  for (const [id, spec] of Object.entries(gpus)) {
    if (!(spec.shaders > 0) || !(spec.boostMhz > 0)) continue
    const k = dieKey(spec)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push([id, spec])
  }
  // Every (die, differing capacity) pair in the corpus, flattened.
  const capacityPairs = []
  for (const [key, rows] of groups) {
    for (const [idA, a] of rows) {
      for (const [idB, b] of rows) {
        if (idA >= idB || !isCapacityVariantPair(a, b)) continue
        capacityPairs.push({ key, idA, a, idB, b })
      }
    }
  }

  // Guards the guard. If the corpus ever holds no capacity variants at all the
  // assertion below has nothing to iterate and would pass on an empty set.
  it('has capacity variants to compare', () => {
    expect(capacityPairs.length).toBeGreaterThan(0)
  })

  it('gives capacity variants of one die the same bus and bandwidth', () => {
    for (const { key, idA, a, idB, b } of capacityPairs) {
      const where = `${key}: ${idA} (${a.vramGb}GB) vs ${idB} (${b.vramGb}GB)`
      expect(a.busBits, `${where} — bus widths differ`).toBe(b.busBits)
      expect(a.bandwidthGbs, `${where} — bandwidths differ`).toBe(b.bandwidthGbs)
    }
  })

  // ⚠️ There was a third check here — "a narrower card of an architecture may
  // never have more bandwidth than a wider one" — and it is DELETED rather than
  // loosened, because it is not true. The GTX 1660 Super has 1408 shaders and
  // 336 GB/s while the larger 1660 Ti has 1536 and 288: the Super pairs the
  // smaller die with faster GDDR6, and vendors do that deliberately. Admitting
  // that case needs a 17% tolerance, which is wide enough to let a real error
  // through, so the check would have been shaped entirely by the exception. The
  // capacity-variant invariant above is the sound one, and it is the one that
  // caught the RX 9060 XT.
})

// The specific card the invariants above were written for. Navi 44 is a 128-bit
// part in both capacities; 20 Gbps GDDR6 across 128 bits is 320 GB/s.
describe('RX 9060 XT memory subsystem', () => {
  for (const id of ['gpu-rx-9060xt', 'gpu-rx-9060-xt-8gb']) {
    it(`records ${id} on a 128-bit bus at 320 GB/s`, () => {
      expect(gpus[id].busBits).toBe(128)
      expect(gpus[id].bandwidthGbs).toBe(320)
    })
  }
})
