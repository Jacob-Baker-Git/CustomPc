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

  // The 3D hover highlight was removed on request, and the hover reporting that
  // fed it went with it. This holds that removal in place: reinstating handlers
  // that write to a store field nobody reads is how the last dead branch grew.
  it('does not report hover — the 3D highlight it fed is gone', () => {
    const onHoverCategory = vi.fn()
    render(
      <CategoryList selectedParts={{ cpu }} onSelectCategory={() => {}} onDeselect={() => {}} onHoverCategory={onHoverCategory} />
    )
    fireEvent.mouseEnter(screen.getByText('GPU').closest('button'))
    fireEvent.mouseEnter(screen.getByText(cpu.name).closest('div'))
    expect(onHoverCategory).not.toHaveBeenCalled()
  })

  it('names the category on a filled row, not just the product', () => {
    render(<CategoryList selectedParts={{ cpu }} onSelectCategory={() => {}} onDeselect={() => {}} />)
    const row = screen.getByText(cpu.name).closest('div')
    expect(row).toHaveTextContent(/cpu/i)
  })

  describe('emphasiseMissing (Build tab only)', () => {
    it('tags every unfilled essential as missing', () => {
      render(
        <CategoryList selectedParts={{ cpu }} onSelectCategory={() => {}} onDeselect={() => {}} emphasiseMissing />
      )
      // 9 essentials, CPU filled → 8 still missing.
      expect(screen.getAllByText('Missing')).toHaveLength(8)
    })

    // Paste is deliberately empty, so it must not read as a hole.
    it('explains thermal paste instead of flagging it', () => {
      render(<CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} emphasiseMissing />)
      const paste = screen.getByText('Thermal Paste').closest('button')
      expect(paste).toHaveTextContent(/optional/i)
      expect(paste).toHaveTextContent(/coolers ship with paste/i)
      expect(paste).not.toHaveTextContent('Missing')
    })

    it('still marks the next recommended pick', () => {
      render(<CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} emphasiseMissing />)
      const board = screen.getByText('Motherboard').closest('button')
      expect(board).toHaveTextContent(/pick one/i)
      expect(board).toHaveTextContent('Missing')
    })

    // Colour alone must never carry the meaning.
    it('every state carries a text tag, not just a colour', () => {
      render(
        <CategoryList selectedParts={{ cpu }} onSelectCategory={() => {}} onDeselect={() => {}} emphasiseMissing />
      )
      expect(screen.getAllByText('Missing').length).toBeGreaterThan(0)
      // The optional slot carries BOTH the explanation and an "Add" affordance,
      // so this matches more than once by design.
      expect(screen.getAllByText(/optional/i).length).toBeGreaterThan(0)
    })
  })

  // SetupFlow renders this same list for "the PC I already own", where an empty
  // slot means "I don't have one" — flagging those red would be a lie.
  it('stays quiet about missing parts by default', () => {
    render(<CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} />)
    expect(screen.queryByText('Missing')).toBeNull()
  })
})
