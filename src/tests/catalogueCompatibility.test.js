import { describe, it, expect } from 'vitest'
import partsData from '../data/partsData.json'
import { checkCompatibility } from '../lib/compatibility'
import { accountedFor } from './support/provenance'

// Catalogue-wide compatibility audit.
//
// The per-build checks in compatibility.test.js ask "does this pair fit?".
// These ask a different question: is any part in the catalogue UNUSABLE — a CPU
// whose socket has no board, a GPU longer than every case, memory no board
// accepts? Those never surface as a failed build; the part simply never appears
// as an option, or worse, appears and then locks everything else out.
//
// This is the check to run after widening the catalogue. It caught nothing at
// 554 parts, which is the point: it is cheap to keep true and expensive to
// discover broken.

const of = (c) => partsData.filter((p) => p.category === c)
const cpus = of('cpu')
const boards = of('motherboard')
const rams = of('ram')
const cases = of('case')
const gpus = of('gpu')
const coolers = of('cooler')
const psus = of('psu')

describe('catalogue coverage', () => {
  it('has parts in every category the builder fills', () => {
    for (const [name, list] of Object.entries({ cpus, boards, rams, cases, gpus, coolers, psus })) {
      expect(list.length, `${name} is empty`).toBeGreaterThan(0)
    }
  })

  it('gives every CPU socket at least one motherboard', () => {
    const sockets = new Set(boards.map((b) => b.socket))
    for (const c of cpus) expect(sockets.has(c.socket), `${c.id} socket ${c.socket}`).toBe(true)
  })

  it('gives every motherboard memory it can actually take', () => {
    const types = new Set(rams.map((r) => r.ramType))
    for (const b of boards) expect(types.has(b.ramType), `${b.id} wants ${b.ramType}`).toBe(true)
  })

  it('gives every motherboard a case that fits its form factor', () => {
    for (const b of boards) {
      const fits = cases.some((c) => !Array.isArray(c.supportedFormFactors) || c.supportedFormFactors.includes(b.formFactor))
      expect(fits, `${b.id} is ${b.formFactor}, no case takes it`).toBe(true)
    }
  })

  it('gives every CPU a cooler that mounts on its socket', () => {
    for (const c of cpus) {
      const fits = coolers.some((k) => !Array.isArray(k.sockets) || k.sockets.includes(c.socket))
      expect(fits, `${c.id} socket ${c.socket} has no cooler`).toBe(true)
    }
  })

  it('gives every GPU a case long enough for it', () => {
    for (const g of gpus) {
      // A card with no published length cannot be measured against anything.
      // Asserting it fits would be as false as asserting it does not.
      if (typeof g.length !== 'number') continue
      const fits = cases.some((c) => typeof c.maxGpuLength !== 'number' || g.length <= c.maxGpuLength)
      expect(fits, `${g.id} is ${g.length}mm, longest case clearance is ${Math.max(...cases.map((c) => c.maxGpuLength ?? 0))}mm`).toBe(true)
    }
  })

  it('gives every air cooler a case tall enough for it', () => {
    for (const k of coolers) {
      if (k.specs?.type === 'AIO') continue
      const h = k.specs?.height
      if (h == null) continue
      const fits = cases.some((c) => typeof c.maxCoolerHeight !== 'number' || h <= c.maxCoolerHeight)
      expect(fits, `${k.id} is ${h}mm tall, no case fits it`).toBe(true)
    }
  })

  // A PSU that cannot run the heaviest pair in the catalogue would make the
  // top of the range unbuildable.
  it('can power the hungriest CPU and GPU together', () => {
    const draw = Math.max(...cpus.map((p) => p.tdp ?? 0)) + Math.max(...gpus.map((p) => p.tdp ?? 0))
    const best = Math.max(...psus.map((p) => p.wattage ?? 0))
    expect(best, `heaviest CPU+GPU draw ${draw}W, biggest PSU ${best}W`).toBeGreaterThanOrEqual(draw)
  })
})

