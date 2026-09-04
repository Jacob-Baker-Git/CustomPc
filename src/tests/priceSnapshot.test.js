import { describe, it, expect } from 'vitest'
import { PRICE_SNAPSHOT } from '../lib/siteContent'

// The site pitches its prices as "curated estimates (<month>)". A hand-kept date
// rots silently, which quietly undermines the one credibility claim the pricing
// makes — so this turns silent rot into a LOUD, dated failure.
//
// ⚠️ The staleness test below is SUPPOSED to fail with the passage of time and no
// code change. That is the whole point: once PRICE_SNAPSHOT is more than four
// months behind today, the build breaks until someone re-checks the catalogue
// prices and bumps the constant in src/lib/siteContent.js. Do not "fix" a failure
// here by widening the window — bump the date, having actually reviewed prices.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const parseSnapshot = (s) => {
  const [month, year] = String(s).split(' ')
  return { monthIdx: MONTHS.indexOf(month), year: Number(year) }
}

describe('PRICE_SNAPSHOT', () => {
  it('is a well-formed "Month YYYY"', () => {
    // A typo ("Setpember 2026") must fail loudly here rather than parse to NaN
    // and silently disable the staleness check below.
    const { monthIdx, year } = parseSnapshot(PRICE_SNAPSHOT)
    expect(monthIdx).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(year)).toBe(true)
    expect(year).toBeGreaterThanOrEqual(2026)
  })

  it('is no more than four months behind today', () => {
    const { monthIdx, year } = parseSnapshot(PRICE_SNAPSHOT)
    const now = new Date()
    const monthsBehind = (now.getFullYear() - year) * 12 + (now.getMonth() - monthIdx)
    // A snapshot dated in the future would be a mistake too, so pin both ends.
    expect(monthsBehind).toBeGreaterThanOrEqual(0)
    expect(monthsBehind).toBeLessThanOrEqual(4)
  })
})
