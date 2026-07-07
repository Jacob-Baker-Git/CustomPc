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
      <p className="text-slate-400 text-sm mb-6">How the builder and upgrade tools work.</p>
      <div className="space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="group border border-slate-800/70 rounded-sm px-4 py-3">
            <summary className="cursor-pointer text-white font-medium list-none flex justify-between items-center">
              {f.q}
              <span className="text-slate-500 group-open:rotate-180 transition-transform">⌄</span>
            </summary>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}
