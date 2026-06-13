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
})
