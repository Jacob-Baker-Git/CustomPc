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
