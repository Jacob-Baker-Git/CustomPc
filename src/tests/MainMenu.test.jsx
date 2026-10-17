import { render, screen, fireEvent, within } from '@testing-library/react'
import MainMenu from '../components/MainMenu'
import perfGames from '../data/perfGames.json'
import useBuilderStore from '../store/useBuilderStore'

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
    render(<MainMenu onExplore={noop} onTarget={noop} onSaved={noop} />)
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
  it('reaches the content pages through the footer, and only through it', () => {
    render(<MainMenu onExplore={noop} onTarget={noop} onSaved={noop} />)
    for (const href of ['/parts', '/glossary', '/help', '/feedback']) {
      // Exactly one route to each: the tile row that duplicated the footer is gone.
      expect(document.querySelectorAll(`a[href="${href}"]`)).toHaveLength(1)
    }
  })

  it('shows exactly three buttons, even with a build in progress', () => {
    useBuilderStore.setState({ selectedParts: { cpu: { id: 'x', price: 1 } } })
    render(<MainMenu onExplore={noop} onTarget={noop} onSaved={noop} />)
    // Inside <main> only: the footer is outside it and is not the Welcome's.
    const names = within(screen.getByRole('main')).getAllByRole('button').map((b) => b.textContent)
    expect(names).toHaveLength(3)
    expect(names[0]).toMatch(/what will my build get?/i)
    expect(names[1]).toMatch(/build for a game/i)
    expect(names[2]).toMatch(/saved builds/i)
  })

  it('wires each button to its path', () => {
    const onExplore = vi.fn(), onTarget = vi.fn(), onSaved = vi.fn()
    render(<MainMenu onExplore={onExplore} onTarget={onTarget} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: /what will my build get/i }))
    fireEvent.click(screen.getByRole('button', { name: /build for a game/i }))
    fireEvent.click(screen.getByRole('button', { name: /saved builds/i }))
    expect([onExplore, onTarget, onSaved].map((f) => f.mock.calls.length)).toEqual([1, 1, 1])
  })
})


// Configurator redesign (spec 2026-10-16): the PC is the picture, and the
// benchmark coverage is the one bracket tag.
describe('the Welcome screen in the configurator look', () => {
  it('shows the PC picture', () => {
    const { container } = render(<MainMenu onExplore={noop} onTarget={noop} onSaved={noop} />)
    const img = container.querySelector('img[src="/img/welcome-pc.webp"]')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('alt', '')
  })

  it('states the benchmark coverage from the games list', () => {
    render(<MainMenu onExplore={noop} onTarget={noop} onSaved={noop} />)
    expect(screen.getByText(`${perfGames.length}`).closest('span')).toHaveTextContent(`[ ${perfGames.length} games benchmarked ]`)
  })
})

describe('MainMenu on desktop', () => {
  it('lays the words and the picture out as two columns from lg', () => {
    const { container } = render(<MainMenu onExplore={() => {}} onTarget={() => {}} onSaved={() => {}} />)
    expect(container.querySelector('main').className).toMatch(/lg:max-w-6xl/)
    expect(container.querySelector('main').className).toMatch(/lg:grid-cols-2/)
    expect(container.querySelector('img').parentElement.className).toMatch(/lg:order-2/)
  })
})
