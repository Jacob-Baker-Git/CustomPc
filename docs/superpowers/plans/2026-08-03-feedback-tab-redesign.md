# Feedback Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the feedback form to the locked v10 layout (category → message → rating → send, even 20px rhythm) and cut friction by removing the math quiz, while keeping the honeypot + timing + DB-cap defences and adding star hover preview and a11y parity.

**Architecture:** One React component (`FeedbackPage.jsx`) is rewritten to a grouped, evenly-spaced layout; the visible math challenge and its state are dropped, and the too-fast rejection moves to a form-level error. `humanCheck.js` then loses the now-unused `makeChallenge`/`checkAnswer` and gets a stale comment fixed. No database change, no new design tokens, `feedback.js` untouched.

**Tech Stack:** React 19, Vite, Tailwind (3.4, semantic Workbench tokens), lucide-react icons, Vitest + Testing Library.

**Design reference:** [docs/superpowers/specs/2026-08-03-feedback-tab-redesign-design.md](../specs/2026-08-03-feedback-tab-redesign-design.md)

**Notes for the implementer:**
- Node is not on the bash PATH on this machine; run test/lint/build from PowerShell, or ensure `C:\Program Files\nodejs` is on PATH. Commands below are shown as `npx …`.
- `docs/superpowers/**` stays **untracked** — never `git add` the spec or this plan. Commit only the code/test files named in each step.
- Existing tokens only. Useful Tailwind classes: `text-ink`, `text-muted`, `text-faint`, `text-bad`, `bg-surface-2`, `border-line`, `border-line-strong`, `text-accent`, `bg-accent`, `bg-accent-soft`, `border-accent`, `fill-accent`.

---

### Task 1: Rewrite `FeedbackPage.jsx` to the v10 design (removes the math quiz)

**Files:**
- Modify: `src/components/FeedbackPage.jsx` (full rewrite)
- Test: `src/tests/FeedbackPage.test.jsx` (full rewrite)

- [ ] **Step 1: Replace the test file with the new behaviour suite**

Overwrite `src/tests/FeedbackPage.test.jsx` with exactly this:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import FeedbackPage from '../components/FeedbackPage'
import * as feedback from '../lib/feedback'

afterEach(() => vi.restoreAllMocks())

// Advances past the 2.5s submit floor without a real wait.
function skipTheFloor() {
  const real = Date.now()
  vi.spyOn(Date, 'now').mockReturnValue(real + 60_000)
}

function fillValid() {
  fireEvent.click(screen.getByRole('button', { name: /rate 5/i }))
  fireEvent.change(screen.getByLabelText(/tell us more/i), { target: { value: 'Really useful' } })
}

it('submits valid feedback and shows a thank-you', async () => {
  const spy = vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  render(<FeedbackPage />)
  fillValid()
  skipTheFloor()
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))
  await waitFor(() => expect(screen.getByText(/thank/i)).toBeInTheDocument())
  expect(spy).toHaveBeenCalledWith({ rating: 5, type: 'idea', message: 'Really useful' })
})

it('blocks submit and shows an error when the message is empty', () => {
  const spy = vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  render(<FeedbackPage />)
  fireEvent.click(screen.getByRole('button', { name: /rate 4/i }))
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))
  expect(screen.getByText(/short message/i)).toBeInTheDocument()
  expect(spy).not.toHaveBeenCalled()
})

it('blocks submit when no rating is chosen', () => {
  const spy = vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  render(<FeedbackPage />)
  fireEvent.change(screen.getByLabelText(/tell us more/i), { target: { value: 'No stars yet' } })
  skipTheFloor()
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))
  expect(screen.getByText(/rating from 1 to 5/i)).toBeInTheDocument()
  expect(spy).not.toHaveBeenCalled()
})

it('reflects the selected category with aria-pressed', () => {
  render(<FeedbackPage />)
  expect(screen.getByRole('button', { name: /idea/i })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: /bug/i }))
  expect(screen.getByRole('button', { name: /bug/i })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /idea/i })).toHaveAttribute('aria-pressed', 'false')
})

// A form completed faster than a human can read it is a script.
it('refuses an instant submit even with valid fields', async () => {
  const spy = vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  render(<FeedbackPage />)
  fillValid()
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))
  expect(await screen.findByText(/take another moment/i)).toBeInTheDocument()
  expect(spy).not.toHaveBeenCalled()
})

// Field problems are named before the bot check.
it('reports an empty message before anything else', () => {
  vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  render(<FeedbackPage />)
  fireEvent.click(screen.getByRole('button', { name: /rate 4/i }))
  skipTheFloor()
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))
  expect(screen.getByText(/short message/i)).toBeInTheDocument()
  expect(screen.queryByText(/take another moment/i)).toBeNull()
})

it('silently succeeds without sending when the honeypot is filled', async () => {
  const spy = vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  const { container } = render(<FeedbackPage />)
  fillValid()
  skipTheFloor()
  const honeypot = container.querySelector('input[aria-hidden="true"]')
  fireEvent.change(honeypot, { target: { value: 'bot corp' } })
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))
  await waitFor(() => expect(screen.getByText(/thank/i)).toBeInTheDocument())
  expect(spy).not.toHaveBeenCalled()
})

