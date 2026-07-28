import { render, screen, fireEvent } from '@testing-library/react'
import MainMenu from '../components/MainMenu'
import useBuilderStore from '../store/useBuilderStore'

const noop = () => {}

beforeEach(() => {
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {} })
})

describe('MainMenu', () => {
  it('offers starting a build and the saved-builds library', () => {
    render(<MainMenu onStart={noop} onResume={noop} onSaved={noop} />)
    expect(screen.getByRole('button', { name: /start a build/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /saved builds/i })).toBeInTheDocument()
  })

  it('surfaces the content pages that used to be footer-only', () => {
    render(<MainMenu onStart={noop} onResume={noop} onSaved={noop} />)
    for (const href of ['#/parts', '#/glossary', '#/help', '#/feedback']) {
      expect(document.querySelector(`a[href="${href}"]`)).toBeTruthy()
    }
  })

  it('hides the resume card when there is no build yet', () => {
    render(<MainMenu onStart={noop} onResume={noop} onSaved={noop} />)
    expect(screen.queryByRole('button', { name: /carry on building/i })).toBeNull()
  })

  it('shows the resume card with the build so far once parts are chosen', () => {
    useBuilderStore.setState({
      budget: 1500,
      selectedParts: { cpu: { id: 'c', price: 200 }, gpu: { id: 'g', price: 400 } },
    })
    render(<MainMenu onStart={noop} onResume={noop} onSaved={noop} />)
    const resume = screen.getByRole('button', { name: /carry on building/i })
    expect(resume).toHaveTextContent('2 parts chosen')
    expect(resume).toHaveTextContent('£600')
    expect(resume).toHaveTextContent('£1500')
  })

  it('calls the right handler for each option', () => {
    const onStart = vi.fn()
    const onResume = vi.fn()
    const onSaved = vi.fn()
    useBuilderStore.setState({ selectedParts: { cpu: { id: 'c', price: 200 } } })
    render(<MainMenu onStart={onStart} onResume={onResume} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: /carry on building/i }))
    fireEvent.click(screen.getByRole('button', { name: /start a different build/i }))
    fireEvent.click(screen.getByRole('button', { name: /saved builds/i }))
    expect(onResume).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onSaved).toHaveBeenCalledTimes(1)
  })
})
