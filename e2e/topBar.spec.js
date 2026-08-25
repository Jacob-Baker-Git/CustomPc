import { test, expect } from '@playwright/test'
import { generateBuild } from './helpers.js'

// The top bar is the most fragile layout in this repo and it has broken at
// three different widths for three different reasons — the wordmark wrapping
// it at 320px, the wordmark wrapping it again at xl, and the budget/power
// readout running off the right edge at exactly 1280px.
//
// ⚠️ The 1280px failure is SILENT. `document.documentElement.scrollWidth ===
// clientWidth` there, so no horizontal scrollbar appears and a page-level
// overflow check reports the page clean while the POWER figure is being cut
// off. The probe therefore has to be PER ELEMENT: ask every box in the header
// whether its own right edge has left the viewport.
//
// Deliberately measured rather than asserted against class names. A guard
// written against `hidden xl:flex` would go green the moment someone renamed
// the breakpoint, and it would fail on a missing selector rather than on a
// real measured overflow if the fix were ever reverted.
const WIDTHS = [360, 375, 768, 1024, 1280, 1366, 1440, 1920]

async function overflowingHeaderBoxes(page) {
  return page.evaluate(() => {
    const header = document.querySelector('header')
    if (!header) return ['no header on the page at all']
    const limit = document.documentElement.clientWidth
    return [...header.querySelectorAll('*')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        // Zero-size boxes are the `hidden` spans of the other breakpoint and
        // cannot be clipping anything. The 1px tolerance absorbs subpixel
        // rounding on fractional layouts.
        return r.width > 0 && r.height > 0 && r.right > limit + 1
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className.toString().split(/\s+/).slice(0, 3).join('.')} right=${Math.round(el.getBoundingClientRect().right)} limit=${limit}`)
  })
}

test.describe('the top bar', () => {
  test.beforeEach(async ({ page }) => {
    await generateBuild(page)
  })

  // The overflow guard below is satisfied by a header that shows nothing at
  // all, so it cannot on its own tell "it fits" from "it was hidden". This is
  // the other half: above the `wide` threshold the full single-row readout has
  // to actually be there. 1366 is the width this is really for — before the
  // duplicated budget and wattage came out, the threshold was 1420 and a 1366
  // laptop got none of it.
  for (const width of [1366, 1440]) {
    test(`shows the full readout on one row at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForTimeout(700)

      const { rows, meters } = await page.evaluate(() => {
        const header = document.querySelector('header')
        // Cluster the header's direct children by vertical CENTRE, not by top:
        // under `align-items: center` children legitimately differ in top.
        const centres = [...header.children]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0)
          .map((r) => Math.round((r.top + r.bottom) / 2))
        // The full-size meter chip is the bordered one; the phone row's is not.
        const meters = [...header.querySelectorAll('div')]
          .filter((d) => getComputedStyle(d).minWidth === '136px' && d.getBoundingClientRect().width > 0)
          .map((d) => d.textContent.trim())
        return { rows: new Set(centres).size, meters }
      })

      expect(rows, `the header should be one row at ${width}px`).toBe(1)
      expect(meters, `both meter chips should be on screen at ${width}px`).toHaveLength(2)
      expect(meters.join(' ')).toMatch(/Budget/i)
      expect(meters.join(' ')).toMatch(/Power/i)
    })
  }

  for (const width of WIDTHS) {
    test(`clears the content it is fixed on top of at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForTimeout(700)

      // The header is `fixed` and opaque, so the scroll container's top padding
      // is the only thing keeping it off the page. That padding is a constant
      // per breakpoint while the header's height depends on whether its meter
      // row wrapped — so the two drift apart silently, and the failure looks
      // like a heading with its top sliced off rather than like a layout bug.
      const { headerBottom, contentTop } = await page.evaluate(() => {
        const header = document.querySelector('header')
        const scroller = document.querySelector('.h-screen.overflow-y-auto')
        return {
          headerBottom: header.getBoundingClientRect().bottom,
          contentTop: scroller.firstElementChild.getBoundingClientRect().top,
        }
      })

      expect(Math.round(headerBottom), `the header paints over the page at ${width}px`)
        .toBeLessThanOrEqual(Math.round(contentTop))
    })

    test(`keeps every readout inside the viewport at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      // The budget/power group only mounts at `wide`, and the meters animate
      // their width over 500ms — measure after both have settled.
      await page.waitForTimeout(700)

      expect(await overflowingHeaderBoxes(page), `header content is clipped at ${width}px`).toEqual([])
    })
  }

  // ⚠️ Every width above is measured against the default £1600 build, and the
  // header's readouts are LIVE NUMBERS — its width is a function of what the
  // user typed. A five-digit budget adds 32px to the row, which is the
  // difference between fitting a 1280px laptop and clipping it. Sizing the
  // breakpoint to a typical budget would have rebuilt the original bug for the
  // one user with an unusual one.
  test('still fits with a five-digit budget', async ({ page }) => {
    // ⚠️ This one test does what eight of the tests above do, in one body:
    // generateBuild, then eight viewport changes each with a settle wait. That
    // is comfortably past the config's 30s default, and it fails as
    // "page.setViewportSize: Test timeout" — a stack trace pointing at the
    // measurement rather than at the budget, which reads like a layout failure
    // and is not one. The page snapshot on the failing run showed the header
    // rendering £10000 / £8452 left with nothing clipped at all.
    test.setTimeout(120000)

    await page.getByTitle('Click to edit your budget').click()
    const input = page.locator('header input[type="number"]')
    await input.fill('10000')
    await input.press('Enter')

    // Wait for the new figure to be ON SCREEN rather than for a duration.
    // Pressing Enter commits to the store; the header re-renders from it a tick
    // later, and the meter chips resize from that. Not the cause of the
    // timeout above, but the right way to wait for a number regardless.
    await expect(page.getByTitle('Click to edit your budget')).toHaveText('£10000')

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      // The meters animate width over 500ms; this clears that with margin, and
      // by here the numbers themselves are already settled.
      await page.waitForTimeout(700)
      expect(await overflowingHeaderBoxes(page), `header is clipped at ${width}px on a £10000 budget`).toEqual([])
    }
  })
})
