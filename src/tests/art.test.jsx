import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PartThumb from '../components/art/PartThumb'
import PartArt, { HAS_ART } from '../components/art/PartArt'
import GameArt from '../components/art/GameArt'
import { initialsFor } from '../lib/gameInitials'
import { artVariant } from '../lib/artVariant'
import { genreFor } from '../lib/gameGenres'
import { CATEGORIES } from '../lib/categories'

const PERIPHERALS = ['monitor', 'keyboard', 'mouse', 'headset']

describe('artVariant', () => {
  // The whole point is that it is NOT random. A drawing that changed on every
  // render would flicker in a list and make any screenshot test worthless.
  it('gives the same number for the same seed, every time', () => {
    expect(artVariant('gpu-rtx-4070')).toBe(artVariant('gpu-rtx-4070'))
  })

  it('gives different numbers for different seeds', () => {
    expect(artVariant('cpu-a')).not.toBe(artVariant('cpu-b'))
  })

  it('is a non-negative integer, so `% n` is always a valid index', () => {
    for (const s of ['', 'a', 'gpu-rtx-4070', 'ram-corsair-vengeance-32gb']) {
      const v = artVariant(s)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
    }
  })

  // A seed of undefined happens whenever a caller forgets the prop. It must
  // draw something rather than throw inside a list of 559 rows.
  it('survives a missing seed', () => {
    expect(() => artVariant(undefined)).not.toThrow()
  })
})

describe('PartArt', () => {
  // Every category in the app must draw as something. A category that fell
  // through would leave a hole in a grid, and nothing else would report it.
  it('has a drawing for every build category', () => {
    for (const c of CATEGORIES) expect(HAS_ART(c.id)).toBe(true)
  })

  it('has a drawing for every peripheral category', () => {
    for (const c of PERIPHERALS) expect(HAS_ART(c)).toBe(true)
  })

  it('draws nothing at all for a category it does not know', () => {
    const { container } = render(<PartArt category="flux-capacitor" seed="x" />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('renders real geometry rather than an empty frame', () => {
    for (const c of CATEGORIES) {
      const { container } = render(<PartArt category={c.id} seed={c.id} />)
      const svg = container.querySelector('svg')
      expect(svg, c.id).not.toBeNull()
      expect(svg.children.length, c.id).toBeGreaterThan(0)
    }
  })

  // Decorative by default. A list of 559 rows each announcing "graphics card
  // drawing" is a screen reader reading out the wallpaper.
  it('hides itself from assistive tech unless given a title', () => {
    const { container } = render(<PartArt category="gpu" seed="a" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')

    const titled = render(<PartArt category="gpu" seed="a" title="A graphics card" />)
    const svg = titled.container.querySelector('svg')
    expect(svg).toHaveAttribute('role', 'img')
    expect(svg).not.toHaveAttribute('aria-hidden')
  })
})

describe('PartThumb', () => {
  it('falls back to the category icon when there is no drawing', () => {
    const { container } = render(<PartThumb category="flux-capacitor" seed="x" />)
    expect(container.querySelector('[data-part-thumb]')).not.toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  // ⚠️ shrink-0 is load-bearing in every flex row this sits in. Without it the
  // PICTURE gives way to a long part name instead of the other way round, and
  // the tile collapses to a sliver rather than the text wrapping.
  it('refuses to shrink, so a long part name cannot crush it', () => {
    const { container } = render(<PartThumb category="gpu" seed="a" />)
    expect(container.querySelector('[data-part-thumb]').className).toContain('shrink-0')
  })

  it('carries both a width and a height at every size', () => {
    for (const size of ['sm', 'md', 'lg', 'xl']) {
      const { container } = render(<PartThumb category="cpu" seed="c" size={size} />)
      const cls = container.querySelector('[data-part-thumb]').className
      expect(cls, size).toMatch(/(^|\s)w-\d/)
      expect(cls, size).toMatch(/(^|\s)h-\d/)
    }
  })
})

describe('game initials', () => {
  it('skips the noise words that would make half a library read "T"', () => {
    expect(initialsFor('The Witcher 3')).toBe('W3')
    expect(initialsFor('A Plague Tale: Requiem')).toBe('PT')
  })

  it('takes two letters from a one-word title', () => {
    expect(initialsFor('Valorant')).toBe('VA')
  })

  it('keeps digits, so Anno 1800 is not AN', () => {
    expect(initialsFor('Anno 1800')).toBe('A1')
  })

  it('strips punctuation rather than initialling it', () => {
    expect(initialsFor("Baldur's Gate 3")).toBe('BG')
  })

  it('never returns an empty string', () => {
    for (const n of ['', '   ', '!!!', undefined, null]) {
      expect(initialsFor(n).length).toBeGreaterThan(0)
    }
  })
})

describe('GameArt', () => {
  it('draws a plate for a game with no genre at all', () => {
    const { container } = render(<GameArt name="Unknown Game" seed="u" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  // Two plates on one page must not share a gradient id, or the second one
  // silently inherits the first one's colours.
  it('gives two different games different gradient ids', () => {
    const a = render(<GameArt name="Alpha" genre="rpg" seed="alpha" />)
    const b = render(<GameArt name="Bravo" genre="rpg" seed="bravo" />)
    const idOf = (c) => c.querySelector('linearGradient').getAttribute('id')
    expect(idOf(a.container)).not.toBe(idOf(b.container))
  })
})

describe('genreFor', () => {
  it('prefers a genre the row already states', () => {
    expect(genreFor({ id: 'cs2', genre: 'horror' })).toBe('horror')
  })

  // The reason this lookup is keyed on id rather than being a data column:
  // useCatalogStore swaps the whole games array for Supabase rows after load.
  it('falls back to the local map when the row has no genre', () => {
    expect(genreFor({ id: 'cs2' })).toBe('shooter')
    expect(genreFor({ id: 'bg3' })).toBe('rpg')
  })

  it('returns a neutral genre for anything unknown', () => {
    expect(genreFor({ id: 'not-a-game' })).toBe('other')
    expect(genreFor(undefined)).toBe('other')
  })
})
