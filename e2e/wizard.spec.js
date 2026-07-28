import { test, expect } from '@playwright/test'

// Walks the real setup flow in a real browser and asserts the parts UI is
// actually VISIBLE — guards paint/compositing regressions that unit tests
// (jsdom) can never catch. Also the only test where the CSS actually applies,
// so it proves exactly one set of view tabs is on screen.
test('setup generates a build and the selected parts are visible', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /start a build/i }).click()
  await page.getByRole('button', { name: /pick parts for me/i }).click()

  await page.getByPlaceholder('Enter budget').fill('1600')
  await page.getByRole('button', { name: /next: use case/i }).click()
  await page.getByRole('button', { name: /gaming/i }).click()
  await page.getByRole('button', { name: /generate build/i }).click()

  // The generated-build banner summarises the use-case build.
  await expect(page.getByText(/gaming build/i)).toBeVisible()

  // Selected parts are visible on screen (part list rows).
  await expect(page.getByRole('button', { name: /remove cpu$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /remove gpu/i })).toBeVisible()

  // The Build tab now rates the generated build inline.
  await expect(page.getByText('/100')).toBeVisible()

  // Both tab sets are in the DOM — the header row and the bottom bar — but CSS
  // shows one at a time, and the hidden one drops out of the accessibility
  // tree. So exactly one is reachable by role, at any width.
  const summaryTab = page.getByRole('button', { name: /^summary$/i })
  await expect(summaryTab).toHaveCount(1)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: /^summary$/i })).toHaveCount(1)
  await page.setViewportSize({ width: 1440, height: 900 })

  // Deep-linkable tabs: summary shows the same build.
  await summaryTab.click()
  await expect(page).toHaveURL(/#summary/)
  await expect(page.getByText(/your build/i)).toBeVisible()
})
