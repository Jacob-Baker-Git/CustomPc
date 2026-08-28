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
        if (entry.result === 'unverifiable') continue
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

// Together with the guard above this makes provenance a bijection: every
// researched spec needs a source, AND every source must describe a spec that is
// actually there — or explicitly record that it does not exist. Without the
// second half the file drifts into claiming provenance for data nobody ever
// added, which is exactly the state it shipped in, with four entries for RTX
// 4090 specs the part did not carry.
//
// ⚠️ Covers top-level fields too (`length`, `tdp`, `socket`), not just
// `specs.*`. Those predate the research standard and are NOT yet required to
// have sources — but once one is recorded, it has to be true.
//
// A researched figure that turns out not to be published anywhere is a RESULT,
// not an absence of work. Recording it is what lets the coverage report tell
// "we looked and there is nothing" apart from "nobody has looked yet", and it
// is the only way a legacy card whose page is gone can ever be counted as done.
describe('unverifiable records', () => {
  const unverifiable = (entry) => entry?.result === 'unverifiable'

  it('lets a source describe an absent field when the result is unverifiable', () => {
    const byId = new Map(partsData.map((p) => [p.id, p]))
    const orphans = []
    for (const [partId, specs] of Object.entries(sources)) {
      if (partId.startsWith('_')) continue
      const part = byId.get(partId)
      if (!part) continue
      for (const [key, entry] of Object.entries(specs)) {
        const present = part.specs?.[key] !== undefined || part[key] !== undefined
        if (!present && !unverifiable(entry)) orphans.push(`${partId}.${key}`)
      }
    }
    expect(orphans, `sources describing nothing:\n${orphans.join('\n')}`).toEqual([])
  })

  // ⚠️ An unverifiable record must carry a reason. "We could not find it" with
  // no explanation is indistinguishable from not having tried.
  it('requires a checkedOn date and a note, and forbids a bare url claim', () => {
    for (const [partId, specs] of Object.entries(sources)) {
      if (partId.startsWith('_')) continue
      for (const [key, entry] of Object.entries(specs)) {
        if (!unverifiable(entry)) continue
        expect(entry.checkedOn, `${partId}.${key}`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(String(entry.note ?? ''), `${partId}.${key} needs a note`).not.toBe('')
        expect(entry.url, `${partId}.${key} must not claim a url`).toBeUndefined()
      }
    }
  })

  // The field must actually be gone. Recording "unverifiable" while leaving the
  // old guessed number in place is the worst of both worlds.
  it('refuses an unverifiable record for a field that is still present', () => {
    const byId = new Map(partsData.map((p) => [p.id, p]))
    const contradictions = []
    for (const [partId, specs] of Object.entries(sources)) {
      if (partId.startsWith('_')) continue
      const part = byId.get(partId)
      if (!part) continue
      for (const [key, entry] of Object.entries(specs)) {
        if (!unverifiable(entry)) continue
        const present = part.specs?.[key] !== undefined || part[key] !== undefined
        if (present) contradictions.push(`${partId}.${key}`)
      }
    }
    expect(contradictions, `marked unverifiable but still carrying a value:\n${contradictions.join('\n')}`).toEqual([])
  })
})
