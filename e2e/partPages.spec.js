import { test, expect } from '@playwright/test'

// A part page is the one feature here whose entire value is being served at a
// real URL to a visitor — or a crawler — that arrives cold, with no app state and
// no in-app navigation to set it up. Unit tests render the component; only this
// proves the URL resolves, the server hands back the app rather than a 404, and
// the page's own title, canonical and content are in place on first paint.
const PART = {
  id: 'gpu-rtx-4090',
  name: 'NVIDIA GeForce RTX 4090',
}

test.describe('a part page served cold', () => {
  test('resolves its own URL with its own title, canonical and content', async ({ page }) => {
    const response = await page.goto(`/parts/${PART.id}`)
    expect(response?.status(), 'the deeper path is served, not 404ed').toBe(200)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(PART.name)

    // Per-page metadata is the whole reason paths beat hashes. All 540 of these
    // sharing the parts browser's title and canonical would be the same defect
    // hash routing had, ninety times over.
    await expect(page).toHaveTitle(new RegExp(PART.name.replace(/\s+/g, '\\s+')))
    const canonical = page.locator('link[rel="canonical"]')
    await expect(canonical).toHaveAttribute('href', new RegExp(`/parts/${PART.id}$`))

    // Substance, not a spec table. A generated page carrying only a name and a
    // price is doorway content; the derived sections are what earn the URL.
    for (const heading of ['What it works with', 'Specifications', 'Good alongside it']) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    }

    // The root ships about sixty words. A part page has to clear that by enough
    // that it is worth indexing on its own.
    const words = await page.evaluate(() => document.body.innerText.trim().split(/\s+/).length)
    expect(words, 'enough content to index').toBeGreaterThan(120)
  })

  test('never presents a curated estimate as a price', async ({ page }) => {
    await page.goto(`/parts/${PART.id}`)
    // Anchored on the comma: the footer carries "curated estimates (July 2026)"
    // sitewide, and matching that would pass whatever the part header said.
    await expect(page.getByText(/curated estimate,/i)).toBeVisible()
  })

  test('is reachable from the parts browser by a real link', async ({ page }) => {
    await page.goto('/parts')
    const link = page.locator(`a[href="/parts/${PART.id}"]`).first()
    // A plain anchor, so the browser list is a crawl path into every part page
    // and not just a click handler.
    await expect(link).toHaveCount(1)
    await link.click()
    await expect(page).toHaveURL(new RegExp(`/parts/${PART.id}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(PART.name)
  })

  test('leads back up to the browser it sits under', async ({ page }) => {
    await page.goto(`/parts/${PART.id}`)

    // Scoped to the breadcrumb: the footer links to /parts on every page, so an
    // unscoped match would be testing the footer instead of the breadcrumb.
    await page.getByLabel('Breadcrumb').getByRole('link', { name: /parts browser/i }).click()
    await expect(page).toHaveURL(/\/parts$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/parts browser/i)
  })

  test('links on to a related part page', async ({ page }) => {
    await page.goto(`/parts/${PART.id}`)
    const related = page.locator('a[href^="/parts/"]').filter({ hasNotText: 'Parts browser' }).first()
    const href = await related.getAttribute('href')
    expect(href).not.toBe(`/parts/${PART.id}`)
    await related.click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    // A different part, reached without a reload — the internal linking that
    // makes 540 pages a web rather than 540 orphans.
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(PART.name)
  })

  test('says so plainly when an id resolves to nothing', async ({ page }) => {
    const response = await page.goto('/parts/gpu-not-a-real-part')
    // Netlify and vite both serve the SPA for unknown paths, so the status is
    // 200 and the PAGE has to be the one that says it found nothing.
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/not found/i)
    await expect(page.getByRole('link', { name: /browse every part/i })).toBeVisible()
  })
})
