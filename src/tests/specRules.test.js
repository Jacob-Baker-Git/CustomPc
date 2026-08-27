import { describe, it, expect } from 'vitest'
import { evaluateSpecRules, aggregate } from '../lib/specRules'

describe('specRules aggregation', () => {
  it('is ok when every rule is satisfied or inapplicable', () => {
    expect(aggregate([null, null])).toEqual({ status: 'ok', reason: '' })
  })

  it('reports unverified when a rule could not run', () => {
    const r = aggregate([null, { status: 'unverified', reason: 'GPU thickness unknown' }])
    expect(r.status).toBe('unverified')
    expect(r.reason).toBe('GPU thickness unknown')
  })

  // ⚠️ THE assertion of this whole design. A satisfied rule must never mask an
  // unverified one, and an unverified one must never mask a block.
  it('lets blocked win over unverified, and unverified win over ok', () => {
    const results = [
      null,
      { status: 'unverified', reason: 'unknown thing' },
      { status: 'blocked', reason: 'real failure' },
    ]
    expect(aggregate(results)).toEqual({ status: 'blocked', reason: 'real failure' })
  })

  it('returns ok for an empty build', () => {
    expect(evaluateSpecRules({}, { category: 'gpu', specs: {} }).status).toBe('ok')
  })
})

const psu = (connectors) => ({ id: 'p', category: 'psu', specs: connectors ? { connectors } : {} })
const gpu = (specs) => ({ id: 'g', category: 'gpu', specs })

describe('rule 1: power connectors', () => {
  it('blocks a PSU that cannot feed the GPU', () => {
    const parts = { gpu: gpu({ powerConnectors: { pcie8: 3 } }) }
    const r = evaluateSpecRules(parts, psu({ pcie8: 2 }))
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/8-pin/i)
  })

  it('passes a PSU that has enough', () => {
    const parts = { gpu: gpu({ powerConnectors: { pcie8: 3 } }) }
    expect(evaluateSpecRules(parts, psu({ pcie8: 4 })).status).toBe('ok')
  })

  // The RTX 4090 FE case: socket is 12VHPWR, but a 3x8-pin adapter is in the box.
  it('accepts a bundled adapter in place of a native cable', () => {
    const parts = { gpu: gpu({ powerConnectors: { '12vhpwr': 1 }, adapterFrom: { pcie8: 3 } }) }
    expect(evaluateSpecRules(parts, psu({ pcie8: 3 })).status).toBe('ok')
  })

  it('blocks when neither the native cable nor the adapter can be satisfied', () => {
    const parts = { gpu: gpu({ powerConnectors: { '12vhpwr': 1 }, adapterFrom: { pcie8: 3 } }) }
    expect(evaluateSpecRules(parts, psu({ pcie8: 2 })).status).toBe('blocked')
  })

  it('is unverified when the GPU lists no connectors', () => {
    const r = evaluateSpecRules({ gpu: gpu({}) }, psu({ pcie8: 4 }))
    expect(r.status).toBe('unverified')
  })

  it('is unverified when the PSU lists no connectors', () => {
    const r = evaluateSpecRules({ gpu: gpu({ powerConnectors: { pcie8: 3 } }) }, psu(null))
    expect(r.status).toBe('unverified')
  })

  // The CPU side of the same question: the board's EPS headers must be fed too.
  it('blocks a PSU with one EPS cable on a board needing two', () => {
    const b = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { epsConnectors: 2 } }
    const r = evaluateSpecRules({ motherboard: b }, psu({ eps8: 1 }))
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/EPS/i)
  })

  it('passes a PSU with enough EPS cables', () => {
    const b = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: { epsConnectors: 2 } }
    expect(evaluateSpecRules({ motherboard: b }, psu({ eps8: 2 })).status).toBe('ok')
  })

  it('is unverified when the board does not state its EPS headers', () => {
    const b = { id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs: {} }
    expect(evaluateSpecRules({ motherboard: b }, psu({ eps8: 2 })).status).toBe('unverified')
  })
})

const box = (specs) => ({ id: 'c', category: 'case', specs })

