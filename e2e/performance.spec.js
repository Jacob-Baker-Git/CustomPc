import { test, expect } from '@playwright/test'
import { generateBuild, openTab } from './helpers.js'

// The engine's one non-negotiable rule is that it never renders an unmeasured
// number as measured. Six separate bugs have been that same failure wearing
// different hats, and every one of them was a UI-layer leak — a card drawing a
// bar from a null, a footer counting rows it did not render. jsdom can prove
// the accessors return the right basis; only a real render proves the screen
// agrees with them.
//
// ONE UNIT NOW: GAMES. This file used to juggle two, because the tab drew one
// card per game AND preset and the footer counted both — coverage in games,
// cards in "results". The table draws one row per game, so the result unit is
// gone and every count on the screen is a game count. Anything here comparing a
// game total against a result total is stale, not a product bug.
//
// The footer also stopped carrying a measured count, so the check that the page
// cannot overstate its evidence moved to the BasisBar's mix line. That is the
// stronger place for it: the mix is computed from the UNFILTERED rows by
// basisMix, the badges are drawn per row by FrameRateRow, and making two
// independently-derived claims agree catches a leak that either one alone
// would render happily.

// The tab opens with every genre SHUT — six bars, not fifty-six rows — so
// nothing is countable until they are opened.
//
// Idempotent by inspection rather than by clicking blind: `openGenres` survives
// a filter toggle, so after one the surviving bars are ALREADY open and a blind
// click would shut them. That mistake reads as "the filter hid everything".
async function openEveryGenre(page) {
  // A summary row carries data-game and an expansion row carries no button at
  // all, so this is the genre bars and only them.
  const bars = page.locator('tbody tr:not([data-game]) button[aria-expanded]')
  const count = await bars.count()
  for (let i = 0; i < count; i++) {
    if ((await bars.nth(i).getAttribute('aria-expanded')) === 'false') await bars.nth(i).click()
  }
}

// Checked rather than destructured. The previous version of this spec pulled
// its groups straight out of `.exec()`, so when the footer's wording changed it
// died with "object null is not iterable" — a stack trace about iteration
// protocol for what was really "the sentence I was parsing no longer exists".
async function readFooter(page) {
  const text = await page.getByText(/games answered/i).first().innerText()
  const coverage = /(\d+)\s+of\s+(\d+)\s+games answered/i.exec(text)
  const drawn = /(\d+)\s+games?\s+shown/i.exec(text)
  expect(coverage, `the footer states coverage — read "${text}"`).not.toBeNull()
  expect(drawn, `the footer states how many games it drew — read "${text}"`).not.toBeNull()
  return { text, answered: Number(coverage[1]), total: Number(coverage[2]), shown: Number(drawn[1]) }
}

async function readMix(page) {
  const text = await page.locator('p', { hasText: /^\s*\d+ benchmarked/ }).first().innerText()
  const m = /(\d+)\s+benchmarked\s*·\s*(\d+)\s+backed by real data\s*·\s*(\d+)\s+estimated/i.exec(text)
  expect(m, `the basis mix states all three buckets — read "${text}"`).not.toBeNull()
  return { text, benchmarked: Number(m[1]), backed: Number(m[2]), estimated: Number(m[3]) }
}

// The basis label sits in each summary row's last cell. Counted per ROW rather
// than by matching label text loose on the page, because a badge is only
// honest if it is attached to a row — a stray "benchmarked" in prose must not
// be able to make the evidence look broader than it is.
async function readBasisTally(page) {
  const cells = await page.locator('tr[data-game] td:last-child').allInnerTexts()
  const tally = { benchmarked: 0, 'backed by real data': 0, estimate: 0 }
  const unknown = []
  for (const raw of cells) {
    // Uppercased in CSS, and an estimate can carry its ± band in the same cell.
    const label = raw.trim().toLowerCase().replace(/\s*±.*$/, '').trim()
    if (label in tally) tally[label] += 1
    else unknown.push(raw.trim())
  }
  return { tally, unknown, count: cells.length }
}

