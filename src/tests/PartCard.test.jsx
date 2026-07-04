import { render, screen } from '@testing-library/react'
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
    expect(screen.getByText('🔒')).toBeInTheDocument()
  })

  it('is a real button so keyboard users can reach it', () => {
    render(<PartCard part={cpu} locked={false} lockReason="" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: new RegExp(cpu.name) })).toBeInTheDocument()
  })

  it('shows the lock reason as visible text, not just a hover tooltip', () => {
    render(<PartCard part={cpu} locked={true} lockReason="Requires AM5 socket" onSelect={() => {}} />)
    expect(screen.getByText('Requires AM5 socket')).toBeInTheDocument()
  })

  it('marks the currently selected part', () => {
    render(<PartCard part={cpu} locked={false} lockReason="" selected onSelect={() => {}} />)
    expect(screen.getByText(/selected/i)).toBeInTheDocument()
  })
})
