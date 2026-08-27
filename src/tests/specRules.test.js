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
