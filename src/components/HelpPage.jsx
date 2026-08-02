import { MODEL_CREDITS } from '../lib/siteContent'

const FAQS = [
  { q: 'How does "Build a new PC" work?', a: 'Enter a budget and pick how you\'ll use the PC. We pick the strongest set of compatible parts that fits your budget for that use case — so the same budget produces a different build for gaming than for office work.' },
  { q: 'What do the use-case ratings mean?', a: 'Each part is scored out of 100 two ways: how well it suits your task, and how well it works with the rest of the build (a great GPU held back by a weak CPU, too little RAM, or an undersized PSU loses points). The lower of the two is the part\'s score, and we tell you what\'s holding it back.' },
  { q: 'How does "Upgrade your PC" work?', a: 'Enter your current parts (or load a saved build), choose a use case, and you get a ratings dashboard. Click any part to see cheaper-first upgrades that would raise its score — with the extra cost and, for gaming, the FPS gain.' },
  { q: 'Are the prices real?', a: 'Prices are curated estimates from July 2026, shown so builds compare sensibly. Use the "View on Amazon" links to check live pricing.' },
  { q: 'What does compatibility checking cover?', a: 'CPU/motherboard sockets, DDR4 vs DDR5, GPU length vs case, air-cooler height vs case, and PSU wattage headroom. Incompatible parts are shown locked with the reason.' },
  { q: 'Do I need an account?', a: 'No. It\'s free with no sign-up — your builds are saved in your browser only.' },
]

export default function HelpPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Help &amp; FAQ</h1>
      <p className="text-muted text-sm mb-6">How the builder and upgrade tools work.</p>
      <div className="space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="group border border-line rounded-lg px-4 py-3">
            <summary className="cursor-pointer text-ink font-medium list-none flex justify-between items-center">
              {f.q}
              <span className="text-muted group-open:rotate-180 transition-transform">⌄</span>
            </summary>
            <p className="text-sm text-muted mt-2 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>

      <section id="model-credits" className="mt-10 border-t border-line pt-6">
        <h2 className="text-lg font-semibold mb-1">3D model credits</h2>
        <p className="text-sm text-muted mb-3">
          The parts in the 3D view use these models from Sketchfab, licensed under{' '}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            CC BY 4.0
          </a>
          . Each has been resized and re-oriented to fit the build, and some have
          unused parts of the mesh hidden — so these are modified versions of the
          originals, not the originals themselves. The case is our own work.
        </p>
        <ul className="space-y-1 text-sm text-muted">
          {MODEL_CREDITS.map((c) => (
            <li key={c.part}>
              <span className="text-ink">{c.part}:</span> &ldquo;{c.title}&rdquo; by {c.author}
              {c.source && (
                <>
                  {' — '}
                  <a href={c.source} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    source
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
