import { describe, it, expect } from 'vitest'
import { coverageFor, EXPECTED, RATCHETED_KEYS, missingRatchetSources } from '../../scripts/catalog-coverage-core.mjs'

const gpu = (id, fields = {}, specs = {}) => ({ id, category: 'gpu', ...fields, specs })
const pcCase = (id, fields = {}, specs = {}) => ({ id, category: 'case', tdp: 0, ...fields, specs })
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

describe('case expectations', () => {
  it('expects the five fields the compatibility engine actually reads', () => {
    expect(EXPECTED.case.required).toEqual([
      'maxGpuLength', 'maxCoolerHeight', 'supportedFormFactors', 'expansionSlots', 'radiatorSupport',
    ])
    expect(EXPECTED.case.optional).toEqual([])
  })

  it('counts a fully sourced case as verified', () => {
    const part = pcCase('c',
      { maxGpuLength: 400, maxCoolerHeight: 170, supportedFormFactors: ['ATX'] },
      { expansionSlots: 7, radiatorSupport: { top: [240] } })
    const sources = { c: Object.fromEntries(EXPECTED.case.required.map((k) => [k, src()])) }
    expect(coverageFor('case', [part], sources).verified).toBe(1)
  })
})

describe('the ratchet', () => {
  // ⚠️ THE TRAP THIS ENCODES: every case carries `tdp: 0`, meaning "draws
  // nothing". It is a sentinel, not a researched figure. The old global
  // ['length','tdp'] would have demanded a source for 59 such zeros.
  it('never demands a source for a case tdp', () => {
    const part = pcCase('c', { maxGpuLength: 400, maxCoolerHeight: 170, supportedFormFactors: ['ATX'] })
    const sources = {
      c: { maxGpuLength: src(), maxCoolerHeight: src(), supportedFormFactors: src() },
    }
    expect(missingRatchetSources([part], sources, new Set(['case']))).toEqual([])
  })

  it('reports a case field that carries no source', () => {
    const part = pcCase('c', { maxGpuLength: 400, maxCoolerHeight: 170, supportedFormFactors: ['ATX'] })
    expect(missingRatchetSources([part], {}, new Set(['case']))).toEqual([
      'c.maxGpuLength', 'c.maxCoolerHeight', 'c.supportedFormFactors',
    ])
  })

  it('still demands length and tdp for a gpu', () => {
    const g = { id: 'g', category: 'gpu', length: 300, tdp: 200, specs: {} }
    expect(missingRatchetSources([g], {}, new Set(['gpu']))).toEqual(['g.length', 'g.tdp'])
  })

  it('ignores a category that is not yet verified', () => {
    const part = pcCase('c', { maxGpuLength: 400 })
    expect(missingRatchetSources([part], {}, new Set(['gpu']))).toEqual([])
  })

  it('ignores a field the part does not carry', () => {
    const part = pcCase('c', { maxGpuLength: 400 })
    const sources = { c: { maxGpuLength: src() } }
    expect(missingRatchetSources([part], sources, new Set(['case']))).toEqual([])
  })

  it('keeps gpu on length and tdp only', () => {
    expect(RATCHETED_KEYS.gpu).toEqual(['length', 'tdp'])
  })
})

describe('psu expectations', () => {
  const psu = (id, fields = {}, specs = {}) => ({ id, category: 'psu', tdp: 0, ...fields, specs })

  it('expects the three fields the engine actually reads', () => {
    expect(EXPECTED.psu.required).toEqual(['wattage', 'rating', 'connectors'])
    expect(EXPECTED.psu.optional).toEqual([])
  })

  it('counts a fully sourced psu as verified', () => {
    const part = psu('p', { wattage: 850 }, { rating: '80+ Gold', connectors: { pcie8: 4, eps8: 2 } })
    const sources = { p: Object.fromEntries(EXPECTED.psu.required.map((k) => [k, src()])) }
    expect(coverageFor('psu', [part], sources).verified).toBe(1)
  })

  // ⚠️ SAME TRAP AS THE CASE WORK: a PSU carries tdp: 0 because it draws
  // nothing itself. Ratcheting tdp would demand provenance for 53 sentinels.
  it('never demands a source for a psu tdp', () => {
    const part = psu('p', { wattage: 850 })
    expect(missingRatchetSources([part], { p: { wattage: src() } }, new Set(['psu']))).toEqual([])
  })

  it('reports an unsourced psu wattage', () => {
    expect(missingRatchetSources([psu('p', { wattage: 850 })], {}, new Set(['psu']))).toEqual(['p.wattage'])
  })
})
