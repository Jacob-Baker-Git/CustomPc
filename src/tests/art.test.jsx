import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PartThumb from '../components/art/PartThumb'
import PartArt, { HAS_ART } from '../components/art/PartArt'
import GameArt from '../components/art/GameArt'
import { initialsFor } from '../lib/gameInitials'
import { artVariant } from '../lib/artVariant'
import { genreFor } from '../lib/gameGenres'
import { CATEGORIES } from '../lib/categories'
import { GENRE_MARKS } from '../lib/gameGenreMarks'

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

  // ⚠️ BOTH, not either — and this is the assertion that stops the regression
  // coming back. A genre-mark-only plate was built and shipped to a screenshot
  // first: on the real Performance tab all thirteen shooters became the same
  // reticle on the same gold and the rows stopped being tellable apart. The
  // mark says what KIND of game; only the initials say WHICH one.
  it('draws the genre mark AND keeps the initials that identify the row', () => {
    const { container } = render(<GameArt name="Counter Strike" genre="shooter" seed="cs2" />)
    expect(container.querySelector('[data-genre-mark]'), 'the mark').not.toBeNull()
    expect(container.querySelector('text').textContent, 'the initials').toBe('CS')
  })

  // Two games of one genre share a mark, so the initials are the only thing
  // left that differs. If they ever stop rendering, every row in a genre
  // becomes the same tile.
  it('tells two games of the same genre apart by their initials', () => {
    const a = render(<GameArt name="Doom Eternal" genre="shooter" seed="doom-eternal" />)
    const b = render(<GameArt name="Counter Strike" genre="shooter" seed="cs2" />)
    expect(a.container.querySelector('text').textContent).toBe('DE')
    expect(b.container.querySelector('text').textContent).toBe('CS')
  })

  it('still draws initials when the genre is unknown', () => {
    const { container } = render(<GameArt name="Some Game" genre="other" seed="sg" />)
    expect(container.querySelector('[data-genre-mark]')).toBeNull()
    expect(container.querySelector('text').textContent).toBe('SG')
  })

  // The watermark must stay well behind the initials. At full strength it
  // competes with the two characters that are doing the identifying.
  it('keeps the mark faint enough to sit behind the initials', () => {
    const { container } = render(<GameArt name="Counter Strike" genre="shooter" seed="cs2" />)
    const op = Number(container.querySelector('[data-genre-mark]').getAttribute('opacity'))
    expect(op).toBeGreaterThan(0)
    expect(op).toBeLessThanOrEqual(0.3)
  })

  // The plate is what tells two same-genre rows apart, so it must keep varying
  // even though thirteen shooters now share one mark.
  //
  // ⚠️ Seeds matter here: artVariant('alpha') and artVariant('bravo') collide
  // on BOTH `% 8` (the gradient angle) and `% 20` (the sweep offset), so that
  // pair would fail this assertion no matter what GameArt draws — a property
  // of the hash and those two strings, verified independently of any genre-mark
  // change. 'cs2'/'valorant' differ on both moduli.
  it('still varies the plate between two games of the same genre', () => {
    const a = render(<GameArt name="Counter-Strike 2" genre="shooter" seed="cs2" />)
    const b = render(<GameArt name="Valorant" genre="shooter" seed="valorant" />)
    const gradOf = (c) => c.querySelector('linearGradient').getAttribute('gradientTransform')
    const sweepOf = (c) => c.querySelector('path[opacity]').getAttribute('d')
    expect(gradOf(a.container) !== gradOf(b.container) || sweepOf(a.container) !== sweepOf(b.container)).toBe(true)
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

describe('gameGenreMarks', () => {
  // Every genre the app can actually produce must draw something. `other` is
  // deliberately absent: a game with no genre has nothing to say, so GameArt
  // falls back to its initials rather than inventing a symbol for it.
  const DRAWN = [
    'action-adventure', 'rpg', 'shooter',
    'strategy-sim', 'horror', 'racing', 'moba', 'sports',
  ]

  it('has a mark for every genre that is not the neutral fallback', () => {
    for (const g of DRAWN) {
      expect(GENRE_MARKS[g], `a mark for ${g}`).toBeTypeOf('function')
    }
  })

  it('has no mark for the neutral genre', () => {
    expect(GENRE_MARKS.other).toBeUndefined()
  })

  // ⚠️ The whole point of these is that they survive being 24px wide. A hairline
  // at 48 units is a third of a device pixel at 24 and disappears. Nothing here
  // may be thinner than 2 units.
  it('draws no stroke too thin to survive 24px', () => {
    for (const g of DRAWN) {
      const Mark = GENRE_MARKS[g]
      const { container } = render(<svg viewBox="0 0 48 48"><Mark /></svg>)
      const widths = [...container.querySelectorAll('[stroke-width]')]
        .map((el) => Number(el.getAttribute('stroke-width')))
      for (const w of widths) {
        expect(w, `${g} stroke-width`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('paints with currentColor so the plate decides the ink', () => {
    for (const g of DRAWN) {
      const Mark = GENRE_MARKS[g]
      const { container } = render(<svg viewBox="0 0 48 48"><Mark /></svg>)
      const painted = [...container.querySelectorAll('[fill], [stroke]')]
      expect(painted.length, `${g} paints something`).toBeGreaterThan(0)
      for (const el of painted) {
        for (const attr of ['fill', 'stroke']) {
          const v = el.getAttribute(attr)
          if (v && v !== 'none') expect(v, `${g} ${attr}`).toBe('currentColor')
        }
      }
    }
  })
})
