import { describe, it, expect } from 'vitest'
import { onlyRealData, basisMix } from '../lib/perfEngine/rowBasis'

const rows = [
  { basis: 'measured', avgFps: 100 },
  { basis: 'modelled', avgFps: 90 },
  { basis: 'spec-derived', avgFps: 80 },
  { basis: 'ceiling', avgFps: 70 },
  { basis: 'none', avgFps: null },
]

describe('the real-data filter', () => {
  it('keeps only benchmarked and modelled rows', () => {
    expect(onlyRealData(rows).map((r) => r.basis)).toEqual(['measured', 'modelled'])
  })

  it('counts the mix from the UNFILTERED rows', () => {
    // Turning the filter on must not change the totals the summary reports,
    // or the control could be used to hide how few rows are measured.
    expect(basisMix(rows)).toEqual({ measured: 1, modelled: 1, estimated: 2 })
    expect(basisMix(onlyRealData(rows))).not.toEqual(basisMix(rows))
  })

  it('always sums the three buckets to the answered-row count, even for an unrecognised basis', () => {
    // A tier added later without this file being touched must still be
    // counted somewhere, or the summary's totals stop matching how many rows
    // were actually answered — undercounting silently rather than erroring.
    const withUnknownTier = [...rows, { basis: 'totally-new-tier', avgFps: 60 }]
    const mix = basisMix(withUnknownTier)
    const answered = withUnknownTier.filter((r) => r.avgFps > 0).length
    expect(mix.measured + mix.modelled + mix.estimated).toBe(answered)
  })
})
