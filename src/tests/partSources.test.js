import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import partsData from '../data/partsData.json'
import { missingRatchetSources } from '../../scripts/catalog-coverage-core.mjs'

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
  // ⚠️ `rating` could only join this list once all 53 PSUs had one recorded.
  // Adding it earlier would have failed instantly against 53 unsourced values,
  // which is why it waited for the end of the PSU research rather than shipping
  // with `connectors` at the start of it.
  'rating',
  // ⚠️ Same rule as `rating` above, one project later: `height` could only
  // join this list once all 31 air coolers had a source recorded. Adding it at
  // the START of the cooler project would have failed instantly against 31
  // unsourced values. It is safe in the GLOBAL list because coolers are the
  // only category that carries a `specs.height` at all.
  'height',
]

// Researched specs whose key is NOT globally unambiguous.
//
// ⚠️ PER-CATEGORY, and it has to be. `type` means two different things in this
// catalogue. On a COOLER it is "Air" or "AIO" - a researched fact that decides
// WHICH RULE RUNS, since compatibility.js skips the height check for an AIO and
// specRules' rule 4 skips anything that is not one - and all 53 carry a source.
// On a CASE it is "Mid Tower" - a classification nobody measured, that nothing
// blocks on, and that no source entry should ever be demanded for. Putting
// `type` in the global list above fails against 59 cases, which is the same
// mistake the old global ['length','tdp'] ratchet made before RATCHETED_KEYS
// was split per category.
const RESEARCHED_KEYS_BY_CATEGORY = {
  cooler: ['type'],
}

describe('partSources.json', () => {
  it('has a source for every researched spec on every part', () => {
    const missing = []
    for (const part of partsData) {
      const keys = [...RESEARCHED_KEYS, ...(RESEARCHED_KEYS_BY_CATEGORY[part.category] ?? [])]
      for (const key of keys) {
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
      // ⚠️ Tests and their helpers are exempt, and ONLY they: vitest collects
      // from src/tests/ but Vite never bundles it, so nothing here reaches a
      // visitor. The guard is about payload, not about tidiness.
      .filter((f) => !f.replace(/\\/g, '/').includes('/src/tests/'))
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

// The guard above covers `specs.*` only, which is exactly how a wrong top-level
// `length` sat in the catalogue unnoticed for months. Requiring sources for
// every top-level field across all 559 parts today would fail instantly, so it
// is switched on ONE CATEGORY AT A TIME, as each is brought up to standard.
//
// ⚠️ WHICH fields a category owes is per-category and lives in
// catalog-coverage-core.mjs. It is not a global list: a case carries `tdp: 0`
// meaning "draws nothing", and demanding provenance for 59 such sentinels would
// be recording a source for a figure nobody measured.
const VERIFIED_CATEGORIES = new Set(['gpu', 'case', 'psu', 'motherboard', 'cooler'])

describe('verified categories', () => {
  it('requires a source for every ratcheted field once a category is verified', () => {
    const missing = missingRatchetSources(partsData, sources, VERIFIED_CATEGORIES)
    expect(missing, `verified-category fields with no source:\n${missing.join('\n')}`).toEqual([])
  })
})
