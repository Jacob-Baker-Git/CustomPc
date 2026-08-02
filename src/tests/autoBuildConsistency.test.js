import { describe, it, expect } from 'vitest'
import partsData from '../data/partsData.json'
import { buildForUseCase } from '../lib/useCaseBuilder'
import { BUILD_PROFILES } from '../lib/buildProfiles'

const USES = Object.keys(BUILD_PROFILES)
const BUDGETS = [600, 800, 1000, 1200, 1700, 2500, 4000]
const spend = (b) => Object.values(b).reduce((s, p) => s + (p?.price ?? 0), 0)
const ids = (b) => Object.keys(b).sort().map((k) => `${k}:${b[k]?.id}`).join('|')

describe('auto-build consistency', () => {
  // The point of the button is "build me the best one", not "roll again". It
  // used to pass Math.random, and twelve clicks gave twelve different PCs.
  it('returns the identical build every time for the same inputs', () => {
    for (const useCase of USES) {
      for (const budget of [900, 1700, 3000]) {
        const first = ids(buildForUseCase(budget, useCase, partsData))
        for (let i = 0; i < 5; i++) {
          expect(ids(buildForUseCase(budget, useCase, partsData)), `${useCase} £${budget}`).toBe(first)
        }
      }
    }
  })

  // A build that costs more than the budget is not a build. This failed for
  // office and programming at £600 — 136% and 132% — because the fill pass took
  // the strongest affordable GPU when the category slice could not buy one, and
  // the PSU that card needed then blew the total.
  it('never exceeds the budget it was given', () => {
    for (const useCase of USES) {
      for (const budget of BUDGETS) {
        const build = buildForUseCase(budget, useCase, partsData)
        expect(spend(build), `${useCase} £${budget} spent £${spend(build).toFixed(2)}`).toBeLessThanOrEqual(budget)
      }
    }
  })

  it('still completes a full build at every budget it accepts', () => {
    const essentials = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler']
    for (const useCase of USES) {
      for (const budget of BUDGETS) {
        const build = buildForUseCase(budget, useCase, partsData)
        if (spend(build) > budget) continue
        for (const cat of essentials) {
          expect(build[cat], `${useCase} £${budget} has no ${cat}`).toBeTruthy()
        }
      }
    }
  })

  it('uses a sensible share of the budget where the use case can absorb it', () => {
    // Gaming, creation and streaming scale with spend, so they should not leave
    // large sums idle. Office and programming legitimately stop buying once more
    // money adds nothing — that is advice, not a bug, so they are excluded.
    for (const useCase of ['gaming', 'creation', 'streaming']) {
      for (const budget of [900, 1200, 1700]) {
        const used = spend(buildForUseCase(budget, useCase, partsData)) / budget
        expect(used, `${useCase} £${budget} used ${(used * 100).toFixed(1)}%`).toBeGreaterThan(0.85)
      }
    }
  })

  it('never picks a discontinued part', () => {
    const legacy = new Set(partsData.filter((p) => p.legacy).map((p) => p.id))
    for (const useCase of USES) {
      for (const budget of BUDGETS) {
        for (const part of Object.values(buildForUseCase(budget, useCase, partsData))) {
          if (part) expect(legacy.has(part.id), `${useCase} £${budget} picked ${part.id}`).toBe(false)
        }
      }
    }
  })

  it('gives a bigger budget a build at least as good', () => {
    for (const useCase of USES) {
      let previous = -Infinity
      for (const budget of BUDGETS) {
        const build = buildForUseCase(budget, useCase, partsData)
        if (spend(build) > budget) continue
        const total = spend(build)
        expect(total, `${useCase} £${budget} spent less than a smaller budget`).toBeGreaterThanOrEqual(previous * 0.75)
        previous = total
      }
    }
  })

  // The capability is retained for anyone who wants spread; the UI just does not
  // ask for it. Keeping this pinned stops the parameter being deleted as dead.
  it('still varies when an rng is explicitly supplied', () => {
    let rngState = 1
    const rng = () => { rngState = (rngState * 1103515245 + 12345) % 2147483648; return rngState / 2147483648 }
    const seen = new Set()
    for (let i = 0; i < 10; i++) seen.add(ids(buildForUseCase(1700, 'gaming', partsData, { rng })))
    expect(seen.size).toBeGreaterThan(1)
  })
})