it('no longer shows the math challenge', () => {
  render(<FeedbackPage />)
  expect(screen.queryByText(/what is \d+ \+ \d+\?/i)).toBeNull()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/FeedbackPage.test.jsx`
Expected: FAIL — the current component still renders the sum and `getByLabelText(/tell us more/i)` finds no label (today it is "message").

- [ ] **Step 3: Rewrite the component**

Overwrite `src/components/FeedbackPage.jsx` with exactly this:

```jsx
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

  const shown = hoveredRating || rating

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
                className={`flex flex-col items-center gap-1 px-1 py-2 rounded-[9px] border text-xs transition-colors ${on ? 'border-accent text-accent bg-accent-soft' : 'border-line-strong text-muted hover:border-accent'}`}
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
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-accent"
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
              <Star size={30} className={n <= shown ? 'fill-accent text-accent' : 'text-faint'} />
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
        className="self-start bg-accent hover:brightness-110 disabled:opacity-60 text-ink font-semibold px-8 py-3 rounded-lg transition-colors"
      >
        {status === 'sending' ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/tests/FeedbackPage.test.jsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/FeedbackPage.jsx src/tests/FeedbackPage.test.jsx
git commit -m "feat: redesign the feedback form and drop the math quiz"
```

---

### Task 2: Trim `humanCheck.js` and fix the stale rate-limit comment

The component no longer imports `makeChallenge`/`checkAnswer` after Task 1, so they are dead. Remove them and correct the comment that still describes a per-source limit that was dropped on 2026-08-02.

**Files:**
- Modify: `src/lib/humanCheck.js`
- Test: `src/tests/humanCheck.test.js`

- [ ] **Step 1: Replace the test file with the trimmed suite**

Overwrite `src/tests/humanCheck.test.js` with exactly this:

```js
import { describe, it, expect } from 'vitest'
import { submittedTooFast } from '../lib/humanCheck'

describe('submittedTooFast', () => {
  it('flags a submit inside the floor', () => {
    expect(submittedTooFast(1_000_000, 1_000_900)).toBe(true)
  })

  it('allows a submit past the floor', () => {
    expect(submittedTooFast(1_000_000, 1_004_000)).toBe(false)
  })

  it('honours a custom floor', () => {
    expect(submittedTooFast(0, 500, 200)).toBe(false)
    expect(submittedTooFast(0, 100, 200)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it still passes**

Run: `npx vitest run src/tests/humanCheck.test.js`
Expected: PASS (3 tests). `makeChallenge`/`checkAnswer` still exist in the lib at this point, merely unused by the test.

- [ ] **Step 3: Remove the dead functions and fix the comment**

Overwrite `src/lib/humanCheck.js` with exactly this:

```js
// A local, dependency-free speed bump for the feedback form — the site's only
// write path. There is no image CAPTCHA here on purpose: no external service is
// reachable (public/_headers blocks third-party hosts) and the site is static.
//
// This stops naive scripted spam and nothing more. The real defence is the
// Supabase BEFORE INSERT trigger: a 30/min global cap. (There is deliberately
// no per-source limit — the ip_hash column that backed it was dropped on
// 2026-08-02 as part of storing no personal data.)

export const SUBMIT_FLOOR_MS = 2500

// A human cannot read, think and type inside a couple of seconds; a script can.
export function submittedTooFast(mountedAt, now = Date.now(), floorMs = SUBMIT_FLOOR_MS) {
  return now - mountedAt < floorMs
}
```

- [ ] **Step 4: Run the test to verify it still passes**

Run: `npx vitest run src/tests/humanCheck.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/humanCheck.js src/tests/humanCheck.test.js
git commit -m "refactor: drop the unused math-challenge helpers and fix the rate-limit comment"
```

---

### Task 3: Verify the whole suite, lint, and build

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS across all files, with **no** remaining references to `makeChallenge` or `checkAnswer` (a stray import anywhere would fail here). Count should be the prior total minus the 5 removed challenge tests (3 in `humanCheck.test.js`, and the net change in `FeedbackPage.test.jsx`).

- [ ] **Step 2: Lint**

Run: `npx eslint src`
Expected: clean (no unused-import or rules-of-hooks errors).

- [ ] **Step 3: Build**

Run: `npx vite build`
Expected: builds with no errors.

- [ ] **Step 4: Visual check in the dev server (optional but recommended)**

Start the dev server (via the preview tooling / `npm run dev`) and open `#/feedback`. Confirm:
- Order is category boxes → message → rating → Send; gaps read even.
- Category tiles show icons; the selected tile takes the accent border/wash; `aria-pressed` toggles.
- Hovering the stars previews the fill up to the pointer; it reverts on leave; clicking sets the rating.
- The `n/2000` counter sits at the textarea's bottom-right and does not push "Your rating" down.
- No math question is present.

- [ ] **Step 5: Done**

No commit — this task only verifies. If anything failed, fix it under the relevant task above and re-run.

---

## Self-review notes

- **Spec coverage:** layout/order (Task 1 component), even spacing + floating counter (Task 1 markup + comment), category tiles with icons + `aria-pressed` (Task 1), "Tell us more"/"What's this about?" wording (Task 1), required rating with hover/focus preview (Task 1), math quiz removed (Task 1), honeypot + timing kept (Task 1), success/error unchanged (Task 1 keeps the `done`/`error` blocks), `humanCheck` trim + stale comment (Task 2), `feedback.js` untouched (no task modifies it), suite/lint/build (Task 3). All covered.
- **No placeholders:** every code step shows complete file contents.
- **Type/name consistency:** the too-fast path writes `errors.form`, and the JSX renders `errors.form`; the message label id `fb-msg` matches the `htmlFor`; tests target `/tell us more/i`, `/rate N/i`, `/send feedback/i`, all present in the component.
