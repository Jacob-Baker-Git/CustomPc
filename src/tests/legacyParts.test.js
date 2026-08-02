import { describe, it, expect } from 'vitest'
import partsData from '../data/partsData.json'
import { autoBuild } from '../lib/autoBuilder'
import { partUpgradeOptions } from '../lib/partRatings'

const legacy = partsData.filter((p) => p.legacy === true)
const legacyIds = new Set(legacy.map((p) => p.id))

// Discontinued parts exist so someone can say "this is what I already own" in
// the upgrade flow, and so the browser is a useful reference. They must never be
// RECOMMENDED: a card that has not been made for six years cannot be bought at
// anything like our recorded price, so suggesting one is advice nobody can act
// on — the misleading-price problem the terms page disclaims.
describe('legacy parts', () => {
  it('has legacy parts to test with', () => {
    expect(legacy.length).toBeGreaterThan(0)
  })

  it('marks every legacy part with a real category and price', () => {
    for (const p of legacy) {
      expect(p.category, `${p.id}`).toBeTruthy()
      expect(typeof p.price, `${p.id}`).toBe('number')
    }
  })

  it('never auto-builds a legacy part, at any budget', () => {
    for (const budget of [400, 800, 1200, 1700, 3000, 6000]) {
      const build = autoBuild({}, budget, partsData, '1440p')
      for (const [cat, part] of Object.entries(build)) {
        if (!part) continue
        expect(legacyIds.has(part.id), `£${budget} picked legacy ${part.id} for ${cat}`).toBe(false)
      }
    }
  })

  it('never suggests upgrading TO a legacy part', () => {
    // Start from a genuinely weak legacy build so plenty of upgrades qualify.
    const parts = {
      cpu: partsData.find((p) => p.id === 'cpu-ryzen-5-3600'),
      gpu: partsData.find((p) => p.id === 'gpu-gtx-1060-6gb'),
    }
    expect(parts.cpu).toBeTruthy()
    expect(parts.gpu).toBeTruthy()

    for (const cat of ['cpu', 'gpu']) {
      const opts = partUpgradeOptions(parts, 'gaming', cat, partsData, { limit: 20 })
      expect(opts.length, `no ${cat} upgrades offered`).toBeGreaterThan(0)
      for (const o of opts) {
        expect(legacyIds.has(o.toPart.id), `suggested legacy ${o.toPart.id}`).toBe(false)
      }
    }
  })

  it('still lets a legacy part be chosen by hand', () => {
    // The upgrade flow needs these selectable — that is the point of keeping
    // them. autoBuild locks parts already in the selection by default.
    const owned = partsData.find((p) => p.id === 'gpu-gtx-1070')
    const build = autoBuild({ gpu: owned }, 1200, partsData, '1440p')
    expect(build.gpu.id).toBe('gpu-gtx-1070')
  })

  it('gives every legacy CPU socket a motherboard that fits it', () => {
    const boards = new Set(partsData.filter((p) => p.category === 'motherboard').map((p) => p.socket))
    for (const c of legacy.filter((p) => p.category === 'cpu')) {
      expect(boards.has(c.socket), `${c.id} socket ${c.socket} has no board`).toBe(true)
    }
  })
})
