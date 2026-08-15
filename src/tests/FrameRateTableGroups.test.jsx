import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FrameRateTable from '../components/performance/FrameRateTable'

const cell = (avgFps) => ({
  avgFps, lowFps: avgFps - 20, frameTimeMs: 10, basis: 'ceiling', bound: 'upper',
  cpuShare: null, limitedBy: null, caveats: [], errorPct: null,
  presetId: 'ultra', upscaling: 'native',
})

const game = (id, name, genre, best, over = {}) => ({
  gameId: id, name, genre, preset: 'Ultra', presetId: 'ultra', upscaling: 'native',
  presetTier: 4,
  cells: { '1080p': cell(best + 100), '1440p': cell(best), '4k': cell(best - 50) },
  basis: 'ceiling', errorPct: null, caveats: [], otherPresets: [], bestFps: best + 100,
  ...over,
})

const rows = [
  game('a', 'Alpha', 'shooter', 300),
  game('b', 'Bravo', 'shooter', 200),
  game('c', 'Charlie', 'rpg', 250),
]

const setup = (props = {}) => {
  const utils = render(
    <FrameRateTable rows={rows} target="1440p" uncovered={[]} {...props} />)
  return { ...utils, user: userEvent.setup() }
}

const visibleGameIds = (container) =>
  [...container.querySelectorAll('tbody tr[data-game]')].map((tr) => tr.dataset.game)

const genreBar = (name) => screen.getByRole('button', { name: new RegExp(name, 'i') })

describe('FrameRateTable — genre groups', () => {
  it('opens with every genre shut, so the tab is bars not rows', () => {
    // The whole point of the grouping: 56 rows becomes six lines.
    const { container } = setup()
    expect(visibleGameIds(container)).toEqual([])
    expect(genreBar('Shooters')).toBeInTheDocument()
    expect(genreBar('RPGs')).toBeInTheDocument()
  })

  it('shows a genre’s games once its bar is opened', async () => {
    const { container, user } = setup()
    await user.click(genreBar('Shooters'))
    expect(visibleGameIds(container)).toEqual(['a', 'b'])
  })

  it('keeps other genres shut when one is opened', async () => {
    // Independent, not an accordion. Comparing a shooter against an RPG is a
    // normal thing to want, and closing one to open the other prevents it.
    const { container, user } = setup()
    await user.click(genreBar('Shooters'))
    await user.click(genreBar('RPGs'))
    expect(visibleGameIds(container)).toEqual(['a', 'b', 'c'])
  })

  it('closes a genre when its bar is clicked again', async () => {
    const { container, user } = setup()
    await user.click(genreBar('Shooters'))
    await user.click(genreBar('Shooters'))
    expect(visibleGameIds(container)).toEqual([])
  })

  it('says how many games are inside a shut bar, and how fast they are', async () => {
    // A shut bar is all a reader has to go on, so it has to carry enough to
    // decide whether opening it is worth it.
    setup()
    const bar = genreBar('Shooters')
    expect(bar.textContent).toMatch(/2 games/i)
    // 1440p is the target: Alpha 300, Bravo 200.
    expect(bar.textContent).toMatch(/200/)
    expect(bar.textContent).toMatch(/300/)
  })

  it('reports the range of the resolution being looked at, not a fixed one', async () => {
    setup({ target: '4k' })
    // 4K cells are best - 50: Alpha 250, Bravo 150.
    expect(genreBar('Shooters').textContent).toMatch(/150/)
    expect(genreBar('Shooters').textContent).toMatch(/250/)
  })
})

