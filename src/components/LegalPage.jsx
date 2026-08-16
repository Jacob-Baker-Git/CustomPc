import { PRIVACY, TERMS, LAST_UPDATED, OPERATOR } from '../lib/legalContent'

// One renderer for both policy pages — they are the same shape, and keeping
// them identical stops one drifting into a different tone from the other.
function Policy({ title, subtitle, doc }) {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">{title}</h1>
      <p className="text-muted text-sm mb-6">{subtitle}</p>

      <p className="text-sm text-ink leading-relaxed border border-line rounded-lg px-4 py-3 mb-8">
        {doc.intro}
      </p>

      <div className="space-y-8">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-semibold text-copper mb-2">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="text-sm text-muted leading-relaxed mb-2">{p}</p>
            ))}
          </section>
        ))}

        <section>
          <h2 className="text-lg font-semibold text-copper mb-2">Contact</h2>
          <p className="text-sm text-muted leading-relaxed">
            This site is operated by {OPERATOR.name}, based in {OPERATOR.location}.
            {' '}Reach us at <span className="text-ink">{OPERATOR.contactEmail}</span>, or through the{' '}
            <a href="/feedback" className="text-copper hover:underline">feedback form</a>.
          </p>
        </section>
      </div>

      <p className="mt-10 pt-4 border-t border-line text-xs text-faint">
        Last updated {LAST_UPDATED}.
      </p>
    </div>
  )
}

export function PrivacyPage() {
  return (
    <Policy
      title="Privacy"
      subtitle="What this site collects, which is almost nothing."
      doc={PRIVACY}
    />
  )
}

export function TermsPage() {
  return (
    <Policy
      title="Terms & disclaimer"
      subtitle="What this tool does and does not promise."
      doc={TERMS}
    />
  )
}
