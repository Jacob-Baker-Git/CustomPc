import { useState, useRef, useEffect } from 'react'
import { Star, Lightbulb, Bug, Heart, MoreHorizontal } from 'lucide-react'
import { validateFeedback, submitFeedback } from '../lib/feedback'
import { submittedTooFast } from '../lib/humanCheck'

const TYPES = [
  { id: 'idea', label: 'Idea', Icon: Lightbulb },
  { id: 'bug', label: 'Bug', Icon: Bug },
  { id: 'praise', label: 'Praise', Icon: Heart },
  { id: 'other', label: 'Other', Icon: MoreHorizontal },
]

export default function FeedbackPage() {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [type, setType] = useState('idea')
  const [message, setMessage] = useState('')
  const [company, setCompany] = useState('') // honeypot
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | done | error
  const mountedAt = useRef(0)
  useEffect(() => { mountedAt.current = Date.now() }, [])

  async function onSubmit(e) {
    e.preventDefault()

    // Field problems first: naming the bot check when the real problem is an
    // empty message helps nobody.
    const v = validateFeedback({ rating, type, message })
    if (!v.ok) { setErrors(v.errors); return }

    // Then the cheap bot signal. The honeypot below stays silent on purpose —
    // telling a bot it was caught only teaches it which field to leave alone.
    if (submittedTooFast(mountedAt.current)) {
      setErrors({ form: 'Take another moment to look that over, then send.' })
      return
    }

    setErrors({})
    if (company) { setStatus('done'); return } // bot filled the honeypot — silently succeed
    setStatus('sending')
    try {
      await submitFeedback({ rating, type, message })
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

  const previewRating = hoveredRating || rating

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-[5px]">
        <h1 className="text-3xl font-bold">Feedback</h1>
        <p className="text-muted text-sm">Tell us what works, what doesn't, or what you'd like next.</p>
      </div>

      <div className="flex flex-col gap-[9px]">
        <span className="text-sm text-muted">What's this about?</span>
        <div className="grid grid-cols-2 min-[460px]:grid-cols-4 gap-[7px]">
          {TYPES.map(({ id, label, Icon }) => {
            const on = type === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setType(id)}
                className={`flex flex-col items-center gap-1 px-1 py-2 rounded-[9px] border text-xs transition-colors ${on ? 'border-gold text-gold bg-gold-soft' : 'border-line-strong text-muted hover:border-copper'}`}
              >
                <Icon size={16} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-[9px]">
        <label htmlFor="fb-msg" className="text-sm text-muted">Tell us more</label>
        <div className="relative">
          <textarea
            id="fb-msg"
            value={message}
            maxLength={2000}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-copper"
          />
          {/* Counter floats below-right: it must never add a row or the even
              spacing between groups breaks (see the spec's spacing rules). */}
          <span className="absolute top-full right-0 mt-1 text-xs text-faint">{message.length}/2000</span>
        </div>
        {errors.message && <p className="text-xs text-bad">{errors.message}</p>}
      </div>

      <div className="flex flex-col gap-[9px]">
        <span className="text-sm text-muted">Your rating</span>
        <div className="flex gap-1.5" onMouseLeave={() => setHoveredRating(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Rate ${n}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoveredRating(n)}
              onFocus={() => setHoveredRating(n)}
              onBlur={() => setHoveredRating(0)}
              className="p-1"
            >
              <Star size={30} className={n <= previewRating ? 'fill-gold text-gold' : 'text-faint'} />
            </button>
          ))}
        </div>
        {errors.rating && <p className="text-xs text-bad">{errors.rating}</p>}
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

      {errors.form && <p className="text-sm text-bad">{errors.form}</p>}
      {status === 'error' && <p className="text-sm text-bad">Something went wrong sending that. Please try again.</p>}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="self-start bg-copper hover:brightness-110 disabled:opacity-60 text-accent-ink font-semibold px-8 py-3 rounded-lg transition-colors"
      >
        {status === 'sending' ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  )
}
