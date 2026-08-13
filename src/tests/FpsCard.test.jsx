import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FpsCard from '../components/performance/FpsCard'

const row = (over = {}) => ({
  rowId: 'g|ultra|native', gameId: 'g', name: 'Test Game', preset: 'Ultra',
  presetId: 'ultra', presetTier: 4, upscaling: 'native', presetExact: true,
  avgFps: 94, lowFps: 71, frameTimeMs: 10.6, lowFrameTimeMs: 14.1,
  lowBasis: 'modelled', cpuShare: 0.4, limitedBy: 'gpu', atEngineCap: false,
  basis: 'modelled', sources: 3, bound: 'point', caveats: [], errorPct: null,
  ...over,
})

describe('FpsCard tiers', () => {
  it('labels a benchmarked row', () => {
    render(<FpsCard row={row({ basis: 'measured' })} />)
    expect(screen.getByText(/benchmarked/i)).toBeInTheDocument()
  })

  it('labels a modelled row as backed by real data', () => {
    render(<FpsCard row={row()} />)
    expect(screen.getByText(/backed by real data/i)).toBeInTheDocument()
  })

  it('labels a spec-derived row as an estimate and shows its band', () => {
    render(<FpsCard row={row({ basis: 'spec-derived', errorPct: 35 })} />)
    expect(screen.getByText(/estimate/i)).toBeInTheDocument()
    expect(screen.getByText(/±35%/)).toBeInTheDocument()
  })

  it('renders a ceiling row as "up to", never as a bare number', () => {
    // A bare figure would claim a point estimate the row cannot support.
    render(<FpsCard row={row({ basis: 'ceiling', bound: 'upper', caveats: ['no-cpu-constant'] })} />)
    expect(screen.getByText(/up to/i)).toBeInTheDocument()
    // "up to" alone does not pin the tier label — BASIS_LABEL.ceiling could
    // silently regress to something else (e.g. 'benchmarked') and this test
    // would still pass on the "up to" assertion. Checking the badge text too
    // is what actually catches that mutation.
    expect(screen.getByText(/estimate/i)).toBeInTheDocument()
  })

  it('does not say "up to" on a point estimate', () => {
    render(<FpsCard row={row()} />)
    expect(screen.queryByText(/up to/i)).toBeNull()
  })

  it('hides caveats until the expander is used, then shows them', async () => {
    const user = userEvent.setup()
    render(<FpsCard row={row({ basis: 'spec-derived', caveats: ['gpu-index-prior'] })} />)
    expect(screen.queryByText(/graphics card index came from its specs/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: /why/i }))
    expect(screen.getByText(/graphics card index came from its specs/i)).toBeInTheDocument()
  })

  it('offers no expander when there is nothing to explain', () => {
    render(<FpsCard row={row()} />)
    expect(screen.queryByRole('button', { name: /why/i })).toBeNull()
  })

  it('still renders a no-data row as no data', () => {
    render(<FpsCard row={row({ basis: 'none', avgFps: null })} />)
    expect(screen.getByText(/no benchmark data/i)).toBeInTheDocument()
  })
})
