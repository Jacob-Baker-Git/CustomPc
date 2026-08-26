import { GLOSSARY, BUYING_TIPS } from '../lib/siteContent'

export default function GlossaryPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Glossary &amp; buying guide</h1>
      <p className="text-muted text-sm mb-6">Plain-English PC terms and how to choose each part.</p>

      <h2 className="text-lg font-semibold text-brass mb-3">Buying tips by part</h2>
      <div className="space-y-2 mb-10">
        {BUYING_TIPS.map((t) => (
          <div key={t.cat} className="border border-line rounded-lg px-4 py-3">
            <p className="text-ink font-medium text-sm">{t.cat}</p>
            <p className="text-sm text-muted mt-1 leading-relaxed">{t.tip}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-brass mb-3">Glossary</h2>
      <dl className="space-y-3">
        {GLOSSARY.map((g) => (
          <div key={g.term}>
            <dt className="text-ink font-medium text-sm">{g.term}</dt>
            <dd className="text-sm text-muted leading-relaxed">{g.def}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