describe('catalogue field hygiene', () => {
  it('gives every part an id, a category, a name and a non-negative price', () => {
    const seen = new Set()
    for (const p of partsData) {
      expect(p.id, `${p.name} has no id`).toBeTruthy()
      expect(seen.has(p.id), `duplicate id ${p.id}`).toBe(false)
      seen.add(p.id)
      expect(p.category, `${p.id} has no category`).toBeTruthy()
      expect(p.name, `${p.id} has no name`).toBeTruthy()
      expect(typeof p.price, `${p.id} price is not a number`).toBe('number')
      expect(p.price, `${p.id} price is negative`).toBeGreaterThanOrEqual(0)
    }
  })

  // Each rule in compatibility.js reads a specific field. A part missing one
  // does not error — it silently passes every check that field governs, which
  // is how an incompatible part becomes selectable.
  it('gives every part the fields its own compatibility rules read', () => {
    for (const c of cpus) expect(c.socket, `${c.id} has no socket`).toBeTruthy()
    for (const b of boards) {
      expect(b.socket, `${b.id} has no socket`).toBeTruthy()
      expect(b.ramType, `${b.id} has no ramType`).toBeTruthy()
      expect(b.formFactor, `${b.id} has no formFactor`).toBeTruthy()
    }
    for (const r of rams) expect(r.ramType, `${r.id} has no ramType`).toBeTruthy()
    // Or provenance records why it never will — see support/provenance.js.
    for (const g of gpus) expect(accountedFor(g, 'length'), `${g.id} has no length and no recorded reason`).toBe(true)
    for (const p of psus) expect(typeof p.wattage, `${p.id} has no wattage`).toBe('number')
    for (const c of cases) {
      expect(Array.isArray(c.supportedFormFactors), `${c.id} has no supportedFormFactors`).toBe(true)
      expect(typeof c.maxGpuLength, `${c.id} has no maxGpuLength`).toBe('number')
    }
    for (const k of coolers) expect(Array.isArray(k.sockets), `${k.id} has no sockets`).toBe(true)
  })

  it('draws power for everything that consumes it', () => {
    for (const p of partsData) {
      if (p.category === 'psu' || p.category === 'case' || p.category === 'paste') continue
      expect(typeof p.tdp, `${p.id} has no tdp`).toBe('number')
    }
  })
})

describe('every part is reachable in some build', () => {
  // Nothing may be permanently locked out: for each part there must exist at
  // least one companion set it passes checkCompatibility against. Checked
  // against the pairing most likely to reject it rather than all 554^2 pairs.
  it('accepts every CPU with some motherboard, and vice versa', () => {
    for (const c of cpus) {
      const ok = boards.some((b) => checkCompatibility({ motherboard: b }, c).compatible)
      expect(ok, `${c.id} pairs with no motherboard`).toBe(true)
    }
    for (const b of boards) {
      const ok = cpus.some((c) => checkCompatibility({ cpu: c }, b).compatible)
      expect(ok, `${b.id} pairs with no CPU`).toBe(true)
    }
  })

  it('accepts every stick of memory with some motherboard', () => {
    for (const r of rams) {
      const ok = boards.some((b) => checkCompatibility({ motherboard: b }, r).compatible)
      expect(ok, `${r.id} pairs with no motherboard`).toBe(true)
    }
  })

  it('accepts every GPU in some case', () => {
    for (const g of gpus) {
      const ok = cases.some((c) => checkCompatibility({ case: c }, g).compatible)
      expect(ok, `${g.id} fits no case`).toBe(true)
    }
  })

  it('accepts every cooler on some CPU and in some case', () => {
    for (const k of coolers) {
      expect(cpus.some((c) => checkCompatibility({ cpu: c }, k).compatible), `${k.id} fits no CPU`).toBe(true)
      expect(cases.some((c) => checkCompatibility({ case: c }, k).compatible), `${k.id} fits no case`).toBe(true)
    }
  })
})
