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

describe('build profiles needs', () => {
  it('every profile has ramGb/storageGb/vram targets', () => {
    for (const [id, p] of Object.entries(BUILD_PROFILES)) {
      expect(p.needs, id).toBeTruthy()
      expect(p.needs.ramGb, id).toBeGreaterThan(0)
      expect(p.needs.storageGb, id).toBeGreaterThan(0)
      expect(p.needs.vram, id).toBeGreaterThan(0)
    }
  })
  it('creation wants more RAM and VRAM than office', () => {
    expect(BUILD_PROFILES.creation.needs.ramGb).toBeGreaterThan(BUILD_PROFILES.office.needs.ramGb)
    expect(BUILD_PROFILES.creation.needs.vram).toBeGreaterThan(BUILD_PROFILES.office.needs.vram)
  })
})