describe('FrameRateTable — sorting', () => {
  const openShooters = async (user) => user.click(genreBar('Shooters'))

  it('sorts by a resolution column, largest first, when its header is clicked', async () => {
    const { container, user } = setup()
    await openShooters(user)
    expect(visibleGameIds(container)).toEqual(['a', 'b'])
    await user.click(screen.getByRole('button', { name: /sort by 1440p/i }))
    expect(visibleGameIds(container)).toEqual(['a', 'b'])
    await user.click(screen.getByRole('button', { name: /sort by 1440p/i }))
    expect(visibleGameIds(container)).toEqual(['b', 'a'])
  })

  it('sorts the game column alphabetically', async () => {
    const { container, user } = setup()
    await openShooters(user)
    await user.click(screen.getByRole('button', { name: /sort by game/i }))
    expect(visibleGameIds(container)).toEqual(['a', 'b'])
    await user.click(screen.getByRole('button', { name: /sort by game/i }))
    expect(visibleGameIds(container)).toEqual(['b', 'a'])
  })

  it('tells assistive technology which column is sorted, and which way', async () => {
    const { user } = setup()
    const header = () => screen.getByRole('columnheader', { name: /1440p/i })
    expect(header()).toHaveAttribute('aria-sort', 'none')
    await user.click(screen.getByRole('button', { name: /sort by 1440p/i }))
    expect(header()).toHaveAttribute('aria-sort', 'descending')
    await user.click(screen.getByRole('button', { name: /sort by 1440p/i }))
    expect(header()).toHaveAttribute('aria-sort', 'ascending')
  })

  it('marks only the sorted column', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /sort by 1440p/i }))
    expect(screen.getByRole('columnheader', { name: /1080p/i })).toHaveAttribute('aria-sort', 'none')
    expect(screen.getByRole('columnheader', { name: /4K/i })).toHaveAttribute('aria-sort', 'none')
  })

  it('sorts WITHIN each genre rather than flattening the groups', async () => {
    // ⚠️ Charlie (250 at 1440p) sits between Alpha (300) and Bravo (200). A
    // sort that flattened the table would interleave it; grouped, it stays
    // under RPGs. Without this fixture the two behaviours look identical.
    const { container, user } = setup()
    await user.click(genreBar('Shooters'))
    await user.click(genreBar('RPGs'))
    await user.click(screen.getByRole('button', { name: /sort by 1440p/i }))
    expect(visibleGameIds(container)).toEqual(['a', 'b', 'c'])
  })

  it('does NOT retarget the build when a header is clicked', async () => {
    // Headers used to write setResolution. They sort now; the target moves
    // from the picker beside the heading.
    const onTargetChange = vi.fn()
    const { user } = setup({ onTargetChange })
    await user.click(screen.getByRole('button', { name: /sort by 4K/i }))
    expect(onTargetChange).not.toHaveBeenCalled()
  })

  it('still marks the build’s target column', async () => {
    setup()
    expect(screen.getByRole('columnheader', { name: /1440p/i })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('columnheader', { name: /4K/i })).not.toHaveAttribute('aria-current', 'true')
  })
})

describe('FrameRateTable — opening a game', () => {
  it('opens a game when any part of its row is clicked, not just the arrow', async () => {
    const { container, user } = setup()
    await user.click(genreBar('Shooters'))
    const row = container.querySelector('tr[data-game="a"]')
    // The Basis cell — as far from the expander as the row gets.
    await user.click(row.querySelector('td:last-child'))
    expect(within(row).getByRole('button')).toHaveAttribute('aria-expanded', 'true')
  })

  it('reports the game to the caller however the row was clicked', async () => {
    const onSelect = vi.fn()
    const { container, user } = setup({ onSelect })
    await user.click(genreBar('Shooters'))
    await user.click(container.querySelector('tr[data-game="a"] td:last-child'))
    expect(onSelect).toHaveBeenCalledWith('a')
  })

  it('handles a click on the expander exactly once, not once per handler', async () => {
    // ⚠️ The row handles the click and the button sits inside it, so a handler
    // on the button as well would run the toggle TWICE per click.
    //
    // Asserted on the call count, not on aria-expanded. The toggle sets a
    // value rather than flipping one, so firing it twice lands on the same
    // state and the row still looks right — an aria-expanded assertion passes
    // against both implementations and proves nothing. onSelect is the only
    // place the second fire is observable.
    const onSelect = vi.fn()
    const { container, user } = setup({ onSelect })
    await user.click(genreBar('Shooters'))
    const row = container.querySelector('tr[data-game="a"]')
    await user.click(within(row).getByRole('button'))
    expect(within(row).getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})

describe('FrameRateTable — column highlight', () => {
  it('highlights the target column when nothing is hovered', () => {
    const { container } = setup()
    const th = screen.getByRole('columnheader', { name: /1440p/i })
    expect(th.className).toMatch(/bg-surface-2/)
    expect(container.querySelector('thead th:nth-child(3)').className).not.toMatch(/bg-surface-2/)
  })

  it('moves the highlight to whichever column the mouse is over', async () => {
    const { container, user } = setup()
    await user.click(genreBar('Shooters'))
    await user.hover(container.querySelector('tr[data-game="a"] td:nth-child(3)'))
    // 1080p is column 3, and now lit instead of the target.
    expect(container.querySelector('thead th:nth-child(3)').className).toMatch(/bg-surface-2/)
    expect(screen.getByRole('columnheader', { name: /1440p/i }).className).not.toMatch(/bg-surface-2/)
  })

  it('returns the highlight to the target when the mouse leaves', async () => {
    const { container, user } = setup()
    await user.hover(container.querySelector('thead th:nth-child(3)'))
    await user.unhover(container.querySelector('table') ?? container.firstChild)
    expect(screen.getByRole('columnheader', { name: /1440p/i }).className).toMatch(/bg-surface-2/)
  })
})