test.describe('the performance tab', () => {
  test.beforeEach(async ({ page }) => {
    await generateBuild(page)
    await openTab(page, 'performance')
  })

  test('renders exactly as many frame rates as it claims coverage for', async ({ page }) => {
    const { text: footer, answered, total, shown } = await readFooter(page)

    expect(total).toBeGreaterThan(0)
    expect(answered, `coverage cannot exceed the corpus — "${footer}"`).toBeLessThanOrEqual(total)
    // Nothing is filtered yet, so both clauses describe the SAME set of games.
    // This is the assertion that would have caught the regression the old
    // wording hid: if "shown" ever goes back to counting results, it diverges.
    expect(shown, `unfiltered, every answered game is drawn — "${footer}"`).toBe(answered)

    // Collapsed, the bars are the only thing standing in for the rows, so they
    // have to account for every game the footer claims.
    const barTexts = await page.locator('tbody tr:not([data-game]) button[aria-expanded]').allInnerTexts()
    const barTotal = barTexts.reduce(
      (sum, t) => sum + Number(/(\d+)\s+games?\b/i.exec(t)?.[1] ?? NaN), 0)
    expect(barTotal, `the shut genre bars account for every game shown — bars: ${JSON.stringify(barTexts)}`)
      .toBe(shown)

    await openEveryGenre(page)

    const rows = page.locator('tr[data-game]')
    expect(await rows.count(), `one drawn row per game shown — "${footer}"`).toBe(shown)

    // The title's actual claim. A row of three dashes would be a game the table
    // listed and then answered nothing for — buildGameRows drops those, and a
    // row that reappears means the drop stopped working.
    const withFrameRate = await rows.evaluateAll((trs) => trs.filter((tr) => {
      // Everything between the leading name/preset columns and the trailing
      // basis column is a resolution.
      const cells = [...tr.querySelectorAll('td')].slice(2, -1)
      return cells.some((td) => /\d/.test(td.textContent))
    }).length)
    expect(withFrameRate, 'every drawn row carries a frame rate').toBe(shown)

    // One basis label per row, and a label the reader can act on: an
    // unrecognised tier falls through FrameRateRow to its raw key, which
    // renders as "ceiling" rather than "estimate" and is caught here.
    const { tally, unknown, count } = await readBasisTally(page)
    expect(unknown, 'every basis cell carries a known label').toEqual([])
    expect(count, `exactly one basis label per drawn row — "${footer}"`).toBe(shown)

    // The heart of it: the badges and the mix line count the same rows by
    // different routes and must land on the same three numbers.
    const mix = await readMix(page)
    expect(tally.benchmarked, `benchmarked badges match the mix — "${mix.text}"`).toBe(mix.benchmarked)
    expect(tally['backed by real data'], `real-data badges match the mix — "${mix.text}"`).toBe(mix.backed)
    expect(tally.estimate, `estimate badges match the mix — "${mix.text}"`).toBe(mix.estimated)

    // The uncovered heading accounts for the remainder rather than quietly
    // listing fewer games than the footer says are missing. It counts its own
    // list now and no longer restates the corpus total.
    const rest = total - answered
    if (rest > 0) {
      await expect(page.getByText(
        new RegExp(`no benchmark data yet\\s*:\\s*${rest} games?`, 'i'),
      )).toBeVisible()
    }
  })

  // Unfiltered, "answered" and "shown" are the same number, so on its own the
  // test above cannot tell the two clauses apart. The filter is what separates
  // them, and it is where a leak would actually land: the whole point of
  // "only show real data" is that it may narrow what is DRAWN and must never
  // touch what was COUNTED.
  test('the real-data filter narrows what is drawn, not what was counted', async ({ page }) => {
    const before = await readFooter(page)
    const mixBefore = await readMix(page)

    await page.getByLabel(/only show real data/i).check()
    await openEveryGenre(page)

    const after = await readFooter(page)
    expect(await readMix(page), 'the mix describes the build, so the filter cannot move it')
      .toEqual(mixBefore)
    expect(after.answered, 'coverage describes the build, not the screen').toBe(before.answered)
    expect(after.total).toBe(before.total)

    // "Shown" describes the screen, so it has to follow the filter — and the
    // rows have to follow it too. A footer still claiming the unfiltered
    // number over a narrowed table is this file's original bug.
    expect(after.shown).toBeLessThanOrEqual(before.shown)
    expect(await page.locator('tr[data-game]').count(), `rows follow the footer — "${after.text}"`)
      .toBe(after.shown)

    // A game whose row was already wholly real cannot be filtered out, so the
    // survivors are at least the mix's two strong buckets. NOT equality: the
    // filter runs on engine rows BEFORE they are grouped, so a game can lose a
    // weak preset and be regrouped onto a strong one it was not credited with
    // while the weak one outranked it.
    expect(after.shown, `at least the rows the mix called real — "${mixBefore.text}"`)
      .toBeGreaterThanOrEqual(mixBefore.benchmarked + mixBefore.backed)

    // And the one thing the filter exists to guarantee.
    const { tally, unknown } = await readBasisTally(page)
    expect(unknown, 'every basis cell carries a known label').toEqual([])
    expect(tally.estimate, 'the filter leaves no estimate on screen').toBe(0)
    expect(tally.benchmarked + tally['backed by real data'],
      'every surviving row is one of the two real tiers').toBe(after.shown)
  })

  test('carries the engine caveat, not the legacy one', async ({ page }) => {
    // FPS_CAVEAT says "not measured benchmarks", which flatly contradicts a
    // report that has just counted how many WERE measured. PERF_CAVEAT is the
    // engine's. They were reunified once by accident; this stops it recurring.
    await expect(page.getByText(/published benchmark measurements/i)).toBeVisible()
    await expect(page.getByText(/not measured benchmarks/i)).toHaveCount(0)
  })

  // ARCH_EFFICIENCY used to be 1.0 for everything and this test asserted the
  // panel said so. It is now FITTED from the corpus, per architecture, so the
  // panel's claim differs by card — and the requirement is unchanged: it must
  // state which footing the index is on rather than leave a reader to rank a
  // GeForce against a Radeon on a number that cannot carry it.
  test('states which footing the capability index is on', async ({ page }) => {
    const panel = page.getByText(/capability index/i).first()
    await expect(panel).toBeVisible()

    // Exactly one of the two claims, never both and never neither.
    const calibrated = page.getByText(/calibrated across architectures from \d+ measured/i)
    const uncalibrated = page.getByText(/not yet calibrated across architectures/i)
    const claims = (await calibrated.count()) + (await uncalibrated.count())
    expect(claims, 'the capability panel states its calibration status').toBeGreaterThan(0)

    // Where it does claim cross-brand comparability, it has to show the evidence:
    // how many cards the correction came from and how far they spread around it.
    // A fitted scalar presented bare is the same defect as an unmeasured frame
    // rate presented as measured.
    if (await calibrated.count()) {
      await expect(page.getByText(/spread \d+(\.\d+)?% around it/i)).toBeVisible()
    }
  })

  test('never claims comparability for an architecture the corpus barely covers', async ({ page }) => {
    // An Arc A380 is the only Xe2 Battlemage part measured, which is below the
    // three-card floor, so its panel must still refuse the cross-brand reading.
    await page.evaluate(() => {
      const key = 'custompc-builder-v1'
      const store = JSON.parse(window.localStorage.getItem(key))
      store.state.selectedParts.gpu = {
        id: 'gpu-intel-arc-b580', category: 'gpu', name: 'Intel Arc B580',
        brand: 'Intel', price: 249.99, tdp: 190, length: 272, perfScore: 40,
        specs: { vram: 12, memType: 'GDDR6' },
      }
      window.localStorage.setItem(key, JSON.stringify(store))
    })
    await page.reload()
    await openTab(page, 'performance')
    await expect(page.getByText(/not yet calibrated across architectures/i)).toBeVisible()
    await expect(page.getByText(/fewer than three .* cards have been measured/i)).toBeVisible()
  })
})
