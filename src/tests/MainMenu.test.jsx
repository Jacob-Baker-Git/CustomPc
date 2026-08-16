import { render, screen, fireEvent } from '@testing-library/react'
import MainMenu from '../components/MainMenu'
import useBuilderStore from '../store/useBuilderStore'
import useSavedStore from '../store/useSavedStore'

const noop = () => {}

beforeEach(() => {
  useBuilderStore.setState({ budget: 0, selectedParts: {}, selectedPeripherals: {} })
})

// The landing page is the one URL with no path to describe it, and its heading
// was the single word pair "PC Builder" — a wordmark, saying nothing about what
// the page does. index.html already commits to "Custom PC Builder — Build &
// Price Your Gaming PC in 3D"; the visible heading has to agree with it rather
// than leaving the title tag to carry the meaning on its own.
describe('the landing heading says what the page is', () => {
  const heading = () => {
    render(<MainMenu onStart={noop} onResume={noop} onSaved={noop} />)
    return screen.getByRole('heading', { level: 1 })
  }

  it('is the only h1 on the page', () => {
    heading()
    expect(document.querySelectorAll('h1')).toHaveLength(1)
  })

  it('keeps the wordmark', () => {
    expect(heading()).toHaveTextContent(/custom pc builder/i)
  })

  it('describes the thing the page actually does', () => {
    const text = heading().textContent
    // The terms the title tag and meta description already stake out. A heading
    // that agrees with them is the point; one that merely repeats "PC Builder"
    // gives a crawler nothing the <title> did not already say.
    for (const term of [/gaming pc/i, /3d/i]) {
      expect(text, `h1 text: ${text}`).toMatch(term)
    }
  })

  // Visible text, not a hidden keyword stuffing. Anything in the h1 has to be on
  // screen for a reader too, which is why the descriptive half is a second line
  // rather than an sr-only span.
  it('shows every word of the heading on screen', () => {
    for (const span of heading().querySelectorAll('span')) {
      expect(span.className).not.toMatch(/sr-only|hidden/)
    }
  })
})

describe('MainMenu', () => {
  it('offers starting a build and the saved-builds library', () => {
    render(<MainMenu onStart={noop} onResume={noop} onSaved={noop} />)
    expect(screen.getByRole('button', { name: /start a build/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /saved builds/i })).toBeInTheDocument()
  })

  it('reaches the content pages through the footer, and only through it', () => {
    render(<MainMenu onStart={noop} onResume={noop} onSaved={noop} />)
    for (const href of ['/parts', '/glossary', '/help', '/feedback']) {
      // Exactly one route to each: the tile row that duplicated the footer is gone.
      expect(document.querySelectorAll(`a[href="${href}"]`)).toHaveLength(1)
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

// The entry screen is a bank of slots, and which ones are lit is the whole
// point of drawing them as slots at all. `seated` means HAS CONTENT — not
// "is the primary action" — so starting a build is permanently an empty slot
// while still being the thing the page most wants you to do. Copper carries
// action, gold carries state; crossing them collapses the distinction.
describe('the entry cards are slots, and seating tracks what is in them', () => {
  const boxes = (c) => [...c.querySelectorAll('[data-ram-box]')]
  const seatedOf = (c) => boxes(c).map((b) => b.getAttribute('data-seated'))

  beforeEach(() => {
    useSavedStore.setState({ saved: [] })
  })

  it('draws every option as a slot', () => {
    useBuilderStore.setState({ selectedParts: { cpu: { id: 'c', price: 200 } } })
    const { container } = render(<MainMenu onStart={noop} onResume={noop} onSaved={noop} />)
    expect(boxes(container)).toHaveLength(3)
    expect(container.querySelectorAll('[data-blade]')).toHaveLength(15)
  })

  it('leaves both slots cold for a first-time visitor', () => {
    const { container } = render(<MainMenu onStart={noop} onResume={noop} onSaved={noop} />)
    expect(seatedOf(container)).toEqual(['false', 'false'])
  })

  it('seats carry-on but never seats start-a-build', () => {
    useBuilderStore.setState({ selectedParts: { cpu: { id: 'c', price: 200 } } })
    const { container } = render(<MainMenu onStart={noop} onResume={noop} onSaved={noop} />)
    // Order is carry-on, start, saved.
    expect(seatedOf(container)).toEqual(['true', 'false', 'false'])
  })

  it('seats saved builds only once something is saved', () => {
    useSavedStore.setState({ saved: [{ id: 's1', name: 'A', parts: {} }] })
    const { container } = render(<MainMenu onStart={noop} onResume={noop} onSaved={noop} />)
    expect(seatedOf(container)).toEqual(['false', 'true'])
  })

  it('carries no designators', () => {
    // A designator names a real slot holding one swappable part. These are
    // navigation, and the first migration's invented ones were rejected for
    // exactly this reason — the silhouette carries the identity.
    useBuilderStore.setState({ selectedParts: { cpu: { id: 'c', price: 200 } } })
    const { container } = render(<MainMenu onStart={noop} onResume={noop} onSaved={noop} />)
    // Not `.font-mono`: TELEMETRY wears that too, so the part count would fail
    // this for the wrong reason.
    expect(container.querySelector('[data-designator]')).toBeNull()
  })

  it('never lights the contacts on a cold slot', () => {
    const { container } = render(<MainMenu onStart={noop} onResume={noop} onSaved={noop} />)
    const states = [...container.querySelectorAll('[data-contacts]')].map((el) =>
      el.getAttribute('data-contacts'),
    )
    expect(states).toEqual(['cold', 'cold'])
  })
})
