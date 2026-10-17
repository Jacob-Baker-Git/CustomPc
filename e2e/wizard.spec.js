import { test, expect } from '@playwright/test'
import { generateBuild, openTab } from './helpers.js'

// The new flow (spec 2026-10-13) in a real browser: the Welcome's three paths,
// both journeys end to end, and the 3D view mounting on Summary alone. Also the
// only place the CSS actually applies, so it proves exactly one set of view
// tabs is on screen.
test('Welcome shows exactly three buttons', async ({ page }) => {
  await page.goto('/')
  const names = await page.getByRole('main').getByRole('button').allTextContents()
  expect(names).toHaveLength(3)
  expect(names[0]).toMatch(/what will my build get\?/i)
  expect(names[1]).toMatch(/build for a game/i)
  expect(names[2]).toMatch(/saved builds/i)
})

test('path 1: enter parts, then estimate a game on Performance', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /what will my build get/i }).click()
  await expect(page).toHaveURL(/#build/)
  for (const cat of ['CPU', 'GPU']) {
    await page.getByRole('button', { name: new RegExp(`\\b${cat}\\b`) }).first().click()
    // Desktop shows the picker as a table: the first part that fits is the
    // first enabled name button in its body.
    await page.getByRole('dialog', { name: new RegExp(`select ${cat}`, 'i') })
      .locator('tbody button:not([aria-disabled])').first().click()
  }
  await page.getByRole('button', { name: /next: performance/i }).click()
  await page.getByRole('combobox', { name: 'Game' }).fill('Fortnite')
  await expect(page.getByTestId('estimate-fps')).toHaveText(/\d+ fps/)
})

test('path 2: build for a game, then Peripherals, then Summary', async ({ page }) => {
  await generateBuild(page)
  await expect(page).toHaveURL(/#summary/)
  await expect(page.getByText(/your build/i)).toBeVisible()
})

test('the 3D canvas mounts only on Summary', async ({ page }) => {
  await generateBuild(page)
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 })
  for (const tab of ['build', 'performance', 'peripherals']) {
    await openTab(page, tab)
    await expect(page.locator('canvas')).toHaveCount(0)
  }
})

test('exactly one tab set is reachable at any width', async ({ page }) => {
  await generateBuild(page)
  await expect(page.getByRole('button', { name: /^summary$/i })).toHaveCount(1)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: /^summary$/i })).toHaveCount(1)
})

// The 3D column's min-height used to leak into the row above it: .area-viz
// spanned two grid rows, and CSS Grid splits a spanning item's excess height
// equally across the rows it spans, so half of it became dead space between the
// use-case chips and the rating panel — 47px at 1900px tall, 213px at 2400px,
// growing without limit as the user zoomed out (browser zoom divides the
// viewport's CSS pixel height by the zoom factor).
//
// jsdom computes no grid layout, so this can only be caught here.
test('the left column stays tight to the 3D preview at any viewport height', async ({ page }) => {
  await generateBuild(page)

  for (const height of [900, 1900, 2400]) {
    await page.setViewportSize({ width: 1440, height })

    // BOTH seams, because fixing only the first one just moved the slack down a
    // level: collapsing the two rows into .area-left cured the chips/score gap
    // and left 512px between the score and the parts panel at 2400px instead.
    //
    // The chips/score reader understands the OLD two-row layout too, so reverting
    // that fix fails here on a real measured gap rather than a missing selector.
    const gaps = await page.evaluate(() => {
      const grid = document.querySelector('.build-grid')
      const left = grid.querySelector('.area-left')
      const chips = grid.querySelector('.area-usecase')
      const score = grid.querySelector('.area-rating')
      const column = left ?? grid.querySelector('.area-rating')
      const viz = grid.querySelector('.area-viz')
      return {
        chipsToScore: score.getBoundingClientRect().top - chips.getBoundingClientRect().bottom,
        // The two cells share a row. If the 3D's minimum forces the row taller
        // than the text column needs, the 3D outruns it and the difference IS
        // the dead space. Measuring this rather than the distance to the next
        // panel keeps the generated-build banner out of the number.
        vizOverrunsColumn:
          viz.getBoundingClientRect().bottom - column.getBoundingClientRect().bottom,
      }
    })

    // Only the flex gap (0.75rem = 12px) may separate the chips and the score.
    expect(gaps.chipsToScore, `chips->score @ ${height}`).toBeLessThanOrEqual(13)
    expect(gaps.chipsToScore, `chips->score @ ${height}`).toBeGreaterThanOrEqual(0)

    // With a full build the text column is always the taller of the two, so the
    // 3D should stretch to exactly meet it. (An empty build legitimately hits
    // the pixel floor instead — this test always generates a full rig.)
    expect(gaps.vizOverrunsColumn, `viz overrun @ ${height}`).toBeLessThanOrEqual(2)
  }
})
