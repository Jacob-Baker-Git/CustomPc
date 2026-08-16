import { test, expect } from '@playwright/test'
import { generateBuild } from './helpers.js'

// The footer is the site's whole internal link graph — every policy page and
// every content page is reachable only through it. A screen without one is a
// dead end for a reader and a dead end for a crawler, and it used to be missing
// from the two screens people spend the most time on.
//
// Routes are checked by URL; the wizard and the builder are flow states rather
// than URLs, so they are reached the way a person reaches them.

const LINKS = ['/help', '/parts', '/glossary', '/feedback', '/privacy', '/terms']

async function expectFooter(page, where) {
  const footer = page.locator('footer')
  await expect(footer, `no footer on ${where}`).toHaveCount(1)
  for (const href of LINKS) {
    await expect(footer.locator(`a[href="${href}"]`), `${href} missing on ${where}`).toHaveCount(1)
  }
  await expect(footer).toContainText(/curated estimates/i)
}

test.describe('every screen carries the footer', () => {
  for (const path of ['/', ...LINKS]) {
    test(`route ${path}`, async ({ page }) => {
      await page.goto(path)
      await expectFooter(page, path)
    })
  }

  test('the setup wizard', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /start a build/i }).click()
    await expect(page.getByRole('heading', { name: /build your pc/i })).toBeVisible()
    await expectFooter(page, 'setup wizard')
  })

  test('the builder', async ({ page }) => {
    await generateBuild(page)
    await expectFooter(page, 'builder')
  })

  test('the builder footer covers the board rather than sitting on it', async ({ page }) => {
    // ⚠️ The builder is the ONLY screen with no scrim — deliberately, because
    // it is covered in opaque panels and had no prose to protect. It has prose
    // now. Measured against the artwork:
    //
    //   --muted (#99A0AB) on a full-strength trace ....... 1.63:1
    //
    // and below lg the edge-pinned hardware layers reach inward far enough to
    // sit behind a centred column, putting solid gold pads behind the links.
    // So the footer carries its own ground band, and the band has to reach both
    // edges — cropped to a text column it leaves the hardware showing beside it.
    await generateBuild(page)

    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const band = await page.locator('footer').evaluate((el) => {
        const r = el.getBoundingClientRect()
        const bg = getComputedStyle(el).backgroundColor
        const m = bg.match(/rgba?\(([^)]+)\)/)
        const parts = m ? m[1].split(',').map(Number) : []
        return { left: Math.round(r.left), right: Math.round(r.right), alpha: parts[3] ?? 1 }
      })
      expect(band.left, `footer band starts short of the left edge at ${width}`).toBe(0)
      expect(band.right, `footer band stops short of the right edge at ${width}`).toBe(width)
      // 0.68 (the heaviest trace) * (1 - 0.8) = 0.136, inside the ~0.15 ceiling.
      expect(band.alpha, `footer band too transparent at ${width}`).toBeGreaterThanOrEqual(0.8)
    }
  })

  test('the builder footer is reachable by scrolling, not stranded below the viewport', async ({
    page,
  }) => {
    // ⚠️ The builder scrolls inside an h-screen container, not on the document.
    // A footer appended outside that container renders at a position no scroll
    // can ever reach, and every "is it in the DOM" assertion still passes. This
    // is the one that would catch it.
    await generateBuild(page)
    await page.locator('footer').scrollIntoViewIfNeeded()
    await expect(page.locator('footer')).toBeInViewport()
  })
})
