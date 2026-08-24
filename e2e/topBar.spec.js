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
      // The budget/power group only mounts at xl, and the meters animate their
      // width over 500ms — measure after both have settled.
      await page.waitForTimeout(700)

      expect(await overflowingHeaderBoxes(page), `header content is clipped at ${width}px`).toEqual([])
    })
  }
})
