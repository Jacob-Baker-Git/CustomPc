import { test, expect } from '@playwright/test'

// The "Discontinued" badge is the only thing on the listing that tells a reader
// a part is no longer made, and the Help page promises it by name. It is also
// the kind of thing that disappears without anybody noticing: it lives on a row
// whose name truncates, so a long name simply pushes it out under
// `overflow: hidden` — no scrollbar, no error, and the row looks perfectly
// normal. jsdom cannot see it, because jsdom computes no layout.
const PHONE_WIDTHS = [320, 375, 414]

test.describe('the parts browser', () => {
  for (const width of PHONE_WIDTHS) {
    test(`shows the discontinued badge in full at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/parts')
      await expect(page.getByText('Discontinued').first()).toBeVisible()

      const clipped = await page.evaluate(() => {
        const badges = [...document.querySelectorAll('span')]
          .filter((s) => s.textContent.trim() === 'Discontinued')
        return badges
          .filter((b) => {
            // Measured against the box that clips it rather than against the
            // viewport: the row is inside the page's own width, so a viewport
            // check calls this clean while the badge is already gone.
            const own = b.getBoundingClientRect()
            for (let p = b.parentElement; p && p !== document.body; p = p.parentElement) {
              const cs = getComputedStyle(p)
              if (cs.overflow === 'hidden' || cs.overflowX === 'hidden') {
                if (own.right > p.getBoundingClientRect().right + 1) return true
              }
            }
            return false
          })
          .map((b) => b.parentElement.textContent.trim().slice(0, 40))
      })

      expect(clipped, `legacy parts whose badge is cut off at ${width}px`).toEqual([])
    })
  }
})
