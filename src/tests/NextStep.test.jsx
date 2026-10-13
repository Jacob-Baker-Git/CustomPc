import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import NextStep from '../components/NextStep'
import { stepsFor } from '../hooks/useHashView'
import useBuilderStore from '../store/useBuilderStore'

beforeEach(() => useBuilderStore.setState({ path: 'parts' }))

describe('stepsFor', () => {
  it('walks every tab when entering parts', () => {
    expect(stepsFor('parts')).toEqual(['build', 'performance', 'peripherals', 'summary'])
  })
  it('starts a game-target build at Peripherals', () => {
    expect(stepsFor('game')).toEqual(['peripherals', 'summary'])
  })
})

describe('NextStep', () => {
  it('goes to the next step of the path', async () => {
    const onChange = vi.fn()
    render(<NextStep view="build" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /next: performance/i }))
    expect(onChange).toHaveBeenCalledWith('performance')
  })
  it('skips Build and Performance on the game path', async () => {
    useBuilderStore.setState({ path: 'game' })
    const onChange = vi.fn()
    render(<NextStep view="build" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /next: peripherals/i }))
    expect(onChange).toHaveBeenCalledWith('peripherals')
  })
  it('renders nothing on the last step', () => {
    const { container } = render(<NextStep view="summary" onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
