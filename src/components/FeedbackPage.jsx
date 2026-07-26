import { useState } from 'react'
import { Star } from 'lucide-react'
import { validateFeedback, submitFeedback } from '../lib/feedback'

const TYPES = [
  { id: 'idea', label: 'Idea' },
  { id: 'bug', label: 'Bug' },
  { id: 'praise', label: 'Praise' },
  { id: 'other', label: 'Other' },
]

export default function FeedbackPage() {
  const [rating, setRating] = useState(0)
  const [type, setType] = useState('idea')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | done | error

  async function onSubmit(e) {
    e.preventDefault()
    const v = validateFeedback({ rating, type, message, email })
    setErrors(v.errors)
    if (!v.ok) return
    if (company) { setStatus('done'); return } // bot filled the honeypot — silently succeed
    setStatus('sending')
    try {
      await submitFeedback({ rating, type, message, email })
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="text-center py-16">
        <h1 className="text-3xl font-bold mb-3">Thank you! 🙌</h1>
        <p className="text-muted">Your feedback helps make the builder better.</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Feedback</h1>
        <p className="text-muted text-sm">Tell us what works, what doesn't, or what you'd like next.</p>
      </div>

      <div>
        <span className="block text-sm text-muted mb-2">Your rating</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Rate ${n}`}
              onClick={() => setRating(n)}
              className="p-1"
            >
              <Star size={26} className={n <= rating ? 'fill-accent text-accent' : 'text-faint'} />
            </button>
          ))}
        </div>
        {errors.rating && <p className="text-xs text-bad mt-1">{errors.rating}</p>}
      </div>

      <div>
        <span className="block text-sm text-muted mb-2">Category</span>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={type === t.id}
              onClick={() => setType(t.id)}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${type === t.id ? 'border-accent text-accent bg-accent-soft' : 'border-line text-muted hover:border-accent'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="fb-msg" className="block text-sm text-muted mb-2">Message</label>
        <textarea
          id="fb-msg"
          value={message}
          maxLength={2000}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-accent"
        />
        <div className="flex justify-between text-xs mt-1">
          <span className="text-bad">{errors.message}</span>
          <span className="text-muted">{message.length}/2000</span>
        </div>
      </div>

      <div>
        <label htmlFor="fb-email" className="block text-sm text-muted mb-2">Email <span className="text-muted">(optional, if you want a reply)</span></label>
        <input
          id="fb-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-accent"
        />
        {errors.email && <p className="text-xs text-bad mt-1">{errors.email}</p>}
      </div>

      {/* Honeypot: hidden from humans, tempting to bots. */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />

      {status === 'error' && <p className="text-sm text-bad">Something went wrong sending that. Please try again.</p>}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="bg-accent hover:brightness-110 disabled:opacity-60 text-ink font-semibold px-8 py-3 rounded-lg transition-colors"
      >
        {status === 'sending' ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  )
}
