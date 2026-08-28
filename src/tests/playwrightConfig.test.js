import { describe, it, expect } from 'vitest'
import config from '../../playwright.config.js'

// The e2e suite runs close to its own ceiling on this machine: unrelated specs
// in topBar.spec.js have been measured at 10-28.6s against what was a 30s cap,
// and with no retries a single slow run turned the whole suite red for no
// reason. That happened on 2026-08-27 — wizard.spec.js timed out at 30s, then
// passed 10/10 in isolation at 1.2-3.8s and the full suite went green on a plain
// re-run. Nothing was wrong with the app.
//
// Retries do NOT hide a real break: every attempt has to fail for the test to
// fail, and Playwright reports a pass-after-retry as "flaky" rather than
// swallowing it. What they buy is that ambient load stops producing false reds.
describe('playwright config', () => {
  it('tolerates a single ambient flake rather than failing the run', () => {
    expect(config.retries).toBeGreaterThanOrEqual(1)
  })

  // 28.6s observed against a 30s cap is not headroom, it is a coin toss.
  it('gives a slow-but-healthy spec real headroom over the observed worst case', () => {
    expect(config.timeout).toBeGreaterThanOrEqual(45000)
  })
})
