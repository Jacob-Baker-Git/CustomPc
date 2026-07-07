import { describe, it, expect } from 'vitest'
import { BUILD_PROFILES, USE_CASES, USE_CASE_LABEL } from '../lib/buildProfiles'

const IDS = ['creation', 'gaming', 'office', 'programming', 'streaming']

describe('buildProfiles', () => {
  it('has the five use cases', () => {
    expect(Object.keys(BUILD_PROFILES).sort()).toEqual(IDS)
  })
  it('each profile has weights, expect, an upgrade order and a resolution', () => {
    for (const p of Object.values(BUILD_PROFILES)) {
      expect(typeof p.weights.cpu).toBe('number')
      expect(typeof p.expect.cpu).toBe('number')
      expect(Array.isArray(p.upgradeOrder)).toBe(true)
      expect(typeof p.resolution).toBe('string')
    }
  })
  it('gaming weights GPU above CPU; programming weights CPU above GPU', () => {
    expect(BUILD_PROFILES.gaming.weights.gpu).toBeGreaterThan(BUILD_PROFILES.gaming.weights.cpu)
    expect(BUILD_PROFILES.programming.weights.cpu).toBeGreaterThan(BUILD_PROFILES.programming.weights.gpu)
  })
  it('gaming expects a stronger GPU than office does', () => {
    expect(BUILD_PROFILES.gaming.expect.gpu).toBeGreaterThan(BUILD_PROFILES.office.expect.gpu)
  })
  it('USE_CASES cards line up with the profiles and labels', () => {
    expect(USE_CASES.map((u) => u.id).sort()).toEqual(IDS)
    for (const u of USE_CASES) expect(USE_CASE_LABEL[u.id]).toBe(u.label)
  })
})
