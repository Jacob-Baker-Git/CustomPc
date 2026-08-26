import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FrameRateTable from '../components/performance/FrameRateTable'

const cell = (avgFps) => ({
  avgFps, lowFps: avgFps - 20, frameTimeMs: 10, basis: 'ceiling', bound: 'upper',
  cpuShare: null, limitedBy: null, caveats: [], errorPct: null,
  presetId: 'ultra', upscaling: 'native',
})

const game = (id, name, best) => ({
  gameId: id, name, genre: 'shooter',
  preset: 'Ultra', presetId: 'ultra', upscaling: 'native', presetTier: 4,
  cells: { '1080p': cell(best), '1440p': cell(best - 100), '4k': cell(best - 200) },
  basis: 'ceiling', errorPct: null, caveats: [], otherPresets: [], bestFps: best,
})

const rows = [game('a', 'Alpha', 400), game('b', 'Bravo', 300)]

const gameIdsIn = (table) =>
  [...table.querySelectorAll('tbody tr[data-game]')].map((tr) => tr.dataset.game)

// Genre bars ship SHUT, so anything asserting on game rows has to open one
// first. See FrameRateTableGroups.test.jsx for the grouping itself.
const openGenre = (user) => user.click(screen.getByRole('button', { name: /shooters/i }))

describe('FrameRateTable', () => {
  it('is a real table with column headers', () => {
    // Three numeric columns per row is exactly the case a screen reader needs
    // headers for. A grid of divs gives it nothing to announce.
    render(<FrameRateTable rows={rows} target="1440p" uncovered={[]} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    for (const h of ['1080p', '1440p', '4K']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(h, 'i') })).toBeInTheDocument()
    }
  })

  it('marks the build’s target resolution column', () => {
    render(<FrameRateTable rows={rows} target="1440p" uncovered={[]} />)
    const th = screen.getByRole('columnheader', { name: /1440p/i })
    expect(th).toHaveAttribute('aria-current', 'true')
    // and the others are not
    expect(screen.getByRole('columnheader', { name: /1080p/i })).not.toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('columnheader', { name: /4K/i })).not.toHaveAttribute('aria-current', 'true')
  })

  it('does not expand a row when a column header is clicked', async () => {
    // The header sits above the rows and sorts them. A click that also opened
    // something would make the sort look like an accident.
    const user = userEvent.setup()
    const { container } = render(
      <FrameRateTable rows={rows} target="1440p" uncovered={[]} />)
    await openGenre(user)
    const before = container.querySelectorAll('tbody tr').length
    await user.click(screen.getByRole('button', { name: /sort by 4K/i }))
    expect(container.querySelectorAll('tbody tr')).toHaveLength(before)
  })

  it('opens one row at a time, closing the one before it', async () => {
    // Two expansions open at once pushes the row a reader was comparing
    // against off the screen. The table owns the open row for that reason.
    const user = userEvent.setup()
    const { container } = render(<FrameRateTable rows={rows} target="1440p" uncovered={[]} />)
    await openGenre(user)
    // The genre bar's own row, plus one per game.
    const base = rows.length + 1
    await user.click(screen.getByRole('button', { name: /Alpha/ }))
    expect(container.querySelectorAll('tbody tr')).toHaveLength(base + 1)
    await user.click(screen.getByRole('button', { name: /Bravo/ }))
    expect(container.querySelectorAll('tbody tr')).toHaveLength(base + 1)
    expect(screen.getByRole('button', { name: /Alpha/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Bravo/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('lists games with no data, densely, below the table', () => {
    // Not dropped. A game silently missing reads as a bug, and the honest
    // statement of coverage is the point.
    render(<FrameRateTable rows={rows} target="1440p"
                           uncovered={[{ gameId: 'z', name: 'Zulu', presets: ['Ultra', 'High'] }]} />)
    expect(screen.getByText('Zulu')).toBeInTheDocument()
    expect(screen.getByText(/no benchmark data yet/i)).toBeInTheDocument()
  })

  it('counts the uncovered games it names', () => {
    // The heading carries a number. A count taken from anything other than the
    // list it heads is the kind of figure that rots silently.
    //
    // THREE uncovered against TWO covered, deliberately. With both at two, a
    // heading counting `rows` instead of `uncovered` would read correctly and
    // this assertion would be true for the wrong reason.
    render(<FrameRateTable rows={rows} target="1440p" uncovered={[
      { gameId: 'x', name: 'X-Ray', presets: ['High'] },
      { gameId: 'y', name: 'Yankee', presets: ['Ultra'] },
      { gameId: 'z', name: 'Zulu', presets: ['Ultra', 'High'] },
    ]} />)
    expect(screen.getByText(/no benchmark data yet: 3 games/i)).toBeInTheDocument()
  })

  it('renders no uncovered section when everything is covered', () => {
    render(<FrameRateTable rows={rows} target="1440p" uncovered={[]} />)
    expect(screen.queryByText(/no benchmark data yet/i)).toBeNull()
  })

  it('hides the non-target resolution columns on narrow screens', () => {
    // Six columns do not fit 375px. The other two resolutions move into the
    // expanded row rather than being dropped, and the table never scrolls
    // sideways — the page body must never scroll horizontally.
    render(<FrameRateTable rows={rows} target="1440p" uncovered={[]} />)
    const off = screen.getByRole('columnheader', { name: /1080p/i })
    expect(off.className).toMatch(/hidden/)
    expect(off.className).toMatch(/sm:table-cell/)
    const on = screen.getByRole('columnheader', { name: /1440p/i })
    expect(on.className).not.toMatch(/hidden/)
  })

  it('hides the body cells of exactly the columns whose headers it hid', async () => {
    // A header and its column hidden at different breakpoints is a table that
    // shifts its own figures one column sideways below `sm` — the worst kind of
    // wrong, because every number is real and every one is under the wrong
    // heading. Asserted as a pair for that reason.
    const user = userEvent.setup()
    const { container } = render(<FrameRateTable rows={rows} target="1440p" uncovered={[]} />)
    await openGenre(user)
    const heads = [...container.querySelectorAll('thead th')].map((th) => th.className.includes('hidden'))
    const cells = [...container.querySelectorAll('tbody tr[data-game]')[0].children]
      .map((td) => td.className.includes('hidden'))
    expect(cells).toEqual(heads)
    // and the hiding is real, not vacuously false down both lists
    expect(heads.filter(Boolean)).toHaveLength(2)
  })

  it('renders a row per game, in the order given', async () => {
    // The order is the engine's — fastest game first. Asserting the NAMES are
    // present would pass for any order at all, which is the whole risk here.
    const user = userEvent.setup()
    render(<FrameRateTable rows={rows} target="1440p" uncovered={[]} />)
    await openGenre(user)
    expect(gameIdsIn(screen.getByRole('table'))).toEqual(['a', 'b'])
  })
})
