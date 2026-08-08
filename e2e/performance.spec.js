import { test, expect } from '@playwright/test'
import { generateBuild, openTab } from './helpers.js'

// The engine's one non-negotiable rule is that it never renders an unmeasured
// number as measured. Six separate bugs have been that same failure wearing
// different hats, and every one of them was a UI-layer leak — a card drawing a
// bar from a null, a footer counting rows it did not render. jsdom can prove
// the accessors return the right basis; only a real render proves the screen
// agrees with them.
test.describe('the performance tab', () => {
  test.beforeEach(async ({ page }) => {
    await generateBuild(page)
    await openTab(page, 'performance')
  })

  test('renders exactly as many frame rates as it claims coverage for', async ({ page }) => {
    // The report footer states both counts outright: "N of M games answered,
    // K measured directly". Reading them from there rather than from the
    // summary tile is deliberate — the footer counting rows the list did not
    // actually render is one of the bugs this file exists to catch.
    const footer = await page.getByText(/games answered/i).first().innerText()
    const [, answered, total, measured] =
      /(\d+)\s+of\s+(\d+)\s+games answered,\s*(\d+)\s+measured directly/i.exec(footer)

    expect(Number(total)).toBeGreaterThan(0)

    // A basis badge is the engine's own label for where a number came from. One
    // per answered game, no more and no fewer: a badge with no frame rate beside
    // it, or a frame rate with no badge, breaks this count.
    const badges = page.getByText(/^(measured|modelled|from specs)$/i)
    expect(await badges.count(), `one basis badge per answered game — footer said "${footer}", badges seen: ${JSON.stringify(await badges.allInnerTexts())}`)
      .toBe(Number(answered))

    // And "measured" specifically may not outrun what was actually measured.
    const measuredBadges = page.getByText(/^measured$/i)
    expect(await measuredBadges.count(), 'measured badges match the measured count')
      .toBe(Number(measured))

    // The uncovered heading has to account for the remainder rather than
    // quietly listing fewer games than it claims.
    const rest = Number(total) - Number(answered)
    if (rest > 0) {
      await expect(page.getByText(
        new RegExp(`no benchmark data yet\\s*[—-]\\s*${rest} of ${total} games`, 'i'),
      )).toBeVisible()
    }
  })

  test('carries the engine caveat, not the legacy one', async ({ page }) => {
    // FPS_CAVEAT says "not measured benchmarks", which flatly contradicts a
    // report that has just counted how many WERE measured. PERF_CAVEAT is the
    // engine's. They were reunified once by accident; this stops it recurring.
    await expect(page.getByText(/published benchmark measurements/i)).toBeVisible()
    await expect(page.getByText(/not measured benchmarks/i)).toHaveCount(0)
  })

  test('states what is uncalibrated instead of implying a ranking', async ({ page }) => {
    // Cross-architecture comparison is uncalibrated while ARCH_EFFICIENCY is
    // 1.0, and the capability panel is required to say so rather than let a
    // reader rank a GeForce against a Radeon on the index.
    await expect(page.getByText(/not yet calibrated across architectures/i)).toBeVisible()
  })
})
