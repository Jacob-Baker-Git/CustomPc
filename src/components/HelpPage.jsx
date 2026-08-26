import { MODEL_CREDITS, PRICE_SNAPSHOT, FPS_CAVEAT } from '../lib/siteContent'

// These answers name what the buttons actually say. They previously described
// "Build a new PC" and "Upgrade your PC" — two flows that had been renamed to
// "Pick parts for me" and "I already have a PC" — and pointed at a "View on
// Amazon" link that is labelled "Find Best Price". Copy that names the wrong
// button is worse than no copy: it makes people think they are in the wrong place.
const FAQS = [
  { q: 'How do I start?', a: 'Three ways. "Pick parts for me" takes a budget and a use case and assembles a balanced, compatible build you can then change. "I already have a PC" lets you enter what you own to see what is holding it back. "Empty build" gives you a blank slate to choose every part yourself.' },
  { q: 'Why does the same budget give me a different build?', a: 'Because the use case changes what the money should go on. A gaming build spends heavily on the graphics card; an office build spreads it across the processor, memory and storage instead. Pick the one closest to what you actually do.' },
  { q: 'What does the CustomPC score mean?', a: 'Each part is scored out of 100 two ways: how well it suits your chosen task, and how well it works with the rest of the build: a strong graphics card held back by a weak processor, too little memory or an undersized power supply all lose points. The lower of the two is the part\'s score, and we say what is holding it back.' },
  { q: 'How do I see upgrades?', a: 'Open the Build tab. Every part has an "Upgrade…" dropdown listing cheaper-first swaps that would raise its score, with the extra cost and, for gaming and streaming, the estimated frame-rate gain. "Best next move" at the top picks out the single change with the most impact.' },
  { q: 'Are the prices real?', a: `Prices are curated estimates from ${PRICE_SNAPSHOT}, shown so builds compare sensibly against each other rather than as live retail data. Use the "Find Best Price" links to check what a part actually costs today.` },
  { q: 'Are the frame rates real?', a: FPS_CAVEAT },
  { q: 'What does "Discontinued" mean on a part?', a: 'It is a part that is no longer made: older graphics cards, processors and motherboards. They are listed so you can tell us what you already own in the upgrade flow, and so the parts browser is a useful reference. We never put them in a build we assemble for you, and a retailer link for one will mostly turn up used or third-party stock.' },
  { q: 'What does compatibility checking cover?', a: 'Processor and motherboard sockets, DDR4 versus DDR5 memory, graphics card length against the case, air-cooler height against the case and power supply headroom. Parts that would not fit stay visible but locked, with the reason. It catches common mistakes rather than every possible one, so check the manufacturer\'s specifications before you buy.' },
  { q: 'Do I need an account?', a: 'No. It is free with no sign-up. Your builds are saved in your own browser and never sent to us. See the Privacy page for what that means in practice.' },
  { q: 'What happens if I clear my browser data?', a: 'Your saved builds go with it, permanently. We hold no copy, so we cannot restore them. If you want to keep a build, use Share to get a link that encodes it; anyone with that link can open the same build.' },
  { q: 'Was this site made with AI?', a: 'Yes, in large part. AI coding assistants wrote much of the code and helped draft the wording. The parts catalogue, the scoring rules and the performance model were put together and checked by a person. Nothing is generated live: there is no chatbot here, nothing you type is sent to an AI service, and every estimate comes from fixed rules and stored data that ship with the page. The Terms page says the same in more detail.' },
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
            className="text-brass hover:underline"
          >
            CC BY 4.0
          </a>
          . Each has been resized and re-oriented to fit the build, and some have
          unused parts of the mesh hidden, so these are modified versions of the
          originals, not the originals themselves. The case is our own work.
        </p>
        <ul className="space-y-1 text-sm text-muted">
          {MODEL_CREDITS.map((c) => (
            <li key={c.part}>
              <span className="text-ink">{c.part}:</span> &ldquo;{c.title}&rdquo; by {c.author}
              {c.source && (
                <>
                  {' · '}
                  <a href={c.source} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">
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
