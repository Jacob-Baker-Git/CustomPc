import { render, screen } from '@testing-library/react'
import Dock from '../components/Dock'
import useBuilderStore from '../store/useBuilderStore'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.category === 'cpu')

beforeEach(() => {
  useBuilderStore.setState({ path: 'parts', selectedParts: {}, selectedPeripherals: {} })
})

describe('Dock', () => {
  it('cannot save an empty build, and says £0', () => {
    render(<Dock view="summary" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /save build/i })).toBeDisabled()
    expect(screen.getByText('Build £0')).toBeInTheDocument()
  })

  it('offers the next step everywhere but Summary', () => {
    useBuilderStore.setState({ selectedParts: { cpu } })
    render(<Dock view="performance" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /next: peripherals/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save build/i })).toBeNull()
  })

  it('can save once there is a build', () => {
    useBuilderStore.setState({ selectedParts: { cpu } })
    render(<Dock view="summary" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /save build/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
  })
})
