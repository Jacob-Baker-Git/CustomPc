import { render, screen, fireEvent } from '@testing-library/react'
import PartCard from '../components/PartCard'
import partsData from '../data/partsData.json'

const cpu = partsData.find(p => p.id === 'cpu-ryzen-7-7700x')

describe('PartCard', () => {
  it('renders part name and price', () => {
    render(<PartCard part={cpu} locked={false} lockReason="" onSelect={() => {}} />)
    expect(screen.getByText(cpu.name)).toBeInTheDocument()
    expect(screen.getByText(/299/)).toBeInTheDocument()
  })

  it('shows lock icon when locked', () => {
    render(<PartCard part={cpu} locked={true} lockReason="Requires AM5 socket" onSelect={() => {}} />)
    expect(screen.getByRole('img', { name: /locked/i })).toBeInTheDocument()
  })

  it('is a real button so keyboard users can reach it', () => {
    render(<PartCard part={cpu} locked={false} lockReason="" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: new RegExp(`^${cpu.name}`) })).toBeInTheDocument()
  })

  it('shows the lock reason as visible text, not just a hover tooltip', () => {
    render(<PartCard part={cpu} locked={true} lockReason="Requires AM5 socket" onSelect={() => {}} />)
    expect(screen.getByText('Requires AM5 socket')).toBeInTheDocument()
  })

  it('marks the currently selected part', () => {
    render(<PartCard part={cpu} locked={false} lockReason="" selected onSelect={() => {}} />)
    expect(screen.getByText(/selected/i)).toBeInTheDocument()
  })

  it('hides the full spec sheet until the info button is pressed', () => {
    render(<PartCard part={cpu} locked={false} lockReason="" onSelect={() => {}} />)
    expect(screen.queryByText(/cores/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /more info/i }))
    expect(screen.getByText(/cores/i)).toBeInTheDocument()
    expect(screen.getByText(/brand/i)).toBeInTheDocument()
  })

  it('does not select the part when opening info', () => {
    const onSelect = vi.fn()
    render(<PartCard part={cpu} locked={false} lockReason="" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /more info/i }))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
