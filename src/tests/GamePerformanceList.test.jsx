import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import GamePerformanceList from '../components/GamePerformanceList'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4090')

describe('GamePerformanceList', () => {
  it('renders nothing without a cpu and gpu', () => {
    const { container } = render(<GamePerformanceList cpu={null} gpu={null} resolution="1440p" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists games for a build', () => {
    render(<GamePerformanceList cpu={cpu} gpu={gpu} resolution="1440p" />)
    expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument()
    expect(screen.getByText('Cyberpunk 2077')).toBeInTheDocument()
  })
})
