import { test, expect } from '@playwright/test'

// Walks the real wizard in a real browser and asserts the parts UI is
// actually VISIBLE — guards paint/compositing regressions that unit tests
// (jsdom) can never catch.
test('wizard generates a build and the selected parts are visible', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /build a new pc/i }).click()

  await page.getByPlaceholder('Enter budget').fill('1600')
  await page.getByRole('button', { name: /next: use case/i }).click()
  await page.getByRole('button', { name: /gaming/i }).click()
  await page.getByRole('button', { name: /generate build/i }).click()

  // The generated-build banner summarises the use-case build.
  await expect(page.getByText(/gaming build/i)).toBeVisible()

  // Selected parts are visible on screen (part list rows).
  await expect(page.getByRole('button', { name: /remove cpu$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /remove gpu/i })).toBeVisible()

  // Deep-linkable tabs: summary shows the same build.
  await page.getByRole('button', { name: /^summary$/i }).click()
  await expect(page).toHaveURL(/#summary/)
  await expect(page.getByText(/your build/i)).toBeVisible()
})
