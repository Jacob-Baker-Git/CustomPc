import { describe, it, expect } from 'vitest'
import { coverageFor, EXPECTED } from '../../scripts/catalog-coverage-core.mjs'

const gpu = (id, fields = {}, specs = {}) => ({ id, category: 'gpu', ...fields, specs })
const src = (url = 'https://example.com/x') => ({ url, checkedOn: '2026-08-28' })

describe('catalogue coverage', () => {
  it('knows which fields a GPU is expected to carry', () => {
    expect(EXPECTED.gpu.required).toContain('length')
    expect(EXPECTED.gpu.required).toContain('slotsThick')
    // ⚠️ adapterFrom is OPTIONAL: most cards ship no adapter, and a missing one
    // is a fact about the card, not a gap in the research.
    expect(EXPECTED.gpu.optional).toContain('adapterFrom')
    expect(EXPECTED.gpu.required).not.toContain('adapterFrom')
  })

  it('counts a part with no sources as unverified', () => {
    const c = coverageFor('gpu', [gpu('a', { length: 300, tdp: 200 })], {})
    expect(c.total).toBe(1)
    expect(c.verified).toBe(0)
    expect(c.fields.length.present).toBe(1)
    expect(c.fields.length.sourced).toBe(0)
  })

  it('counts a fully sourced part as verified', () => {
    const part = gpu('a',
      { length: 300, tdp: 200 },
      { slotsThick: 3, pcieGen: 4, powerConnectors: { pcie8: 2 }, vram: 12, memType: 'GDDR6X' })
    const sources = { a: Object.fromEntries(EXPECTED.gpu.required.map((k) => [k, src()])) }
    expect(coverageFor('gpu', [part], sources).verified).toBe(1)
  })

  // The whole point of Task 1: a deliberately deleted field, recorded as
  // unverifiable, is DONE — not an outstanding gap.
  it('treats a field recorded as unverifiable as researched', () => {
    const part = gpu('a',
      { tdp: 200 },   // no length at all
      { slotsThick: 3, pcieGen: 4, powerConnectors: { pcie8: 2 }, vram: 12, memType: 'GDDR6X' })
    const sources = {
      a: {
        ...Object.fromEntries(EXPECTED.gpu.required.filter((k) => k !== 'length').map((k) => [k, src()])),
        length: { checkedOn: '2026-08-28', result: 'unverifiable', note: 'page retired' },
      },
    }
    expect(coverageFor('gpu', [part], sources).verified).toBe(1)
  })

  it('does not count a missing optional field against a part', () => {
    const part = gpu('a',
      { length: 300, tdp: 200 },
      { slotsThick: 3, pcieGen: 4, powerConnectors: { pcie8: 2 }, vram: 12, memType: 'GDDR6X' })
    const sources = { a: Object.fromEntries(EXPECTED.gpu.required.map((k) => [k, src()])) }
    expect(coverageFor('gpu', [part], sources).verified).toBe(1)
  })

  it('ignores parts of other categories', () => {
    const parts = [gpu('a', { length: 300, tdp: 200 }), { id: 'b', category: 'psu', specs: {} }]
    expect(coverageFor('gpu', parts, {}).total).toBe(1)
  })

  it('returns null for a category with no expectations yet', () => {
    expect(coverageFor('paste', [], {})).toBeNull()
  })
})
