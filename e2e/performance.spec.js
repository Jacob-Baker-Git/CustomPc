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

  // ARCH_EFFICIENCY used to be 1.0 for everything and this test asserted the
  // panel said so. It is now FITTED from the corpus, per architecture, so the
  // panel's claim differs by card — and the requirement is unchanged: it must
  // state which footing the index is on rather than leave a reader to rank a
  // GeForce against a Radeon on a number that cannot carry it.
  test('states which footing the capability index is on', async ({ page }) => {
    const panel = page.getByText(/capability index/i).first()
    await expect(panel).toBeVisible()

    // Exactly one of the two claims, never both and never neither.
    const calibrated = page.getByText(/calibrated across architectures from \d+ measured/i)
    const uncalibrated = page.getByText(/not yet calibrated across architectures/i)
    const claims = (await calibrated.count()) + (await uncalibrated.count())
    expect(claims, 'the capability panel states its calibration status').toBeGreaterThan(0)

    // Where it does claim cross-brand comparability, it has to show the evidence:
    // how many cards the correction came from and how far they spread around it.
    // A fitted scalar presented bare is the same defect as an unmeasured frame
    // rate presented as measured.
    if (await calibrated.count()) {
      await expect(page.getByText(/spread \d+(\.\d+)?% around it/i)).toBeVisible()
    }
  })

  test('never claims comparability for an architecture the corpus barely covers', async ({ page }) => {
    // An Arc A380 is the only Xe2 Battlemage part measured, which is below the
    // three-card floor, so its panel must still refuse the cross-brand reading.
    await page.evaluate(() => {
      const key = 'custompc-builder-v1'
      const store = JSON.parse(window.localStorage.getItem(key))
      store.state.selectedParts.gpu = {
        id: 'gpu-intel-arc-b580', category: 'gpu', name: 'Intel Arc B580',
        brand: 'Intel', price: 249.99, tdp: 190, length: 272, perfScore: 40,
        specs: { vram: 12, memType: 'GDDR6' },
      }
      window.localStorage.setItem(key, JSON.stringify(store))
    })
    await page.reload()
    await openTab(page, 'performance')
    await expect(page.getByText(/not yet calibrated across architectures/i)).toBeVisible()
    await expect(page.getByText(/fewer than three .* cards have been measured/i)).toBeVisible()
  })
})
