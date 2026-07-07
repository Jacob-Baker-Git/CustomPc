// Simple anchor nav — hrefs drive usePageRoute via hashchange, no prop drilling.
const LINKS = [
  { href: '#/help', label: 'Help & FAQ' },
  { href: '#/parts', label: 'Parts browser' },
  { href: '#/glossary', label: 'Glossary' },
  { href: '#/feedback', label: 'Feedback' },
]

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} className="hover:text-cyan-300 transition-colors">{l.label}</a>
        ))}
      </nav>
      <p className="mt-4">Prices are curated estimates (July 2026). Free · no sign-up.</p>
    </footer>
  )
}
