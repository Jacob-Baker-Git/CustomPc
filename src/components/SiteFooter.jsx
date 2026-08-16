import { PRICE_SNAPSHOT } from '../lib/siteContent'
import { GROUND_RGB, SCRIM_ALPHA } from '../lib/boardGeometry'

// Plain anchors with real hrefs, which is what makes them crawlable — and also
// the site's whole internal link graph. usePageRoute intercepts the click and
// turns it into a pushState, so they stay instant without needing route
// context passed down here.
const LINKS = [
  { href: '/help', label: 'Help & FAQ' },
  { href: '/parts', label: 'Parts browser' },
  { href: '/glossary', label: 'Glossary' },
  { href: '/feedback', label: 'Feedback' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

// text-muted rather than text-faint on the footer body: it carries the price
// caveat and the policy links, and faint is 3.9:1 here — below WCAG AA.
//
// ⚠️ It carries its OWN ground, and that is not decoration.
//
// The footer now appears on every screen, including the builder — and the
// builder deliberately has no scrim, because it is covered in opaque panels and
// has no prose to protect. It has prose now. Measured against the board:
//
//   --muted (#99A0AB) on a full-strength trace ....... 1.63:1
//
// and below `lg` the edge-pinned hardware layers reach far enough inward to sit
// behind a centred column, so solid gold pads are in play too. Backing the
// footer at SCRIM_ALPHA takes the heaviest trace to 0.68 * 0.18 = 0.12, inside
// the ceiling the palette measurement sets. On pages that already scrim their
// column this is redundant and invisible; on the builder it is the only thing
// standing between the links and the artwork.
//
// The band spans the full width of whatever it is placed in, so give it a
// full-width parent on any screen without a scrim — a band cropped to the text
// column leaves the hardware layers showing on either side of it.
const GROUND = `rgba(${GROUND_RGB},${SCRIM_ALPHA})`

export default function SiteFooter() {
  return (
    <footer
      className="mt-16 border-t border-line py-6 text-center text-xs text-muted"
      style={{ backgroundColor: GROUND }}
    >
      <div className="mx-auto w-full max-w-3xl px-4">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-copper transition-colors">{l.label}</a>
          ))}
        </nav>
        <p className="mt-4">Prices are curated estimates ({PRICE_SNAPSHOT}). Free · no sign-up.</p>
      </div>
    </footer>
  )
}
