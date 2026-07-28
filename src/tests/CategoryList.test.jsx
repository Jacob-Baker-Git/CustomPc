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

  it('renders a single-column list by default', () => {
    const { container } = render(
      <CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} />
    )
    expect(container.firstChild).toHaveClass('space-y-2')
  })

  it('renders a grid when columns=2 (desktop parts area)', () => {
    const { container } = render(
      <CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} columns={2} />
    )
    expect(container.firstChild).toHaveClass('grid')
    expect(container.firstChild).toHaveClass('lg:grid-cols-2')
  })

  // The 3D hover highlight reads hoveredCategory but nothing was setting it,
  // so the feature was silently dead. These hold the wiring in place.
  describe('hover reporting for the 3D highlight', () => {
    it('reports the category under the pointer, and null on leave', () => {
      const onHoverCategory = vi.fn()
      render(
        <CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} onHoverCategory={onHoverCategory} />
      )
      const gpuRow = screen.getByText('GPU').closest('button')
      fireEvent.mouseEnter(gpuRow)
      expect(onHoverCategory).toHaveBeenCalledWith('gpu')
      fireEvent.mouseLeave(gpuRow)
      expect(onHoverCategory).toHaveBeenLastCalledWith(null)
    })

    it('reports rows that already hold a part', () => {
      const onHoverCategory = vi.fn()
      render(
        <CategoryList selectedParts={{ cpu }} onSelectCategory={() => {}} onDeselect={() => {}} onHoverCategory={onHoverCategory} />
      )
      fireEvent.mouseEnter(screen.getByText(cpu.name).closest('div'))
      expect(onHoverCategory).toHaveBeenCalledWith('cpu')
    })

    it('also reports on keyboard focus, not just the pointer', () => {
      const onHoverCategory = vi.fn()
      render(
        <CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} onHoverCategory={onHoverCategory} />
      )
      const gpuRow = screen.getByText('GPU').closest('button')
      fireEvent.focus(gpuRow)
      expect(onHoverCategory).toHaveBeenCalledWith('gpu')
      fireEvent.blur(gpuRow)
      expect(onHoverCategory).toHaveBeenLastCalledWith(null)
    })

    it('is inert when no handler is supplied (the setup flow has no 3D)', () => {
      render(<CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} />)
      expect(() => fireEvent.mouseEnter(screen.getByText('GPU').closest('button'))).not.toThrow()
    })
  })
})
