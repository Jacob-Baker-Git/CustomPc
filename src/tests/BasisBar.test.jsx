import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BasisBar from '../components/performance/BasisBar'

const rows = [
  { basis: 'measured', avgFps: 100 },
  { basis: 'measured', avgFps: 95 },
  { basis: 'modelled', avgFps: 90 },
  { basis: 'spec-derived', avgFps: 80 },
  { basis: 'none', avgFps: null },
]

describe('BasisBar', () => {
  it('reports counts from the rows passed in', () => {
    render(<BasisBar rows={rows} realOnly={false} onRealOnlyChange={() => {}} />)
    // 2 measured, 1 modelled, 1 estimated (spec-derived) — the 'none' row is
    // unanswered and must not be counted anywhere.
    expect(screen.getByText(/2 benchmarked/)).toBeInTheDocument()
    expect(screen.getByText(/1 backed by real data/)).toBeInTheDocument()
    expect(screen.getByText(/1 estimated/)).toBeInTheDocument()
  })

  it('does NOT change the mix line when realOnly is true', () => {
    // The honesty property: the same unfiltered rows must produce the same
    // counts however the checkbox is set, or the control could be used to
    // make a thin evidence base look solid.
    const { container: off } = render(
      <BasisBar rows={rows} realOnly={false} onRealOnlyChange={() => {}} />,
    )
    const mixOff = off.querySelector('p').textContent

    const { container: on } = render(
      <BasisBar rows={rows} realOnly onRealOnlyChange={() => {}} />,
    )
    const mixOn = on.querySelector('p').textContent

    expect(mixOn).toBe(mixOff)
  })

  it('reflects realOnly on the checkbox, in both directions', () => {
    const { unmount } = render(<BasisBar rows={rows} realOnly={false} onRealOnlyChange={() => {}} />)
    expect(screen.getByRole('checkbox', { name: /only show real data/i })).not.toBeChecked()
    unmount()

    render(<BasisBar rows={rows} realOnly onRealOnlyChange={() => {}} />)
    expect(screen.getByRole('checkbox', { name: /only show real data/i })).toBeChecked()
  })

  it('calls onRealOnlyChange when the checkbox is clicked', async () => {
    const user = userEvent.setup()
    const onRealOnlyChange = vi.fn()
    render(<BasisBar rows={rows} realOnly={false} onRealOnlyChange={onRealOnlyChange} />)
    await user.click(screen.getByRole('checkbox', { name: /only show real data/i }))
    expect(onRealOnlyChange).toHaveBeenCalledWith(true)
  })

  it('hides the explainer until its button is clicked', async () => {
    const user = userEvent.setup()
    render(<BasisBar rows={rows} realOnly={false} onRealOnlyChange={() => {}} />)
    expect(screen.queryByText(/a reviewer ran this exact/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: /how is this worked out/i }))
    expect(screen.getByText(/a reviewer ran this exact/i)).toBeInTheDocument()
  })

  it('renders nothing when there are no answered rows', () => {
    const { container } = render(
      <BasisBar rows={[{ basis: 'none', avgFps: null }]} realOnly={false} onRealOnlyChange={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for an empty row list', () => {
    const { container } = render(
      <BasisBar rows={[]} realOnly={false} onRealOnlyChange={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('does not crash when rows is undefined, and renders nothing', () => {
    // The one caller today always passes report?.games ?? [], so this never
    // fires in practice — but the component has no defence of its own without
    // the default parameter, and basisMix(undefined) throws immediately.
    const { container } = render(
      <BasisBar rows={undefined} realOnly={false} onRealOnlyChange={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
