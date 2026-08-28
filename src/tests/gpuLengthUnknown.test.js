import { describe, it, expect } from 'vitest'
import { compatibilityNotes } from '../lib/partPages'
import { insight } from '../lib/specSheetContent'
import { autoBuild } from '../lib/autoBuilder'
import { checkCompatibility } from '../lib/compatibility'
import { dimensionsCheck } from '../lib/dimensionsCheck'
import partsData from '../data/partsData.json'

// Some cards have no published length. AMD retired the RX 5000-series product
// pages and leaves the Length column BLANK for the RX 5700 on its own
// specification table, so there is nothing to cite and nothing to store.
//
// ⚠️ The research spec says to DELETE an unverifiable field. For `length` that
// is only safe once the readers below stop assuming it is a number: an absent
// length used to print "undefined mm long, so it fits 0 of 59 cases" on the
// public part page, and made the auto-builder filter out EVERY case, because
// `undefined <= 400` is false. These tests pin the safe behaviour so the field
// can be deleted honestly rather than guessed at.
const stripLength = (id) => {
  const rest = { ...partsData.find((p) => p.id === id) }
  delete rest.length
  return rest
}

describe('a GPU whose length nobody publishes', () => {
  const gpu = stripLength('gpu-rx-7600')
  const parts = partsData.map((p) => (p.id === gpu.id ? gpu : p))

  it('never renders the word undefined on the part page', () => {
    const notes = compatibilityNotes(gpu, parts)
    for (const n of notes) {
      expect(n.detail, `${n.label} leaked a missing length`).not.toMatch(/undefined/)
    }
  })

  // The old code claimed "it fits 0 of 59 cases", which is not a cautious
  // reading of missing data — it is a false statement about the hardware.
  it('does not claim the card fits zero cases', () => {
    const notes = compatibilityNotes(gpu, parts)
    const clearance = notes.find((n) => n.label === 'Case clearance')
    if (clearance) expect(clearance.detail).not.toMatch(/fits 0 of/)
  })

  it('never renders the word undefined in the spec-sheet insight', () => {
    expect(insight(gpu)).not.toMatch(/undefined/)
  })

  // The load-bearing one. `undefined <= n` is false for every case in the
  // catalogue, so the fill pass used to end up with an empty candidate list.
  it('can still be auto-built into a complete machine', () => {
    const build = autoBuild({ gpu }, 1600, parts, '1440p')
    expect(build.case, 'auto-build found no case for a GPU with no published length').toBeTruthy()
    expect(build.psu).toBeTruthy()
  })

  // Same invariant the rest of the app already holds: not being able to check
  // is never grounds for taking a part away from somebody.
  it('is not blocked by any case', () => {
    for (const pcCase of parts.filter((p) => p.category === 'case')) {
      const r = checkCompatibility({ case: pcCase }, gpu)
      expect(r.compatible, `${pcCase.id} blocked a GPU of unknown length`).toBe(true)
    }
  })

  // dimensionsCheck already refuses to pass or fail on a figure it does not
  // have, but its copy blamed the user for not selecting parts they HAD
  // selected. The status was right and the sentence was wrong.
  it('says why the length check is unavailable instead of blaming the selection', () => {
    const pcCase = parts.find((p) => p.category === 'case')
    const row = dimensionsCheck({ gpu, case: pcCase }).find((r) => r.id === 'gpu-length')
    expect(row.status, 'cannot pass or fail on a figure we do not have').toBe('na')
    expect(row.detail, 'both parts ARE selected').not.toMatch(/Select a GPU and a case/)
  })
})
