import { describe, it, expect } from 'vitest'
import { specRows } from '../lib/specSheetContent'
import partsData from '../data/partsData.json'

// specRows prints EVERY key in part.specs, and it used to do it with String(v).
// That is fine while every spec is a scalar and silently wrong the moment one
// is not: the RTX 4090's researched `powerConnectors: { "12vhpwr": 1 }` came out
// of it as the literal text "[object Object]" on the public info sheet.
//
// ⚠️ This is not a one-card problem. The catalogue research still to come adds
// `m2Slots` (an ARRAY of objects) and `radiatorSupport` (an object of arrays) to
// hundreds of parts, so this guard is what stops that landing as visible
// gibberish. It reads the real catalogue rather than a fixture, so it keeps
// covering keys nobody has thought of yet.
describe('spec sheet never renders a raw object', () => {
  it('prints no [object Object] anywhere in the catalogue', () => {
    const offenders = []
    for (const part of partsData) {
      for (const [label, value] of specRows(part)) {
        if (String(value).includes('[object')) offenders.push(`${part.id} -> ${label}: ${value}`)
      }
    }
    expect(offenders, `rows rendering a raw object:\n${offenders.join('\n')}`).toEqual([])
  })

  // The project's standing rule for data it cannot present: omit the row rather
  // than assert something false. Same reason coolerCapacity 0 became a hidden
  // row instead of a printed zero.
  it('omits a non-scalar it has no formatter for, rather than inventing text', () => {
    const part = { id: 'x', category: 'gpu', specs: { vram: 24, somethingNobodyPlanned: [{ a: 1 }] } }
    const labels = specRows(part).map(([l]) => l)
    expect(labels).toContain('VRAM (GB)')
    expect(labels.some((l) => /something/i.test(l))).toBe(false)
  })

  it('renders power connectors as readable text', () => {
    const gpu = partsData.find((p) => p.id === 'gpu-rtx-4090')
    const row = specRows(gpu).find(([l]) => /power connector/i.test(l))
    expect(row).toBeDefined()
    expect(row[1]).toMatch(/12VHPWR/i)
    expect(row[1]).not.toMatch(/\[object/)
  })
})
