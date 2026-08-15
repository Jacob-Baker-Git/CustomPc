import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FrameRateRow from '../components/performance/FrameRateRow'

const cell = (over = {}) => ({
  avgFps: 100, lowFps: 80, frameTimeMs: 10, basis: 'ceiling', bound: 'upper',
  cpuShare: null, limitedBy: null, caveats: [], errorPct: null, presetId: 'ultra',
  upscaling: 'native', ...over,
})

const game = (over = {}) => ({
  gameId: 'g', name: 'Test Game', preset: 'Ultra', presetId: 'ultra',
  upscaling: 'native', presetTier: 4,
  cells: { '1080p': cell({ avgFps: 300 }), '1440p': cell({ avgFps: 200 }), '4k': cell({ avgFps: 100 }) },
  basis: 'ceiling', errorPct: null, caveats: [], otherPresets: [], bestFps: 300,
  ...over,
})

const renderRow = ({ game: over, ...props } = {}) => render(
  <table><tbody>
    <FrameRateRow game={game(over)} target="1440p" onSelect={() => {}} {...props} />
  </tbody></table>,
)

describe('FrameRateRow', () => {
  it('shows a figure per resolution', () => {
    renderRow()
    for (const n of ['300', '200', '100']) {
      expect(screen.getByText(n)).toBeInTheDocument()
    }
  })

  it('renders a dash, not a zero, where a resolution has no answer', () => {
    // A zero reads as "zero frames per second". Roughly 10% of the grid is
    // empty, so this is the common case, not an edge one.
    renderRow({ game: { cells: { '1080p': cell({ avgFps: 300 }), '1440p': null, '4k': cell({ avgFps: 100 }) } } })
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('marks a ceiling cell with ≤ and leaves a point estimate bare', () => {
    // Per CELL, not per row: a game can be a ceiling at 4K and a point estimate
    // at 1080p, and one marker for the whole row would misdescribe both.
    //
    // Asserted column by column rather than by text search. The ≤ is its own
    // <span> (it is dimmer than the figure), so a text query cannot match
    // "≤300" across the two elements — and checking the columns positionally
    // proves the marker landed on the RIGHT cell, which a text search would not.
    const { container } = renderRow({ game: { cells: {
      '1080p': cell({ avgFps: 300, bound: 'upper' }),
      '1440p': cell({ avgFps: 200, bound: 'point' }),
      '4k': null,
    } } })
    const cells = [...container.querySelectorAll('tr[data-game] td')]
    // Game, Preset, then one per resolution, then Basis.
    const [, , at1080, at1440, at4k] = cells
    expect(at1080.textContent).toBe('≤300')
    expect(at1440.textContent).toBe('200')
    expect(at4k.textContent).toBe('—')
  })

  it('labels the row with its basis and band', () => {
    renderRow({ game: { basis: 'spec-derived', errorPct: 34 } })
    expect(screen.getByText(/estimate/i)).toBeInTheDocument()
    expect(screen.getByText(/±34%/)).toBeInTheDocument()
  })

  it('names each tier the way a reader can act on', () => {
    // Inherited from FpsCard.test.jsx, which pinned these three labels before
    // the card was retired. `spec-derived` and `ceiling` share the word
    // "estimate" deliberately — the difference between them is the ≤, which
    // `bound` drives, not the tier name.
    for (const [basis, label] of [
      ['measured', 'benchmarked'],
      ['modelled', 'backed by real data'],
      ['spec-derived', 'estimate'],
      ['ceiling', 'estimate'],
    ]) {
      const { unmount } = renderRow({ game: { basis } })
      expect(screen.getByText(new RegExp(label, 'i')), basis).toBeInTheDocument()
      unmount()
    }
  })

  it('falls back to the raw basis string for an unrecognised tier, rather than blank', () => {
    // Also inherited from FpsCard. A tier added to the engine without this file
    // being touched must still print something — a blank cell where the basis
    // goes reads as "no basis", which is the one claim it must never make.
    renderRow({ game: { basis: 'totally-new-tier' } })
    expect(screen.getByText('totally-new-tier')).toBeInTheDocument()
  })

  it('omits the band entirely when there is none', () => {
    // Pairs with the test above. Without it, an implementation that always
    // printed "±" followed by nothing would pass.
    renderRow({ game: { basis: 'ceiling', errorPct: null } })
    expect(screen.queryByText(/±/)).toBeNull()
  })

  it('hides the detail until expanded, then shows it', async () => {
    const user = userEvent.setup()
    renderRow({ game: { caveats: ['cpu-index-prior'] } })
    expect(screen.queryByText(/processor index came from its specs/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: /test game/i }))
    expect(screen.getByText(/processor index came from its specs/i)).toBeInTheDocument()
  })

  it('lists the game’s other presets in the expansion', async () => {
    const user = userEvent.setup()
    renderRow({ game: { otherPresets: [
      { presetKey: 'low|native', presetId: 'low', preset: 'Low', presetTier: 1, avgFps: 900 },
    ] } })
    await user.click(screen.getByRole('button', { name: /test game/i }))
    expect(screen.getByText(/Low/)).toBeInTheDocument()
  })

  it('tells the caller which game was selected', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    renderRow({ onSelect })
    await user.click(screen.getByRole('button', { name: /test game/i }))
    expect(onSelect).toHaveBeenCalledWith('g')
  })

  it('says the split is not modelled rather than drawing a half-empty bar', async () => {
    // `1 - null` is 1 in JavaScript, so a bar drawn anyway shows a FULL graphics
    // bar labelled "balanced" — two contradictory claims, neither measured.
    // About 48 of 53 covered games have no split, so this is the normal case.
    const user = userEvent.setup()
    renderRow()
    await user.click(screen.getByRole('button', { name: /test game/i }))
    expect(screen.getByText(/split not modelled/i)).toBeInTheDocument()
  })

  it('states the split in words when one exists', async () => {
    // Pairs with the test above: without it, an implementation that ALWAYS said
    // "split not modelled" would pass.
    const user = userEvent.setup()
    renderRow({ game: { cells: {
      '1080p': null,
      '1440p': cell({ avgFps: 200, cpuShare: 0.25, limitedBy: 'gpu' }),
      '4k': null,
    } } })
    await user.click(screen.getByRole('button', { name: /test game/i }))
    expect(screen.getByText(/75% graphics/i)).toBeInTheDocument()
    expect(screen.queryByText(/split not modelled/i)).toBeNull()
  })

  it('marks the summary row with its game id, and only the summary row', async () => {
    // The table counts rows per game. Expanding adds a SECOND <tr>, so a test
    // counting `tbody tr` would count expansions as games.
    const user = userEvent.setup()
    const { container } = renderRow()
    expect(container.querySelectorAll('tr[data-game]')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /test game/i }))
    expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(1)
    expect(container.querySelectorAll('tr[data-game]')).toHaveLength(1)
  })

  it('reports its expanded state to assistive technology', () => {
    renderRow()
    expect(screen.getByRole('button', { name: /test game/i }))
      .toHaveAttribute('aria-expanded', 'false')
  })
})
