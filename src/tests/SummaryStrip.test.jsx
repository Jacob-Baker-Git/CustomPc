import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SummaryStrip from '../components/performance/SummaryStrip'

const report = (over = {}) => ({
  coverage: { gamesAnswered: 53, gamesTotal: 60, gamesExact: 0 },
  bottleneck: {
    leaning: 'gpu', gpuLedGames: 4, cpuLedGames: 0, gamesConsidered: 5,
    verdict: 'Graphics-limited in 4 of 5 games.',
  },
  ...over,
})

describe('SummaryStrip', () => {
  it('calls the tile Bottleneck, not "Held back by"', () => {
    render(<SummaryStrip hasCore report={report()} power={{}} resolution="1440p" />)
    expect(screen.getByText(/bottleneck/i)).toBeInTheDocument()
    expect(screen.queryByText(/held back by/i)).toBeNull()
  })

  it('states the base the verdict was computed from', () => {
    // The verdict comes from the games with a fitted CPU constant — 5 of 53
    // covered for a live build. Without the denominator the tile reads as a
    // whole-build claim drawn from 9% of the rows.
    render(<SummaryStrip hasCore report={report()} power={{}} resolution="1440p" />)
    expect(screen.getByText(/4 of 5 games where the split is known/i)).toBeInTheDocument()
  })

  it('quotes the count that matches the verdict it just gave', () => {
    // ⚠️ gpuLedGames + cpuLedGames does NOT equal gamesConsidered — the live
    // 13600K build is 4 graphics-led and 0 processor-led out of 5, the fifth
    // being balanced. So a tile that always quotes gpuLedGames would read
    // "processor / 0 of 5 games where the split is known" for a CPU-led build:
    // the headline and its own evidence contradicting each other.
    render(<SummaryStrip hasCore power={{}} resolution="1440p" report={report({
      bottleneck: {
        leaning: 'cpu', gpuLedGames: 1, cpuLedGames: 3, gamesConsidered: 5,
        verdict: 'Processor-limited in 3 of 5 games.',
      },
    })} />)
    expect(screen.getByText('processor')).toBeInTheDocument()
    expect(screen.getByText(/3 of 5 games where the split is known/i)).toBeInTheDocument()
  })

  it('says so when no game has a split at all', () => {
    render(<SummaryStrip hasCore report={report({ bottleneck: null })} power={{}} resolution="1440p" />)
    expect(screen.getByText(/needs benchmark data/i)).toBeInTheDocument()
  })
})
