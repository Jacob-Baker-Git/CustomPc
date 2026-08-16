import { expect } from '@playwright/test'

// Every spec needs a real build on screen before it can assert anything, and
// the auto-build path is the shortest route to one. Kept here rather than
// copy-pasted so a change to the entry flow breaks one place, not five.
export async function generateBuild(page, { budget = '1600', useCase = /gaming/i } = {}) {
  await page.goto('/')

  await page.getByRole('button', { name: /start a build/i }).click()
  await page.getByRole('button', { name: /pick parts for me/i }).click()

  await page.getByPlaceholder('Enter budget').fill(budget)
  await page.getByRole('button', { name: /next: use case/i }).click()
  await page.getByRole('button', { name: useCase }).click()
  await page.getByRole('button', { name: /generate build/i }).click()

  // The inline rating only renders once a build exists, so it doubles as the
  // signal that generation finished.
  await expect(page.getByText('/100')).toBeVisible()
}

// ⚠️ The tail is not optional decoration. A beta tab's accessible name is the
// visible badge AND an sr-only span run together — "performancebeta (beta)" —
// so the original `^${name}$` stopped matching the Performance tab the moment
// BetaDot landed in ViewTabs, and four performance specs had been timing out
// ever since. Nothing failed loudly because the e2e suite is not part of the
// unit run. Keep the anchors: unanchored, `^build` would also catch "Build
// checks" and the tests would pass against the wrong control.
export const openTab = (page, name) =>
  page
    .getByRole('button', { name: new RegExp(`^${name}(beta)?(\\s*\\(beta\\))?$`, 'i') })
    .first()
    .click()
