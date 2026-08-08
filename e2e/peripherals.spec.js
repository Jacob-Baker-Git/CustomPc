import { test, expect } from '@playwright/test'
import { generateBuild, openTab } from './helpers.js'

// The filter panel stages its choices and only commits on Apply, across four
// categories at once. The failure mode that matters is subtle: an empty
// selection has to mean "no constraint", not "match nothing", or opening the
// panel and applying it untouched empties the whole tab. A unit test pins the
// predicate; this pins the dialog wired to it.
test.describe('the peripherals filter panel', () => {
  test('applying it untouched leaves every option in place', async ({ page }) => {
    await generateBuild(page)
    await openTab(page, 'peripherals')

    // "36 options" under each category heading.
    const counts = page.getByText(/^\d+ options$/)
    await expect(counts.first()).toBeVisible()
    const before = await counts.allInnerTexts()
    expect(before.length).toBeGreaterThan(0)

    await page.getByRole('button', { name: /^filters/i }).click()
    const dialog = page.getByRole('dialog', { name: /filter peripherals/i })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: /^apply$/i }).click()
    await expect(dialog).toBeHidden()

    // Not one fewer. An empty brand list is not a brand nobody makes.
    expect(await counts.allInnerTexts()).toEqual(before)
  })

  test('cancel does not commit a staged choice', async ({ page }) => {
    await generateBuild(page)
    await openTab(page, 'peripherals')

    const counts = page.getByText(/^\d+ options$/)
    await expect(counts.first()).toBeVisible()
    const before = await counts.allInnerTexts()

    await page.getByRole('button', { name: /^filters/i }).click()
    const dialog = page.getByRole('dialog', { name: /filter peripherals/i })
    // Any one brand is enough to prove staging: picking it must change nothing
    // until Apply, and Cancel must discard it.
    await dialog.getByRole('button', { name: /^logitech$/i }).click()
    await dialog.getByRole('button', { name: /^cancel$/i }).click()
    await expect(dialog).toBeHidden()

    expect(await counts.allInnerTexts()).toEqual(before)
  })
})
