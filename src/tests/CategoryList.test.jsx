import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CategoryList from '../components/CategoryList'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')

describe('CategoryList', () => {
  it('renders the category rows', () => {
    render(<CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} />)
    expect(screen.getByText('CPU')).toBeInTheDocument()
    expect(screen.getByText('GPU')).toBeInTheDocument()
    expect(screen.getByText('Case Fans')).toBeInTheDocument()
  })

  it('shows a selected part with a remove control', () => {
    render(<CategoryList selectedParts={{ cpu }} onSelectCategory={() => {}} onDeselect={() => {}} />)
    expect(screen.getByText(cpu.name)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove cpu/i })).toBeInTheDocument()
  })

  it('calls onSelectCategory when a category row is clicked', () => {
    const onSelect = vi.fn()
    render(<CategoryList selectedParts={{}} onSelectCategory={onSelect} onDeselect={() => {}} />)
    fireEvent.click(screen.getByText('GPU'))
    expect(onSelect).toHaveBeenCalledWith('gpu')
  })
})
