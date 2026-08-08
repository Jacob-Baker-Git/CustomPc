import { PRICE_SNAPSHOT } from '../lib/siteContent'

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
export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line py-6 text-center text-xs text-muted">
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} className="hover:text-accent transition-colors">{l.label}</a>
        ))}
      </nav>
      <p className="mt-4">Prices are curated estimates ({PRICE_SNAPSHOT}). Free · no sign-up.</p>
    </footer>
  )
}
