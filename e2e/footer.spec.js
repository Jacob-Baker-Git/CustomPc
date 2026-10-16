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

  test('the Build-for-a-game screen', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /build for a game/i }).click()
    await expect(page.getByRole('heading', { name: /build for a game/i })).toBeVisible()
    await expectFooter(page, 'build for a game')
  })

  test('the builder', async ({ page }) => {
    await generateBuild(page)
    await expectFooter(page, 'builder')
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