describe('rule 2: GPU thickness', () => {
  it('blocks a 4-slot card in a case with 2 expansion slots', () => {
    const r = evaluateSpecRules({ case: box({ expansionSlots: 2 }) }, gpu({ slotsThick: 4 }))
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/slot/i)
  })

  it('passes a 3-slot card in a 7-slot case', () => {
    expect(evaluateSpecRules({ case: box({ expansionSlots: 7 }) }, gpu({ slotsThick: 3 })).status).toBe('ok')
  })

  it('is unverified when the case does not state its slot count', () => {
    expect(evaluateSpecRules({ case: box({}) }, gpu({ slotsThick: 3 })).status).toBe('unverified')
  })

  it('is unverified when the GPU does not state its thickness', () => {
    expect(evaluateSpecRules({ case: box({ expansionSlots: 7 }) }, gpu({})).status).toBe('unverified')
  })
})

const board = (specs) => ({ id: 'm', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', specs })
const drive = (specs) => ({ id: 's', category: 'storage', storageType: 'NVMe SSD', specs })

describe('rule 3: M.2 interface', () => {
  it('blocks a SATA M.2 drive when every slot is PCIe-only', () => {
    const b = board({ m2Slots: [{ pcieGen: 5, sata: false }, { pcieGen: 4, sata: false }] })
    const r = evaluateSpecRules({ motherboard: b }, drive({ m2FormFactor: '2280', m2Sata: true }))
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/SATA/i)
  })

  it('passes a SATA M.2 drive when one slot accepts SATA', () => {
    const b = board({ m2Slots: [{ pcieGen: 5, sata: false }, { pcieGen: 4, sata: true }] })
    expect(evaluateSpecRules({ motherboard: b }, drive({ m2FormFactor: '2280', m2Sata: true })).status).toBe('ok')
  })

  it('blocks any M.2 drive on a board with no M.2 slots at all', () => {
    const r = evaluateSpecRules({ motherboard: board({ m2Slots: [] }) }, drive({ m2FormFactor: '2280', m2Sata: false }))
    expect(r.status).toBe('blocked')
  })

  it('is unverified when the board does not list its M.2 slots', () => {
    expect(evaluateSpecRules({ motherboard: board({}) }, drive({ m2FormFactor: '2280' })).status).toBe('unverified')
  })

  it('checks a 2.5in SATA drive against SATA ports, not M.2 slots', () => {
    const b = board({ m2Slots: [], sataPorts: 4 })
    const sata = { id: 's2', category: 'storage', storageType: 'SATA SSD', specs: {} }
    expect(evaluateSpecRules({ motherboard: b }, sata).status).toBe('ok')
  })

  it('blocks a 2.5in SATA drive on a board with no SATA ports', () => {
    const b = board({ m2Slots: [{ pcieGen: 5, sata: false }], sataPorts: 0 })
    const sata = { id: 's2', category: 'storage', storageType: 'SATA SSD', specs: {} }
    const r = evaluateSpecRules({ motherboard: b }, sata)
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/SATA port/i)
  })

  it('is unverified when the board does not state its SATA ports', () => {
    const b = board({ m2Slots: [] })
    const sata = { id: 's2', category: 'storage', storageType: 'SATA SSD', specs: {} }
    expect(evaluateSpecRules({ motherboard: b }, sata).status).toBe('unverified')
  })
})

const aio = (radiatorMm) => ({ id: 'k', category: 'cooler', sockets: ['AM5'], specs: { type: 'AIO', radiatorMm } })

describe('rule 4: radiator fit', () => {
  it('blocks a 420mm radiator in a case that tops out at 360', () => {
    const c = box({ radiatorSupport: { top: [240, 360], front: [240, 280] } })
    const r = evaluateSpecRules({ case: c }, aio(420))
    expect(r.status).toBe('blocked')
    expect(r.reason).toMatch(/420/)
  })

  it('passes a 360mm radiator when a mount supports it', () => {
    const c = box({ radiatorSupport: { top: [240, 360], front: [240] } })
    expect(evaluateSpecRules({ case: c }, aio(360)).status).toBe('ok')
  })

  it('is unverified when the case does not state radiator support', () => {
    expect(evaluateSpecRules({ case: box({}) }, aio(360)).status).toBe('unverified')
  })

  it('is unverified when the AIO does not state its radiator size', () => {
    const c = box({ radiatorSupport: { top: [360] } })
    expect(evaluateSpecRules({ case: c }, aio(undefined)).status).toBe('unverified')
  })

  it('does not apply to an air cooler', () => {
    const air = { id: 'a', category: 'cooler', sockets: ['AM5'], specs: { type: 'Air', height: 165 } }
    expect(evaluateSpecRules({ case: box({ radiatorSupport: { top: [240] } }) }, air).status).toBe('ok')
  })
})
