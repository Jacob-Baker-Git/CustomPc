import { describe, it, expect } from 'vitest'
import { BUILD_PROFILES, USE_CASES, USE_CASE_LABEL } from '../lib/buildProfiles'

describe('buildProfiles', () => {
  it('has the four use cases', () => {
    expect(Object.keys(BUILD_PROFILES).sort()).toEqual(['everyday', 'gaming', 'programming', 'workstation'])
  })
  it('each profile has weights, an upgrade order and a resolution', () => {
    for (const p of Object.values(BUILD_PROFILES)) {
      expect(typeof p.weights.cpu).toBe('number')
      expect(Array.isArray(p.upgradeOrder)).toBe(true)
      expect(typeof p.resolution).toBe('string')
    }
  })
  it('gaming weights GPU above CPU; programming weights CPU above GPU', () => {
    expect(BUILD_PROFILES.gaming.weights.gpu).toBeGreaterThan(BUILD_PROFILES.gaming.weights.cpu)
    expect(BUILD_PROFILES.programming.weights.cpu).toBeGreaterThan(BUILD_PROFILES.programming.weights.gpu)
  })
  it('USE_CASES cards line up with the profiles and labels', () => {
    expect(USE_CASES.map((u) => u.id).sort()).toEqual(Object.keys(BUILD_PROFILES).sort())
    for (const u of USE_CASES) expect(USE_CASE_LABEL[u.id]).toBe(u.label)
  })
})
