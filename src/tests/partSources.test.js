import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import partsData from '../data/partsData.json'

const sources = JSON.parse(readFileSync(resolve(process.cwd(), 'data/partSources.json'), 'utf8'))

// Every spec added under the research standard. A spec listed here MUST carry a
// source; the plain fields that predate the standard are exempt because they
// have not been verified yet - see the follow-on task in the design doc.
const RESEARCHED_KEYS = [
  'slotsThick', 'pcieGen', 'powerConnectors', 'adapterFrom',
  'ramSlots', 'maxRamGb', 'maxRamSpeed', 'epsConnectors', 'sataPorts', 'm2Slots',
  'expansionSlots', 'radiatorSupport',
  'ratedTdpW', 'radiatorMm',
  'connectors', 'formFactor',
  'm2FormFactor', 'm2Sata',
]

describe('partSources.json', () => {
  it('has a source for every researched spec on every part', () => {
    const missing = []
    for (const part of partsData) {
      for (const key of RESEARCHED_KEYS) {
        if (part.specs?.[key] === undefined) continue
        if (!sources[part.id]?.[key]) missing.push(`${part.id}.${key}`)
      }
    }
    expect(missing, `specs with no recorded source:\n${missing.join('\n')}`).toEqual([])
  })

  it('gives every source a URL and an ISO date', () => {
    for (const [partId, specs] of Object.entries(sources)) {
      if (partId.startsWith('_')) continue
      for (const [key, entry] of Object.entries(specs)) {
        expect(entry.url, `${partId}.${key}`).toMatch(/^https:\/\//)
        expect(entry.checkedOn, `${partId}.${key}`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })

  // ⚠️ This file must never ship. partsData.json already costs every visitor
  // 163 kB; provenance URLs are for us, not for them.
  it('is not imported anywhere in src/', () => {
    // ⚠️ Imports at the top, NOT require() — this file is ESM under Vitest and
    // require is not defined in it.
    const walk = (dir) =>
      readdirSync(dir).flatMap((f) => {
        const p = resolve(dir, f)
        return statSync(p).isDirectory() ? walk(p) : [p]
      })
    const offenders = walk(resolve(process.cwd(), 'src'))
      .filter((f) => /\.(js|jsx)$/.test(f))
      .filter((f) => !f.endsWith('partSources.test.js'))
      .filter((f) => readFileSync(f, 'utf8').includes('partSources.json'))
    expect(offenders).toEqual([])
  })
})

// The inverse of the guard above, and together they make it a bijection: every
// researched spec needs a source, AND every source must describe a spec that is
// actually there. Without this second half the file drifts into claiming
// provenance for data nobody ever added — which is exactly the state it shipped
// in, with four entries for the RTX 4090 naming specs the part did not carry.
//
// ⚠️ Checks top-level fields too (`length`, `tdp`, `socket`), not just
// `specs.*`. Those predate the research standard and are NOT yet required to
// have sources — but once one is recorded, it has to be true.
describe('every recorded source describes a spec that exists', () => {
  it('has no provenance entry for an absent field', () => {
    const byId = new Map(partsData.map((p) => [p.id, p]))
    const orphans = []
    for (const [partId, specs] of Object.entries(sources)) {
      if (partId.startsWith('_')) continue
      const part = byId.get(partId)
      if (!part) {
        orphans.push(`${partId} (no such part)`)
        continue
      }
      for (const key of Object.keys(specs)) {
        if (part.specs?.[key] === undefined && part[key] === undefined) {
          orphans.push(`${partId}.${key}`)
        }
      }
    }
    expect(orphans, `sources describing nothing:\n${orphans.join('\n')}`).toEqual([])
  })
})
