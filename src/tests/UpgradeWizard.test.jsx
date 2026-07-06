import { render, screen, fireEvent } from '@testing-library/react'
import UpgradeWizard from '../components/UpgradeWizard'

describe('UpgradeWizard shell', () => {
  it('shows the heading and a back-to-menu control', () => {
    const onBack = vi.fn()
    render(<UpgradeWizard onBack={onBack} />)
    expect(screen.getByRole('heading', { name: /upgrade your pc/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /back to menu/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
