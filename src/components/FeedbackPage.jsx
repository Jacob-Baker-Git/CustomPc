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
        <p className="text-slate-400">Your feedback helps make the builder better.</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Feedback</h1>
        <p className="text-slate-400 text-sm">Tell us what works, what doesn't, or what you'd like next.</p>
      </div>

      <div>
        <span className="block text-sm text-slate-300 mb-2">Your rating</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Rate ${n}`}
              onClick={() => setRating(n)}
              className="p-1"
            >
              <Star size={26} className={n <= rating ? 'fill-cyan-400 text-cyan-400' : 'text-slate-600'} />
            </button>
          ))}
        </div>
        {errors.rating && <p className="text-xs text-red-400 mt-1">{errors.rating}</p>}
      </div>

      <div>
        <span className="block text-sm text-slate-300 mb-2">Category</span>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={type === t.id}
              onClick={() => setType(t.id)}
              className={`px-3 py-1.5 rounded-sm border text-sm transition-colors ${type === t.id ? 'border-cyan-400 text-cyan-200 bg-cyan-500/15' : 'border-slate-700/70 text-slate-300 hover:border-cyan-400'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="fb-msg" className="block text-sm text-slate-300 mb-2">Message</label>
        <textarea
          id="fb-msg"
          value={message}
          maxLength={2000}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full bg-slate-950/60 border border-slate-700/70 rounded-sm px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
        />
        <div className="flex justify-between text-xs mt-1">
          <span className="text-red-400">{errors.message}</span>
          <span className="text-slate-500">{message.length}/2000</span>
        </div>
      </div>

      <div>
        <label htmlFor="fb-email" className="block text-sm text-slate-300 mb-2">Email <span className="text-slate-500">(optional, if you want a reply)</span></label>
        <input
          id="fb-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-slate-950/60 border border-slate-700/70 rounded-sm px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
        />
        {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
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

      {status === 'error' && <p className="text-sm text-red-400">Something went wrong sending that. Please try again.</p>}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold px-8 py-3 rounded-sm transition-colors"
      >
        {status === 'sending' ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  )
}
