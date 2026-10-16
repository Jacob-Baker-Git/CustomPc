import { expect } from '@playwright/test'

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

// The all-games frame-rate table sits in a Fold under the game estimator. Folds
// start open on desktop and shut on a phone (spec 2026-10-16), so open it only
// if it is shut: a blind click would close it on desktop.
export async function openAllGames(page) {
  await openTab(page, 'performance')
  const fold = page.locator('details', { hasText: 'Every game at once' })
  if (!(await fold.evaluate((d) => d.open))) await fold.locator('summary').click()
}

// Every spec needs a real build on screen before it can assert anything, and
// the Build-for-a-game path is the shortest route to one. It ends on the
// Summary tab, where the 3D view, the score and the parts list live. Kept here
// rather than copy-pasted so a change to the entry flow breaks one place.
export async function generateBuild(page, { budget = '1600' } = {}) {
  await page.goto('/')
  await page.getByRole('button', { name: /build for a game/i }).click()
  await page.getByRole('combobox', { name: 'Game' }).fill('Fortnite')
  await page.getByRole('spinbutton', { name: /target fps/i }).fill('60')
  await page.getByRole('spinbutton', { name: /budget/i }).fill(budget)
  await page.getByRole('button', { name: /find builds/i }).click()
  await page.getByRole('button', { name: /use this build/i }).first().click()
  await expect(page).toHaveURL(/#peripherals/)
  await openTab(page, 'summary')
  // The rating only renders once a build exists, so it doubles as the signal
  // that the Summary is ready. Summary shows the score twice for now (the
  // rating panel and the parts summary) until the user arranges the page.
  await expect(page.getByText('/100').first()).toBeVisible()
}
