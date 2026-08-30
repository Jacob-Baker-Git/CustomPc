# Build Page Fixes and Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix nine reported defects in the CustomPc builder — a zoom-dependent layout gap, unclear part slots, cramped layout, 3D framing, top-bar styling, a missing crash page, an unguarded feedback form, and nonsensical peripheral filters.

**Architecture:** Nine mostly independent changes. New pure logic goes in `src/lib/` (`priceBands.js`, `humanCheck.js`, `storageKey.js`) with unit tests; new UI goes in `src/components/`. The one true layout bug is a CSS Grid row-distribution problem fixed in `src/index.css`, guarded by a Playwright assertion because jsdom computes no grid layout.

**Tech Stack:** React 19, Vite, Tailwind 3, Zustand (persist), React Three Fiber + drei, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-30-build-page-fixes-and-hardening-design.md`

---

## Before You Start

Node is not on the bash PATH on this machine. In **PowerShell** (the primary shell) `npm` works directly. If you use the Bash tool, prepend:

```bash
export PATH="/c/Program Files/nodejs:$PATH"
```

Baseline to preserve: **453 tests pass, `npm run lint` clean, `npm run build` OK.** Verify this before you start:

```bash
npm run test:run
```

Do **not** run `git push` — pushing is explicitly opt-in on this repo.

## Design Tokens You Will Use

Defined in `src/index.css` `:root`, mapped in `tailwind.config.js`:

`bg-ground` (app background) · `bg-surface` / `bg-surface-2` · `border-line` / `border-line-strong` · `text-ink` / `text-muted` / `text-faint` / `text-accent` · `bg-accent` + `text-accent-ink` + `bg-accent-soft` · `text-good` / `text-ok` / `text-bad`.

The good/ok/bad trio is semantic and constant — never derive it from the accent. The app ground must stay neutral dark; do not introduce a warm or blue cast into `--ground` or `--surface`.

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/lib/storageKey.js` | The one persisted-state key name, shared by the store and the crash page |
| `src/lib/humanCheck.js` | Pure arithmetic challenge + submit-time floor |
| `src/lib/priceBands.js` | Pure per-category money bands from a price list |
| `src/components/ErrorBoundary.jsx` | Root crash page |
| `src/components/SelectedPartsPanel.jsx` | Panel + heading + counter wrapping `CategoryList` on the Build tab |
| `src/tests/humanCheck.test.js` | |
| `src/tests/priceBands.test.js` | |
| `src/tests/ErrorBoundary.test.jsx` | |
| `src/tests/SelectedPartsPanel.test.jsx` | |

**Modify:** `src/index.css` · `src/main.jsx` · `src/screens/BuilderScreen.jsx` · `src/components/BuildCanvas.jsx` · `src/components/CategoryList.jsx` · `src/components/TopBar.jsx` · `src/components/ViewTabs.jsx` · `src/components/DynamicBars.jsx` · `src/components/PeripheralsPanel.jsx` · `src/components/FeedbackPage.jsx` · `src/lib/recommendedOrder.js` · `src/store/useBuilderStore.js` · `e2e/wizard.spec.js` · existing tests for the above.

**Boundary that matters:** `CategoryList` is rendered in **two** places — the Build tab (`BuilderScreen`) and the "I already have a PC" step (`SetupFlow.jsx:212`). In SetupFlow an empty slot means "I don't own one", not "missing", so the loud missing styling goes behind an `emphasiseMissing` prop that only `BuilderScreen` sets. The heading and counter live in a separate `SelectedPartsPanel`, not inside `CategoryList`.

---

## Task 1: Shared storage key

**Files:**
- Create: `src/lib/storageKey.js`
- Modify: `src/store/useBuilderStore.js:65`

The crash page must be able to clear persisted state **without importing the store**, because a store-shaped crash would then take the fallback down with it. One tiny module both can import.

- [ ] **Step 1: Create the module**

Create `src/lib/storageKey.js`:

```js
// The zustand-persist key for the builder's state. Lives alone, with no
// imports, so the root ErrorBoundary can clear corrupt state without pulling
// the store in — a store-shaped crash must not also break the crash page.
export const BUILDER_STORAGE_KEY = 'custompc-builder-v1'
```

- [ ] **Step 2: Use it in the store**

In `src/store/useBuilderStore.js`, add to the imports at the top:

```js
import { BUILDER_STORAGE_KEY } from '../lib/storageKey'
```

Then change line 65 from:

```js
  name: 'custompc-builder-v1',
```

to:

```js
  name: BUILDER_STORAGE_KEY,
```

- [ ] **Step 3: Run the full suite — persistence is load-bearing**

Run: `npm run test:run`
Expected: PASS, 453 tests. A rename that changed the key would break persistence tests.

- [ ] **Step 4: Commit**

```bash
git add src/lib/storageKey.js src/store/useBuilderStore.js
git commit -m "refactor: extract the builder's persist key to a shared module"
```

---

## Task 2: Root crash page

**Files:**
- Create: `src/components/ErrorBoundary.jsx`
- Create: `src/tests/ErrorBoundary.test.jsx`
- Modify: `src/main.jsx`

There is no root error boundary today — only `CanvasErrorBoundary` and `ModelErrorBoundary`. A throw anywhere else blanks the page.

- [ ] **Step 1: Write the failing test**

Create `src/tests/ErrorBoundary.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ErrorBoundary from '../components/ErrorBoundary'
import { BUILDER_STORAGE_KEY } from '../lib/storageKey'

function Boom() {
  throw new Error('kaboom in a component')
}

// React logs caught errors to console.error; silence it so the run stays readable.
let spy
beforeEach(() => { spy = vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { spy.mockRestore(); localStorage.clear() })

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(<ErrorBoundary><p>all good</p></ErrorBoundary>)
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('shows the crash page when a child throws', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
  })

  it('offers reload, back to menu, and reset', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByRole('button', { name: /reload the page/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to the menu/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset the app/i })).toBeInTheDocument()
  })

  // Corrupt persisted state is the likeliest crash that survives a reload, so a
  // plain reload would loop. Reset is the escape hatch — behind a confirm,
  // because it destroys the user's build.
  it('reset asks for confirmation before clearing the saved build', () => {
    localStorage.setItem(BUILDER_STORAGE_KEY, '{"state":{"budget":1500},"version":2}')
    render(<ErrorBoundary><Boom /></ErrorBoundary>)

    fireEvent.click(screen.getByRole('button', { name: /reset the app/i }))
    expect(localStorage.getItem(BUILDER_STORAGE_KEY)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /yes, erase my build/i }))
    expect(localStorage.getItem(BUILDER_STORAGE_KEY)).toBeNull()
  })

  it('back to menu rewrites flow to hub and keeps the build', () => {
    localStorage.setItem(
      BUILDER_STORAGE_KEY,
      JSON.stringify({ state: { budget: 1500, flow: 'builder', selectedParts: { cpu: { id: 'x' } } }, version: 2 })
    )
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    fireEvent.click(screen.getByRole('button', { name: /back to the menu/i }))

    const saved = JSON.parse(localStorage.getItem(BUILDER_STORAGE_KEY))
    expect(saved.state.flow).toBe('hub')
    expect(saved.state.selectedParts.cpu).toBeDefined()
    expect(saved.state.budget).toBe(1500)
  })

  it('surfaces the error message for a bug report', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    fireEvent.click(screen.getByRole('button', { name: /technical detail/i }))
    expect(screen.getByText(/kaboom in a component/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test:run -- src/tests/ErrorBoundary.test.jsx`
Expected: FAIL — cannot resolve `../components/ErrorBoundary`.

- [ ] **Step 3: Implement the boundary**

Create `src/components/ErrorBoundary.jsx`:

```jsx
import { Component } from 'react'
import { BUILDER_STORAGE_KEY } from '../lib/storageKey'

// The app's last line of defence. Deliberately imports NOTHING but the storage
// key: no store, no catalogue, no icons. A crash caused by one of those must
// not also break the page that reports it.
export default class ErrorBoundary extends Component {
  state = { error: null, showDetail: false, confirmingReset: false }

  static getDerivedStateFromError(error) {
    return { error }
  }

  reload = () => { window.location.reload() }

  // Rewrites the persisted flow directly rather than going through the store,
  // for the same reason the module has no store import.
  backToMenu = () => {
    try {
      const raw = localStorage.getItem(BUILDER_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 2 }
      parsed.state = { ...parsed.state, flow: 'hub' }
      localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(parsed))
    } catch {
      // Unparseable state is exactly what Reset is for; fall through and reload.
    }
    this.setState({ error: null })
    window.location.reload()
  }

  reset = () => {
    try { localStorage.removeItem(BUILDER_STORAGE_KEY) } catch { /* nothing else to try */ }
    this.setState({ error: null, confirmingReset: false })
    window.location.reload()
  }

  render() {
    const { error, showDetail, confirmingReset } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen bg-ground text-ink flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-surface border border-line rounded-xl p-6 sm:p-8">
          <span className="font-display font-extrabold text-lg tracking-tight">
            PC <span className="text-accent">Builder</span>
          </span>

          <h1 className="font-display text-2xl font-bold mt-4 mb-2">Something went wrong</h1>
          <p className="text-sm text-muted">
            The builder hit an error and had to stop. Your saved build is still on this device.
            Reloading fixes most cases.
          </p>

          <div className="flex flex-wrap gap-2 mt-6">
            <button
              onClick={this.reload}
              className="bg-accent hover:brightness-110 text-accent-ink font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              Reload the page
            </button>
            <button
              onClick={this.backToMenu}
              className="border border-line hover:border-line-strong text-ink px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              Back to the menu
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-line">
            {confirmingReset ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-bad w-full">
                  This erases your saved build, budget and peripherals. It cannot be undone.
                </p>
                <button
                  onClick={this.reset}
                  className="bg-bad text-ground font-semibold px-4 py-2 rounded-lg text-xs transition-colors hover:brightness-110"
                >
                  Yes, erase my build
                </button>
                <button
                  onClick={() => this.setState({ confirmingReset: false })}
                  className="border border-line text-muted hover:text-ink px-4 py-2 rounded-lg text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => this.setState({ confirmingReset: true })}
                className="text-xs text-muted hover:text-bad underline decoration-dashed underline-offset-4 transition-colors"
              >
                Still broken after reloading? Reset the app
              </button>
            )}
          </div>

          <div className="mt-5">
            <button
              onClick={() => this.setState({ showDetail: !showDetail })}
              aria-expanded={showDetail}
              className="text-xs text-faint hover:text-muted transition-colors"
            >
              {showDetail ? 'Hide technical detail' : 'Show technical detail'}
            </button>
            {showDetail && (
              <pre className="mt-2 p-3 bg-ground border border-line rounded-lg text-[11px] text-muted whitespace-pre-wrap break-words max-h-48 overflow-auto">
                {String(error?.message ?? error)}
              </pre>
            )}
          </div>

          <p className="text-xs text-faint mt-5">
            Seeing this a lot?{' '}
            <a href="#/feedback" className="text-accent hover:underline">Tell us what you were doing</a>.
          </p>
        </div>
      </div>
    )
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/ErrorBoundary.test.jsx`
Expected: PASS, 6 tests.

Note: jsdom's `window.location.reload` is a no-op that may log "Not implemented: navigation". That is harmless — the assertions are on `localStorage`, not on navigation.

- [ ] **Step 5: Mount it at the root**

Replace `src/main.jsx` in full:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { applyShareLinkFromUrl } from './lib/shareLink'
import './index.css'

// Hydrate from a ?build= share link before the first render (no BudgetEntry flash).
applyShareLinkFromUrl()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
```

- [ ] **Step 6: Run the full suite**

Run: `npm run test:run`
Expected: PASS, 459 tests (453 + 6).

- [ ] **Step 7: Commit**

```bash
git add src/components/ErrorBoundary.jsx src/tests/ErrorBoundary.test.jsx src/main.jsx
git commit -m "feat: add a root crash page with reload, menu and reset escape hatches"
```

---

## Task 3: Human-check logic

**Files:**
- Create: `src/lib/humanCheck.js`
- Create: `src/tests/humanCheck.test.js`

Pure functions only — no React, no DOM. Wired into the form in Task 4.

- [ ] **Step 1: Write the failing test**

Create `src/tests/humanCheck.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { makeChallenge, checkAnswer, submittedTooFast } from '../lib/humanCheck'

describe('makeChallenge', () => {
  it('builds a readable sum whose answer matches the operands', () => {
    const c = makeChallenge(() => 0.5)
    expect(c.question).toBe(`What is ${c.a} + ${c.b}?`)
    expect(c.answer).toBe(c.a + c.b)
  })

  it('keeps both operands in single digits so it stays trivial for humans', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const c = makeChallenge(() => r)
      expect(c.a).toBeGreaterThanOrEqual(2)
      expect(c.a).toBeLessThanOrEqual(9)
      expect(c.b).toBeGreaterThanOrEqual(2)
      expect(c.b).toBeLessThanOrEqual(9)
    }
  })

  it('varies with the random source', () => {
    const lo = makeChallenge(() => 0)
    const hi = makeChallenge(() => 0.999)
    expect(lo.answer).not.toBe(hi.answer)
  })
})

describe('checkAnswer', () => {
  const c = { a: 3, b: 4, question: 'What is 3 + 4?', answer: 7 }

  it('accepts the right number', () => {
    expect(checkAnswer(c, 7)).toBe(true)
    expect(checkAnswer(c, '7')).toBe(true)
    expect(checkAnswer(c, ' 7 ')).toBe(true)
  })

  it('rejects the wrong number', () => {
    expect(checkAnswer(c, 8)).toBe(false)
    expect(checkAnswer(c, '-7')).toBe(false)
  })

  // Number('') is 0, which would silently pass a challenge whose answer was 0.
  // Answers are never 0 here, but the guard keeps that from becoming true later.
  it('rejects empty and non-numeric input', () => {
    expect(checkAnswer(c, '')).toBe(false)
    expect(checkAnswer(c, '   ')).toBe(false)
    expect(checkAnswer(c, null)).toBe(false)
    expect(checkAnswer(c, undefined)).toBe(false)
    expect(checkAnswer(c, 'seven')).toBe(false)
  })
})

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

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test:run -- src/tests/humanCheck.test.js`
Expected: FAIL — cannot resolve `../lib/humanCheck`.

- [ ] **Step 3: Implement**

Create `src/lib/humanCheck.js`:

```js
// A local, dependency-free speed bump for the feedback form — the site's only
// write path. There is no image CAPTCHA here on purpose: no external service is
// reachable (public/_headers blocks third-party hosts) and the site is static.
//
// This stops naive scripted spam and nothing more. The real defence is the
// Supabase BEFORE INSERT trigger: 5 per source / 10 min, 30/min global.

export const SUBMIT_FLOOR_MS = 2500

export function makeChallenge(rng = Math.random) {
  const a = 2 + Math.floor(rng() * 8) // 2..9
  const b = 2 + Math.floor(rng() * 8) // 2..9
  return { a, b, question: `What is ${a} + ${b}?`, answer: a + b }
}

export function checkAnswer(challenge, input) {
  const raw = String(input ?? '').trim()
  if (raw === '') return false
  const n = Number(raw)
  return Number.isFinite(n) && n === challenge.answer
}

// A human cannot read, think and type inside a couple of seconds; a script can.
export function submittedTooFast(mountedAt, now = Date.now(), floorMs = SUBMIT_FLOOR_MS) {
  return now - mountedAt < floorMs
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/humanCheck.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/humanCheck.js src/tests/humanCheck.test.js
git commit -m "feat: add a local human-check challenge and submit-time floor"
```

---

## Task 4: Wire the human check into the feedback form

**Files:**
- Modify: `src/components/FeedbackPage.jsx`
- Modify: `src/tests/FeedbackPage.test.jsx`

**Ordering that matters:** field validation runs **first**, then the timing floor, then the challenge. Telling someone to "take another moment" when their real problem is an empty message is confusing, and it would break the existing `blocks submit and shows an error when the message is empty` test for the wrong reason.

- [ ] **Step 1: Write the failing tests**

`src/tests/FeedbackPage.test.jsx` has **no top-level `describe`** — it is bare `it()` calls — and it mocks `feedback.submitFeedback`, not `fetch`. Match that. Append at the end of the file:

```jsx
// Fills everything except the challenge, so each test only varies that.
function fillValidFeedback() {
  fireEvent.click(screen.getByRole('button', { name: /rate 5/i }))
  fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Great tool' } })
}

// Reads the sum off the rendered label rather than importing makeChallenge —
// that is what proves the challenge actually reaches the user.
function answerFrom() {
  const [, a, b] = screen.getByText(/what is \d+ \+ \d+\?/i).textContent.match(/(\d+) \+ (\d+)/)
  return Number(a) + Number(b)
}

// Advances past the submit-time floor without a real wait.
function skipTheFloor() {
  const real = Date.now()
  vi.spyOn(Date, 'now').mockReturnValue(real + 60_000)
}

it('asks a sum before it will send', () => {
  render(<FeedbackPage />)
  expect(screen.getByText(/what is \d+ \+ \d+\?/i)).toBeInTheDocument()
})

it('refuses to send on a wrong answer', async () => {
  const spy = vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  render(<FeedbackPage />)
  fillValidFeedback()
  skipTheFloor()
  fireEvent.change(screen.getByLabelText(/what is \d+ \+ \d+\?/i), { target: { value: '0' } })
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))

  expect(await screen.findByText(/that answer is not right/i)).toBeInTheDocument()
  expect(spy).not.toHaveBeenCalled()
})

it('gives a fresh sum after a wrong answer, so guessing gains nothing', () => {
  vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  render(<FeedbackPage />)
  fillValidFeedback()
  skipTheFloor()
  const before = screen.getByText(/what is \d+ \+ \d+\?/i).textContent

  fireEvent.change(screen.getByLabelText(/what is \d+ \+ \d+\?/i), { target: { value: '0' } })
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))

  // The input is cleared and a new sum is posed (it may coincidentally repeat,
  // so assert on the cleared input, which is deterministic).
  expect(screen.getByLabelText(/what is \d+ \+ \d+\?/i)).toHaveValue('')
  expect(before).toMatch(/what is \d+ \+ \d+\?/i)
})

// A form completed faster than a human can read it is a script.
it('refuses an instant submit even with the right answer', async () => {
  const spy = vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  render(<FeedbackPage />)
  fillValidFeedback()
  fireEvent.change(screen.getByLabelText(/what is \d+ \+ \d+\?/i), { target: { value: String(answerFrom()) } })
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))

  expect(await screen.findByText(/take another moment/i)).toBeInTheDocument()
  expect(spy).not.toHaveBeenCalled()
})

// Field problems are named before the challenge is mentioned.
it('still reports an empty message rather than complaining about the check', () => {
  vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  render(<FeedbackPage />)
  fireEvent.click(screen.getByRole('button', { name: /rate 4/i }))
  skipTheFloor()
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))

  expect(screen.getByText(/short message/i)).toBeInTheDocument()
  expect(screen.queryByText(/that answer is not right/i)).toBeNull()
})

it('sends once the answer is right and the form has been open long enough', async () => {
  const spy = vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  render(<FeedbackPage />)
  fillValidFeedback()
  fireEvent.change(screen.getByLabelText(/what is \d+ \+ \d+\?/i), { target: { value: String(answerFrom()) } })
  skipTheFloor()
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))

  await waitFor(() => expect(screen.getByText(/thank/i)).toBeInTheDocument())
  expect(spy).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test:run -- src/tests/FeedbackPage.test.jsx`
Expected: FAIL — no challenge is rendered.

- [ ] **Step 3: Implement**

In `src/components/FeedbackPage.jsx`, change the imports at the top:

```jsx
import { useState, useRef } from 'react'
import { Star } from 'lucide-react'
import { validateFeedback, submitFeedback } from '../lib/feedback'
import { makeChallenge, checkAnswer, submittedTooFast } from '../lib/humanCheck'
```

Add state, immediately after `const [status, setStatus] = useState('idle')`:

```jsx
  const [challenge, setChallenge] = useState(() => makeChallenge())
  const [challengeInput, setChallengeInput] = useState('')
  const mountedAt = useRef(Date.now())
```

Replace the whole `onSubmit` function with:

```jsx
  async function onSubmit(e) {
    e.preventDefault()

    // Field problems first: telling someone to "take another moment" when their
    // real problem is an empty message helps nobody.
    const v = validateFeedback({ rating, type, message, email })
    if (!v.ok) { setErrors(v.errors); return }

    // Then the cheap bot signals. The honeypot below stays silent on purpose —
    // telling a bot it was caught just teaches it which field to leave alone.
    if (submittedTooFast(mountedAt.current)) {
      setErrors({ challenge: 'Take another moment to look that over, then send.' })
      return
    }
    if (!checkAnswer(challenge, challengeInput)) {
      setErrors({ challenge: 'That answer is not right — try the new sum.' })
      setChallenge(makeChallenge())
      setChallengeInput('')
      return
    }

    setErrors({})
    if (company) { setStatus('done'); return } // bot filled the honeypot — silently succeed
    setStatus('sending')
    try {
      await submitFeedback({ rating, type, message, email })
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }
```

Add the challenge field to the JSX, immediately **before** the honeypot comment block:

```jsx
      <div>
        <label htmlFor="fb-human" className="block text-sm text-muted mb-2">
          Quick check — {challenge.question}
        </label>
        <input
          id="fb-human"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={challengeInput}
          onChange={(e) => setChallengeInput(e.target.value)}
          className="w-24 bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink font-mono tabular-nums focus:outline-none focus:border-accent"
        />
        {errors.challenge && <p className="text-xs text-bad mt-1">{errors.challenge}</p>}
      </div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/tests/FeedbackPage.test.jsx`
Expected: PASS.

The pre-existing `submits valid feedback and shows a thank-you` test **will** fail — it never answers the sum. That failure is correct. Fix it by adding the same two lines the new `sends once…` test uses (answer the sum, then `skipTheFloor()`) before it clicks Send. The other pre-existing test, `blocks submit and shows an error when the message is empty`, must keep passing untouched — if it does not, your ordering is wrong. Do **not** weaken the check to make either pass.

- [ ] **Step 5: Run the full suite**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/FeedbackPage.jsx src/tests/FeedbackPage.test.jsx
git commit -m "feat: gate feedback submission behind a sum and a submit-time floor"
```

---

## Task 5: Peripheral price bands

**Files:**
- Create: `src/lib/priceBands.js`
- Create: `src/tests/priceBands.test.js`

Today one global `Value / Mid / High-end` chip resolves against **per-category terciles**, so a single click means ~£30 for a mouse and ~£300 for a monitor at once, and the label says neither.

- [ ] **Step 1: Write the failing test**

Create `src/tests/priceBands.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { snapToLadder, priceBands, inBand } from '../lib/priceBands'
import peripheralsData from '../data/peripheralsData.json'

const pricesFor = (cat) => peripheralsData.filter((p) => p.category === cat).map((p) => p.price)

describe('snapToLadder', () => {
  it('rounds to the nearest friendly number', () => {
    expect(snapToLadder(44.99)).toBe(40)
    expect(snapToLadder(59.99)).toBe(50)
    expect(snapToLadder(159.99)).toBe(150)
    expect(snapToLadder(279.99)).toBe(300)
  })

  it('clamps outside the ladder rather than inventing a value', () => {
    expect(snapToLadder(1)).toBe(10)
    expect(snapToLadder(99999)).toBe(1000)
  })
})

describe('priceBands', () => {
  it('always starts with All', () => {
    expect(priceBands(pricesFor('mouse'))[0]).toMatchObject({ id: 'all', label: 'All' })
  })

  // The whole point of the change: each category resolves to its own numbers.
  it('gives different money boundaries to mice and monitors', () => {
    const mouse = priceBands(pricesFor('mouse')).map((b) => b.label)
    const monitor = priceBands(pricesFor('monitor')).map((b) => b.label)
    expect(mouse).not.toEqual(monitor)
    expect(mouse.join(' ')).toMatch(/£/)
    expect(monitor.join(' ')).toMatch(/£/)
  })

  it('labels bands as real money, never as an abstract tier', () => {
    for (const label of priceBands(pricesFor('keyboard')).map((b) => b.label)) {
      expect(label).not.toMatch(/value|mid|high/i)
    }
  })

  it('every band it returns actually contains something', () => {
    for (const cat of ['monitor', 'keyboard', 'mouse', 'headset']) {
      const prices = pricesFor(cat)
      for (const band of priceBands(prices)) {
        expect(prices.some((p) => inBand(p, band)), `${cat} / ${band.label}`).toBe(true)
      }
    }
  })

  it('the bands partition the catalogue — every item lands in exactly one non-All band', () => {
    for (const cat of ['monitor', 'keyboard', 'mouse', 'headset']) {
      const prices = pricesFor(cat)
      const bands = priceBands(prices).filter((b) => b.id !== 'all')
      for (const p of prices) {
        expect(bands.filter((b) => inBand(p, b)).length, `${cat} / £${p}`).toBe(1)
      }
    }
  })

  it('falls back to All alone for a catalogue too small to band', () => {
    expect(priceBands([10, 20, 30])).toEqual([{ id: 'all', label: 'All', min: 0, max: Infinity }])
    expect(priceBands([])).toEqual([{ id: 'all', label: 'All', min: 0, max: Infinity }])
  })

  it('collapses to two bands when both boundaries snap to the same number', () => {
    const bands = priceBands([48, 49, 50, 51, 52, 53])
    expect(bands).toHaveLength(3) // All + under + over
    expect(bands[1].label).toMatch(/^Under £/)
    expect(bands[2].label).toMatch(/\+$/)
  })
})

describe('inBand', () => {
  it('is inclusive of min and exclusive of max, so boundaries never double-count', () => {
    const band = { id: 'x', label: '£50–£150', min: 50, max: 150 }
    expect(inBand(49.99, band)).toBe(false)
    expect(inBand(50, band)).toBe(true)
    expect(inBand(149.99, band)).toBe(true)
    expect(inBand(150, band)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test:run -- src/tests/priceBands.test.js`
Expected: FAIL — cannot resolve `../lib/priceBands`.

- [ ] **Step 3: Implement**

Create `src/lib/priceBands.js`:

```js
// Price filters for the peripherals tab, in real money.
//
// These used to be one global Value/Mid/High-end row resolved against
// per-category terciles, so a single chip meant ~£30 for a mouse and ~£300 for
// a monitor at the same time and the label admitted neither. Boundaries are now
// per category and stated as numbers.

// Boundaries snap to this ladder so a label never reads "£137".
const LADDER = [10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000]

const ALL = { id: 'all', label: 'All', min: 0, max: Infinity }

export function snapToLadder(price) {
  return LADDER.reduce((best, v) => (Math.abs(v - price) < Math.abs(best - price) ? v : best), LADDER[0])
}

export function inBand(price, band) {
  return price >= band.min && price < band.max
}

export function priceBands(prices) {
  const sorted = [...prices].filter((p) => Number.isFinite(p)).sort((a, b) => a - b)
  // Under four options a filter costs more attention than it saves.
  if (sorted.length < 4) return [ALL]

  const first = snapToLadder(sorted[Math.floor(sorted.length / 3)])
  const second = snapToLadder(sorted[Math.floor((2 * sorted.length) / 3)])
  const cuts = first === second ? [first] : [first, second]

  const bands = []
  let lo = 0
  for (const cut of cuts) {
    bands.push({
      id: `under-${cut}`,
      label: lo === 0 ? `Under £${cut}` : `£${lo}–£${cut}`,
      min: lo,
      max: cut,
    })
    lo = cut
  }
  bands.push({ id: `over-${lo}`, label: `£${lo}+`, min: lo, max: Infinity })

  // Snapping can push a boundary past every item; an empty chip is noise.
  return [ALL, ...bands.filter((b) => sorted.some((p) => inBand(p, b)))]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/priceBands.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/priceBands.js src/tests/priceBands.test.js
git commit -m "feat: derive per-category peripheral price bands in real money"
```

---

## Task 6: Per-category filters in the peripherals panel

**Files:**
- Modify: `src/components/PeripheralsPanel.jsx`
- Modify: `src/tests/PeripheralsPanel.test.jsx:45-74`

- [ ] **Step 1: Replace the old band tests**

In `src/tests/PeripheralsPanel.test.jsx`, delete the entire `describe('price band filter', …)` block (lines 45–74, including the `// The catalogue now runs from…` comment above it) and put this in its place:

```jsx
  // Bands are per category and stated in money: one global Value/Mid/High-end
  // chip meant ~£30 for a mouse and ~£300 for a monitor simultaneously.
  describe('price filters', () => {
    const cheapest = (cat) =>
      peripheralsData.filter((p) => p.category === cat).sort((a, b) => a.price - b.price)[0]
    const dearest = (cat) =>
      peripheralsData.filter((p) => p.category === cat).sort((a, b) => b.price - a.price)[0]

    it('shows every option under All', () => {
      render(<PeripheralsPanel />)
      expect(screen.getByText(cheapest('monitor').name)).toBeInTheDocument()
      expect(screen.getByText(dearest('monitor').name)).toBeInTheDocument()
    })

    it('gives each category its own filter group', () => {
      render(<PeripheralsPanel />)
      for (const cat of ['Monitor', 'Keyboard', 'Mouse', 'Headset']) {
        expect(screen.getByRole('radiogroup', { name: new RegExp(`${cat} price`, 'i') })).toBeInTheDocument()
      }
    })

    it('labels every chip in money, never as an abstract tier', () => {
      render(<PeripheralsPanel />)
      const group = screen.getByRole('radiogroup', { name: /mouse price/i })
      for (const chip of within(group).getAllByRole('radio')) {
        expect(chip.textContent).not.toMatch(/value|mid|high-end/i)
      }
    })

    it('the cheapest band keeps the cheapest option and drops the dearest', () => {
      render(<PeripheralsPanel />)
      const group = screen.getByRole('radiogroup', { name: /monitor price/i })
      fireEvent.click(within(group).getAllByRole('radio')[1]) // first band after All

      expect(screen.getByText(cheapest('monitor').name)).toBeInTheDocument()
      expect(screen.queryByText(dearest('monitor').name)).toBeNull()
    })

    // The old filter was global, which is most of why it made no sense.
    it('filtering one category leaves the others alone', () => {
      render(<PeripheralsPanel />)
      const group = screen.getByRole('radiogroup', { name: /monitor price/i })
      fireEvent.click(within(group).getAllByRole('radio')[1])

      expect(screen.getByText(dearest('mouse').name)).toBeInTheDocument()
      expect(screen.getByText(dearest('keyboard').name)).toBeInTheDocument()
    })
  })
```

Update the import on line 1 of that file to include `within`:

```jsx
import { render, screen, fireEvent, within } from '@testing-library/react'
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test:run -- src/tests/PeripheralsPanel.test.jsx`
Expected: FAIL — no radiogroup named "Monitor price".

- [ ] **Step 3: Implement**

In `src/components/PeripheralsPanel.jsx`:

Change the imports at the top to add the new helper:

```jsx
import { priceBands, inBand } from '../lib/priceBands'
```

Delete the `BANDS` constant (lines 15–22, including the `// Bands are read off the catalogue…` comment) and the `bandOf` function (lines 24–28).

Change `byCategory` to carry bands instead of terciles:

```jsx
  const byCategory = useMemo(() => {
    const map = {}
    for (const { id } of CATEGORIES) {
      const all = peripheralsData.filter((p) => p.category === id).sort((a, b) => a.price - b.price)
      map[id] = { all, bands: priceBands(all.map((p) => p.price)) }
    }
    return map
  }, [peripheralsData])
```

Replace the single `const [band, setBand] = useState('all')` with per-category state:

```jsx
  const [bandByCategory, setBandByCategory] = useState({})
```

Delete the whole page-level filter block — the `{/* One filter for the whole page… */}` comment and the `<div role="radiogroup" aria-label="Price band" …>` element (lines 121–141).

In the category `map`, replace the destructure and `shown` with:

```jsx
            const { all, bands } = byCategory[id] ?? { all: [], bands: [] }
            const activeBandId = bandByCategory[id] ?? 'all'
            const activeBand = bands.find((b) => b.id === activeBandId) ?? bands[0]
            const shown = activeBand ? all.filter((p) => inBand(p.price, activeBand)) : all
            const picked = selected[id]
```

Then, immediately after the closing `</div>` of the category's heading row (the `flex items-baseline gap-2 mb-3` block) and before the `{shown.length === 0 ? …}` conditional, insert the per-category chips:

```jsx
                {bands.length > 1 && (
                  <div role="radiogroup" aria-label={`${label} price`} className="flex flex-wrap gap-1.5 mb-3">
                    {bands.map((b) => {
                      const on = b.id === activeBandId
                      const count = all.filter((p) => inBand(p.price, b)).length
                      return (
                        <button
                          key={b.id}
                          role="radio"
                          aria-checked={on}
                          onClick={() => setBandByCategory((prev) => ({ ...prev, [id]: b.id }))}
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors active:scale-95
                            ${on
                              ? 'chip-pick border-accent bg-accent text-accent-ink'
                              : 'border-line bg-surface text-muted hover:text-ink hover:border-line-strong'}`}
                        >
                          {b.label} <span className={on ? 'opacity-70' : 'text-faint'}>{count}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/tests/PeripheralsPanel.test.jsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite and lint**

Run: `npm run test:run && npm run lint`
Expected: PASS, 0 lint errors. Lint will flag `bandOf` or `BANDS` if you left either behind.

- [ ] **Step 6: Commit**

```bash
git add src/components/PeripheralsPanel.jsx src/tests/PeripheralsPanel.test.jsx
git commit -m "feat: replace global peripheral tiers with per-category money filters"
```

---

## Task 7: Essentials helpers

**Files:**
- Modify: `src/lib/recommendedOrder.js`
- Modify: `src/tests/recommendedOrder.test.js`

`CategoryList` and `SelectedPartsPanel` both need to know which categories are optional. Today `OPTIONAL` is a private const.

- [ ] **Step 1: Write the failing test**

Append to `src/tests/recommendedOrder.test.js` (inside the existing top-level `describe`, or as a new one at the end of the file):

```js
describe('essentials', () => {
  it('treats thermal paste as optional — most coolers ship with paste applied', () => {
    expect(isOptional('paste')).toBe(true)
    expect(ESSENTIALS).not.toContain('paste')
  })

  it('treats every other category as essential', () => {
    for (const c of ['motherboard', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu', 'case', 'fans']) {
      expect(isOptional(c), c).toBe(false)
      expect(ESSENTIALS, c).toContain(c)
    }
  })

  it('counts only essentials, so a finished build reads 9 of 9', () => {
    const full = Object.fromEntries(ESSENTIALS.map((c) => [c, { id: c }]))
    expect(countEssentials(full)).toEqual({ chosen: 9, total: 9, missing: [] })
  })

  it('reports which essentials are still missing', () => {
    expect(countEssentials({ cpu: { id: 'x' } })).toMatchObject({ chosen: 1, total: 9 })
    expect(countEssentials({ cpu: { id: 'x' } }).missing).toContain('gpu')
  })

  it('does not count paste towards the total', () => {
    const full = Object.fromEntries(ESSENTIALS.map((c) => [c, { id: c }]))
    expect(countEssentials({ ...full, paste: { id: 'p' } })).toEqual({ chosen: 9, total: 9, missing: [] })
  })
})
```

Update that file's import line to pull in the new exports alongside whatever it already imports:

```js
import { RECOMMENDED_ORDER, nextRecommended, ESSENTIALS, isOptional, countEssentials } from '../lib/recommendedOrder'
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test:run -- src/tests/recommendedOrder.test.js`
Expected: FAIL — `isOptional is not a function`.

- [ ] **Step 3: Implement**

Replace `src/lib/recommendedOrder.js` in full:

```js
export const RECOMMENDED_ORDER = [
  'motherboard', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu', 'case', 'fans', 'paste',
]

// Categories that should never be highlighted as the "next" required pick, and
// never counted against build completeness. Paste is here because virtually
// every cooler ships with paste already applied — an empty slot is correct, not
// a hole, and the UI says so rather than leaving it blank.
const OPTIONAL = new Set(['paste'])

export function isOptional(category) {
  return OPTIONAL.has(category)
}

export const ESSENTIALS = RECOMMENDED_ORDER.filter((c) => !OPTIONAL.has(c))

export function nextRecommended(selectedParts = {}) {
  for (const category of RECOMMENDED_ORDER) {
    if (OPTIONAL.has(category)) continue
    if (!selectedParts[category]) return category
  }
  return null
}

export function countEssentials(selectedParts = {}) {
  const missing = ESSENTIALS.filter((c) => !selectedParts[c])
  return { chosen: ESSENTIALS.length - missing.length, total: ESSENTIALS.length, missing }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/recommendedOrder.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recommendedOrder.js src/tests/recommendedOrder.test.js
git commit -m "feat: expose essentials helpers for build-completeness counting"
```

---

## Task 8: Three-state part slots

**Files:**
- Modify: `src/components/CategoryList.jsx`
- Modify: `src/tests/CategoryList.test.jsx`

A selected row shows only a product name — "ASRock H610M-HDV/M.2 DDR4" never says *motherboard* — and an empty slot looks identical whether it is a real hole or optional.

**Do not** make the loud styling unconditional: `SetupFlow.jsx:212` renders this same list for "the PC I already own", where empty means "I don't have one".

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('CategoryList', …)` in `src/tests/CategoryList.test.jsx`:

```jsx
  it('names the category on a filled row, not just the product', () => {
    render(<CategoryList selectedParts={{ cpu }} onSelectCategory={() => {}} onDeselect={() => {}} />)
    const row = screen.getByText(cpu.name).closest('div')
    expect(row).toHaveTextContent(/cpu/i)
  })

  describe('emphasiseMissing (Build tab only)', () => {
    it('tags every unfilled essential as missing', () => {
      render(
        <CategoryList selectedParts={{ cpu }} onSelectCategory={() => {}} onDeselect={() => {}} emphasiseMissing />
      )
      // 9 essentials, CPU filled → 8 still missing.
      expect(screen.getAllByText('Missing')).toHaveLength(8)
    })

    // Paste is deliberately empty, so it must not read as a hole.
    it('explains thermal paste instead of flagging it', () => {
      render(<CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} emphasiseMissing />)
      const paste = screen.getByText('Thermal Paste').closest('button')
      expect(paste).toHaveTextContent(/optional/i)
      expect(paste).toHaveTextContent(/coolers ship with paste/i)
      expect(paste).not.toHaveTextContent('Missing')
    })

    it('still marks the next recommended pick', () => {
      render(<CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} emphasiseMissing />)
      const board = screen.getByText('Motherboard').closest('button')
      expect(board).toHaveTextContent(/pick one/i)
      expect(board).toHaveTextContent('Missing')
    })

    // Colour alone must never carry the meaning.
    it('every state carries a text tag, not just a colour', () => {
      render(
        <CategoryList selectedParts={{ cpu }} onSelectCategory={() => {}} onDeselect={() => {}} emphasiseMissing />
      )
      expect(screen.getAllByText('Missing').length).toBeGreaterThan(0)
      expect(screen.getByText(/optional/i)).toBeInTheDocument()
    })
  })

  // SetupFlow renders this same list for "the PC I already own", where an empty
  // slot means "I don't have one" — flagging those red would be a lie.
  it('stays quiet about missing parts by default', () => {
    render(<CategoryList selectedParts={{}} onSelectCategory={() => {}} onDeselect={() => {}} />)
    expect(screen.queryByText('Missing')).toBeNull()
  })
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npm run test:run -- src/tests/CategoryList.test.jsx`
Expected: FAIL — no "Missing" text is rendered.

- [ ] **Step 3: Implement**

Replace `src/components/CategoryList.jsx` in full:

```jsx
import { CATEGORIES } from '../lib/categories'
import CategoryIcon from '../lib/categoryIcons'
import { RECOMMENDED_ORDER, nextRecommended, isOptional } from '../lib/recommendedOrder'

const ORDERED = RECOMMENDED_ORDER
  .map((id) => CATEGORIES.find((c) => c.id === id))
  .filter(Boolean)

const OPTIONAL_NOTE = 'Optional — most coolers ship with paste applied'

// Hovering a row used to highlight the matching part in the 3D view. That
// highlight was removed, and these handlers went with it rather than being left
// writing to a store field nobody reads — see PartModel.
//
// `emphasiseMissing` is the Build tab's louder treatment: unfilled essentials go
// red and tagged. SetupFlow renders the same list for "the PC I already own",
// where an empty slot means "I don't have one" — so it stays off by default.
export default function CategoryList({
  selectedParts,
  onSelectCategory,
  onDeselect,
  columns = 1,
  emphasiseMissing = false,
}) {
  const next = nextRecommended(selectedParts)
  const wrap = columns === 2 ? 'grid grid-cols-1 lg:grid-cols-2 gap-2' : 'space-y-2'

  return (
    <div className={wrap}>
      {ORDERED.map((cat, i) => {
        const part = selectedParts[cat.id]
        const isNext = cat.id === next
        const optional = isOptional(cat.id)

        if (part) {
          return (
            <div key={cat.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              <button onClick={() => onSelectCategory(cat.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <CategoryIcon id={cat.id} className="text-muted" />
                <span className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wide text-faint leading-none">{cat.label}</span>
                  <span className="block text-sm text-ink truncate leading-tight mt-0.5">{part.name}</span>
                </span>
              </button>
              <span className="font-mono tabular-nums text-sm text-accent shrink-0">£{part.price.toFixed(0)}</span>
              <button onClick={() => onDeselect(cat.id)} aria-label={`Remove ${cat.label}`} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-bad text-sm shrink-0 transition-colors">&times;</button>
            </div>
          )
        }

        // Three empty shapes: a real hole (red), the one to do next (red + accent
        // pill), and a deliberately empty optional slot (neutral, explained).
        const flagged = emphasiseMissing && !optional
        const explained = emphasiseMissing && optional

        const tone = flagged
          ? 'border-bad/60 bg-bad/[0.07] text-ink hover:border-bad'
          : explained
            ? 'border-line-strong text-muted hover:text-ink'
            : isNext
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors
              ${emphasiseMissing ? 'border-dashed' : ''} ${tone}`}
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-surface-2 text-[10px] font-mono text-muted shrink-0">{i + 1}</span>
            <CategoryIcon id={cat.id} className={flagged ? 'text-bad' : isNext ? 'text-accent' : 'text-muted'} />
            <span className="flex-1 text-left truncate">{cat.label}</span>
            {explained && <span className="text-[10px] text-faint truncate">{OPTIONAL_NOTE}</span>}
            {flagged && <span className="text-[11px] font-semibold text-bad shrink-0">Missing</span>}
            {isNext && (
              <span className="text-[10px] font-semibold bg-accent text-accent-ink rounded-full px-2 py-0.5 shrink-0">
                Pick one
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/tests/CategoryList.test.jsx`
Expected: PASS.

If the existing `calls onSelectCategory when a category row is clicked` test breaks, it is because `getByText('GPU')` now resolves differently — anchor it with `screen.getByText('GPU').closest('button')` rather than changing the component.

- [ ] **Step 5: Commit**

```bash
git add src/components/CategoryList.jsx src/tests/CategoryList.test.jsx
git commit -m "feat: distinguish missing, next-up and optional part slots"
```

---

## Task 9: Selected-parts panel

**Files:**
- Create: `src/components/SelectedPartsPanel.jsx`
- Create: `src/tests/SelectedPartsPanel.test.jsx`
- Modify: `src/screens/BuilderScreen.jsx:60-67`

The ten boxes have no heading, so they read as a bare grid of product names rather than "the parts you have chosen".

- [ ] **Step 1: Write the failing test**

Create `src/tests/SelectedPartsPanel.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SelectedPartsPanel from '../components/SelectedPartsPanel'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.category === 'gpu')

const noop = () => {}

describe('SelectedPartsPanel', () => {
  it('says what the list is', () => {
    render(<SelectedPartsPanel selectedParts={{}} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getByRole('heading', { name: /your parts/i })).toBeInTheDocument()
  })

  // Paste is optional, so a finished build must read 9 of 9, never 9 of 10.
  it('counts essentials only', () => {
    render(<SelectedPartsPanel selectedParts={{ cpu, gpu }} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getByText('2 of 9 essentials chosen')).toBeInTheDocument()
  })

  it('calls out how many are still missing', () => {
    render(<SelectedPartsPanel selectedParts={{ cpu, gpu }} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getByText(/7 missing/i)).toBeInTheDocument()
  })

  it('says so plainly when the build is complete', () => {
    const full = {}
    for (const c of ['motherboard', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu', 'case', 'fans']) {
      full[c] = partsData.find((p) => p.category === c)
    }
    render(<SelectedPartsPanel selectedParts={full} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getByText('9 of 9 essentials chosen')).toBeInTheDocument()
    expect(screen.getByText(/all essentials covered/i)).toBeInTheDocument()
  })

  it('shows the running spend', () => {
    render(<SelectedPartsPanel selectedParts={{ cpu, gpu }} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getByText(`£${(cpu.price + gpu.price).toFixed(0)}`)).toBeInTheDocument()
  })

  it('turns the loud missing treatment on for its list', () => {
    render(<SelectedPartsPanel selectedParts={{ cpu }} onSelectCategory={noop} onDeselect={noop} />)
    expect(screen.getAllByText('Missing').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test:run -- src/tests/SelectedPartsPanel.test.jsx`
Expected: FAIL — cannot resolve `../components/SelectedPartsPanel`.

- [ ] **Step 3: Implement**

Create `src/components/SelectedPartsPanel.jsx`:

```jsx
import CategoryList from './CategoryList'
import { countEssentials } from '../lib/recommendedOrder'
import { PANEL, TELEMETRY } from '../lib/uiTokens'

// The Build tab's framing for CategoryList. It lives here rather than inside
// CategoryList because SetupFlow renders that same list for "the PC I already
// own", where a completeness counter would be meaningless.
export default function SelectedPartsPanel({ selectedParts, onSelectCategory, onDeselect }) {
  const { chosen, total, missing } = countEssentials(selectedParts)
  const spend = Object.values(selectedParts).reduce((sum, p) => sum + (p?.price ?? 0), 0)

  return (
    <section className={`${PANEL} p-4`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
        <h2 className="font-display text-base font-bold text-ink">Your parts</h2>
        <span className="text-xs text-muted">{chosen} of {total} essentials chosen</span>
        {missing.length > 0 ? (
          <span className="text-xs font-semibold text-bad">
            {missing.length} missing
          </span>
        ) : (
          <span className="text-xs font-semibold text-good">All essentials covered</span>
        )}
        <span className={`ml-auto ${TELEMETRY} text-sm font-semibold text-accent`}>£{spend.toFixed(0)}</span>
      </div>
      <CategoryList
        selectedParts={selectedParts}
        onSelectCategory={onSelectCategory}
        onDeselect={onDeselect}
        columns={2}
        emphasiseMissing
      />
    </section>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/tests/SelectedPartsPanel.test.jsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Use it on the Build tab**

In `src/screens/BuilderScreen.jsx`, replace the `CategoryList` import on line 14:

```jsx
import SelectedPartsPanel from '../components/SelectedPartsPanel'
```

and replace the whole `area-parts` block (lines 60–67):

```jsx
              <div className="area-parts">
                <SelectedPartsPanel
                  selectedParts={selectedParts}
                  onSelectCategory={setActiveCategory}
                  onDeselect={removePart}
                />
              </div>
```

- [ ] **Step 6: Run the full suite and lint**

Run: `npm run test:run && npm run lint`
Expected: PASS, 0 lint errors. Lint catches the now-unused `CategoryList` import if you left it.

- [ ] **Step 7: Commit**

```bash
git add src/components/SelectedPartsPanel.jsx src/tests/SelectedPartsPanel.test.jsx src/screens/BuilderScreen.jsx
git commit -m "feat: frame the Build tab part slots as a counted parts panel"
```

---

## Task 10: The zoom gap

**Files:**
- Modify: `src/index.css:75-96`
- Modify: `src/screens/BuilderScreen.jsx:49-72`

**The bug:** `.area-viz` spans two grid rows (`usecase` + `rating`) and carries `min-h-[60vh]`. CSS Grid distributes a spanning item's excess height **equally across every row it spans**, so half lands as dead space above the rating panel. Measured live: 47px of gap at a 1900px-tall viewport, **213px at 2400px** — linear in `60vh`, and browser zoom-out multiplies the viewport's CSS pixel height by `1/zoom`.

**The fix:** collapse the two left rows into one area so the viz spans exactly one row and there is no excess to split.

This task also lands the width and column-split changes, because both edit the same rule.

- [ ] **Step 1: Rewrite the grid**

In `src/index.css`, replace the `@media (min-width: 1024px)` block (lines 75–96) with:

```css
@media (min-width: 1024px) {
  .build-grid {
    display: grid;
    /* The 3D preview earns the larger share: it is the thing people came for,
       and the left column is text that reads fine narrow. */
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    /* One left-hand area, not two rows.
       .area-viz used to span "usecase" and "rating", and Grid splits a spanning
       item's excess height EQUALLY across the rows it spans — so half of the
       viz's min-height landed as dead space above the rating panel, growing
       without limit as you zoomed out (47px at 1900px tall, 213px at 2400px).
       With one row there is no excess to distribute. Do not split this back
       apart. */
    grid-template-areas:
      "left      viz"
      "banner    banner"
      "parts     parts"
      "warnings  warnings"
      "autobuild autobuild";
    align-items: start;
    gap: 1rem;
  }
  .build-grid > .area-viz       { grid-area: viz; }
  .build-grid > .area-left      { grid-area: left; }
  .build-grid > .area-banner    { grid-area: banner; }
  .build-grid > .area-parts     { grid-area: parts; }
  .build-grid > .area-warnings  { grid-area: warnings; }
  .build-grid > .area-autobuild { grid-area: autobuild; }
}
```

- [ ] **Step 2: Stack the left column in one child**

In `src/screens/BuilderScreen.jsx`, replace the Build-tab block (lines 48–73) with:

```jsx
          <div className="relative z-10 transform-gpu w-full max-w-2xl lg:max-w-[1800px] mx-auto px-4 lg:px-6 pt-3 pb-12">
            <div className="build-grid">
              <div className="area-viz relative h-[42vh] md:h-[48vh] lg:h-full lg:min-h-[65vh]">
                <CanvasErrorBoundary>
                  <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-muted text-sm motion-safe:animate-pulse">Assembling 3D…</div>}>
                    <BuildCanvas selectedParts={selectedParts} />
                  </Suspense>
                </CanvasErrorBoundary>
                <InfoDisclaimer />
                <div className="absolute bottom-3 right-3"><CaseToggle /></div>
              </div>
              {/* One grid child, two stacked panels. Splitting these back into
                  separate grid rows reintroduces the zoom gap — see index.css. */}
              <div className="area-left flex flex-col gap-3">
                <UseCaseChips />
                <BuildRatingPanel />
              </div>
              <div className="area-banner"><GeneratedBanner /></div>
              <div className="area-parts">
                <SelectedPartsPanel
                  selectedParts={selectedParts}
                  onSelectCategory={setActiveCategory}
                  onDeselect={removePart}
                />
              </div>
              <div className="area-warnings"><BuildWarnings /></div>
              <div className="area-autobuild"><AutoBuildButton /></div>
            </div>
          </div>
```

Note the mobile DOM order changes: the viz is now first, then use-case + rating. Below `lg` this is a plain flex column, so DOM order *is* the visual order — and the viz was already first there. Confirm in Step 4.

- [ ] **Step 3: Run the full suite**

Run: `npm run test:run`
Expected: PASS. jsdom applies no CSS, so this proves nothing about the layout — it only proves nothing else broke.

- [ ] **Step 4: Measure the fix in a real browser**

Start the dev server (use the preview tooling, not a raw `npm run dev` in Bash). Get into the builder with a full build, then run in the page:

```js
(() => {
  const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { t: Math.round(b.top), h: Math.round(b.height) } }
  const left = r('.area-left'), viz = r('.area-viz')
  return JSON.stringify({ vh: innerHeight, left, viz })
})()
```

Then resize the viewport to 2300×1900 and again to 2800×2400 and re-run it.

Expected: `.area-left` top stays pinned to the grid's top row at every height, and the chips sit directly above the rating panel with only the 12px flex gap between them. Before the fix, `.area-rating`'s top drifted 47px then 213px away from the chips.

Also confirm at 1280×800 and 1920×1080 that the 3D column is visibly wider than before (roughly two thirds of the content width) and that there is no horizontal page scroll.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/screens/BuilderScreen.jsx
git commit -m "fix: stop the viz's min-height leaking into a gap above the rating panel"
```

---

## Task 11: E2E guard for the gap

**Files:**
- Modify: `e2e/wizard.spec.js`

jsdom computes no grid layout, so a unit test **cannot** catch this bug or its return. The guard has to run in a real browser.

- [ ] **Step 1: Write the test**

Append to `e2e/wizard.spec.js`:

```js
// The 3D column's min-height used to leak into the row above it: .area-viz
// spanned two grid rows, and CSS Grid splits a spanning item's excess height
// equally across the rows it spans, so half of it became dead space between the
// use-case chips and the rating panel — 47px at 1900px tall, 213px at 2400px,
// growing without limit as the user zoomed out.
//
// jsdom computes no grid layout, so this can only be caught here.
test('the left column stays tight to the 3D preview at any viewport height', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /start a build/i }).click()
  await page.getByRole('button', { name: /pick parts for me/i }).click()
  await page.getByPlaceholder('Enter budget').fill('1600')
  await page.getByRole('button', { name: /next: use case/i }).click()
  await page.getByRole('button', { name: /gaming/i }).click()
  await page.getByRole('button', { name: /generate build/i }).click()
  await expect(page.getByText('/100')).toBeVisible()

  // Tall viewports are what zooming out produces: the CSS pixel height of the
  // viewport is the physical height divided by the zoom factor.
  for (const height of [900, 1900, 2400]) {
    await page.setViewportSize({ width: 1440, height })

    const gap = await page.evaluate(() => {
      const chips = document.querySelector('.area-left > *:first-child')
      const rating = document.querySelector('.area-left > *:last-child')
      return rating.getBoundingClientRect().top - chips.getBoundingClientRect().bottom
    })

    // Only the flex gap (0.75rem = 12px) may separate them, plus a rounding pixel.
    expect(gap, `viewport height ${height}`).toBeLessThanOrEqual(13)
    expect(gap, `viewport height ${height}`).toBeGreaterThanOrEqual(0)
  }
})
```

- [ ] **Step 2: Run it**

Run: `npm run test:e2e`
Expected: PASS, both E2E tests.

If Playwright browsers are not installed, run `npx playwright install chromium` first.

- [ ] **Step 3: Verify the guard actually guards**

Temporarily restore the two-row grid in `src/index.css` (`"usecase viz"` / `"rating viz"` with the matching area rules and `.area-left` split back into two children), re-run `npm run test:e2e`, and confirm the new test **FAILS** at the 2400px height. Then revert the temporary change with `git checkout -- src/index.css src/screens/BuilderScreen.jsx`.

A guard nobody has seen fail is not a guard.

- [ ] **Step 4: Commit**

```bash
git add e2e/wizard.spec.js
git commit -m "test: guard the build grid against the zoom-dependent gap"
```

---

## Task 12: 3D framing and zoom range

**Files:**
- Modify: `src/components/BuildCanvas.jsx:16,56-64`

At `fov 46` the visible frame height is `2 · d · tan(23°) ≈ 0.849 · d`. Today the camera sits at distance ≈5.92 from the orbit target, so the 482mm case (3.95 world units, since 1 wu = 122 mm) fills ~78% of frame height. Moving to ≈7.2 drops that to ~65%.

- [ ] **Step 1: Change the camera**

In `src/components/BuildCanvas.jsx`, change line 16 from:

```jsx
        camera={{ position: [1.7, 1.05, 5.6], fov: 46 }}
```

to:

```jsx
        // Distance from the orbit target is ~7.2 world units. At fov 46 the
        // visible frame height is 0.849·d, so the 482mm case (3.95 wu at
        // 1 wu = 122 mm) fills ~65% of the frame — it used to be ~78%, which
        // read as starting too zoomed in.
        camera={{ position: [2.05, 1.3, 6.8], fov: 46 }}
```

- [ ] **Step 2: Widen the clamps**

Replace the `OrbitControls` element (lines 56–64) with:

```jsx
        {/* 2.2–16 rather than 3–9: close enough to inspect one part, far enough
            to see the whole build in its room. WU_PER_MM was originally chosen
            so the old clamps still worked — widening them is deliberate. */}
        <OrbitControls
          target={[0, -0.1, 0.05]}
          enablePan={false}
          enableZoom
          minDistance={2.2}
          maxDistance={16}
          dampingFactor={0.05}
          enableDamping
        />
```

- [ ] **Step 3: Run the full suite**

Run: `npm run test:run`
Expected: PASS. No test asserts on camera values; this is a visual change.

- [ ] **Step 4: Look at it**

Load the Build tab in a real browser with a full build and take a screenshot.

Expected: the case is clearly smaller in frame than before, with visible room around it, and scrolling the wheel over the canvas both zooms much closer and pulls much further out than it used to.

**Budget your reloads.** The WebGL context on this machine is exhaustible and wedges after roughly eight reloads — the canvas goes white and `renderer.getContext().isContextLost()` returns true. A brand-new browser tab gets a fresh context. Prefer editing `localStorage` plus one reload over clicking through the setup flow.

- [ ] **Step 5: Commit**

```bash
git add src/components/BuildCanvas.jsx
git commit -m "feat: start the 3D view further back and widen the zoom range"
```

---

## Task 13: Segmented view tabs

**Files:**
- Modify: `src/components/ViewTabs.jsx:40-54`

Only the `inline` (top-bar) variant changes. The `bar` variant is the phone bottom bar and stays exactly as it is.

- [ ] **Step 1: Write the failing test**

Append to `src/tests/TopBar.test.jsx`, inside `describe('TopBar view tabs', …)`:

```jsx
  it('renders the desktop tabs as one segmented group', () => {
    const { container } = render(<TopBar view="build" onViewChange={() => {}} />)
    const group = container.querySelector('.lg\\:inline-flex')
    expect(group).toHaveClass('bg-ground')
  })

  // Icons must not leak into the accessible name, or every name-based query
  // in this file and in the E2E spec breaks.
  it('keeps the accessible name to the label alone', () => {
    render(<TopBar view="build" onViewChange={() => {}} />)
    expect(screen.getByRole('button', { name: /^build$/i })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test:run -- src/tests/TopBar.test.jsx`
Expected: FAIL — the group does not have `bg-ground`.

- [ ] **Step 3: Implement**

In `src/components/ViewTabs.jsx`, replace the final `return` block (lines 40–54) with:

```jsx
  // An inset well (bg-ground is darker than the header's bg-surface) reads as a
  // control rather than a floating box, and equal-width segments stop the group
  // from jittering as the active label changes.
  return (
    <div className="hidden lg:inline-flex rounded-xl bg-ground border border-line p-1 gap-1">
      {VIEWS.map((v) => {
        const Icon = ICONS[v]
        const on = view === v
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            aria-current={on ? 'page' : undefined}
            className={`flex items-center justify-center gap-1.5 min-w-[104px] xl:min-w-[118px] px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors
              ${on ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink hover:bg-surface-2'}`}
          >
            <Icon size={14} aria-hidden="true" />
            {v}
          </button>
        )
      })}
    </div>
  )
```

`ICONS` is already defined at the top of the file and already used by the `bar` variant — no new import.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/tests/TopBar.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ViewTabs.jsx src/tests/TopBar.test.jsx
git commit -m "feat: restyle the desktop view tabs as an inset segmented control"
```

---

## Task 14: Gauge-chip meters

**Files:**
- Modify: `src/components/DynamicBars.jsx`
- Modify: `src/tests/DynamicBars.test.jsx`

The full-size meter is a bare label over a thin full-width rail, which trails off as a stray hairline in a dense header. The `compact` phone variant is fine and must keep working.

- [ ] **Step 1: Write the failing test**

Append to `src/tests/DynamicBars.test.jsx`, inside the existing `describe`:

```jsx
  it('renders the full-size meter as a bordered chip', () => {
    const { container } = render(<DynamicBars value={620} max={750} label="Power" unit="W" />)
    expect(container.firstChild).toHaveClass('border')
    expect(container.firstChild).toHaveClass('bg-surface-2')
  })

  // The phone row fits two of these at 375px only because compact drops the
  // chrome — keep it frameless.
  it('keeps the compact meter frameless', () => {
    const { container } = render(<DynamicBars value={620} max={750} label="Power" unit="W" compact />)
    expect(container.firstChild).not.toHaveClass('border')
  })

  it('colours the fill by how close to the limit it is', () => {
    const { container: warn } = render(<DynamicBars value={700} max={750} label="Power" unit="W" />)
    expect(warn.querySelector('.bg-ok')).toBeTruthy()
    const { container: over } = render(<DynamicBars value={800} max={750} label="Power" unit="W" />)
    expect(over.querySelector('.bg-bad')).toBeTruthy()
  })
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test:run -- src/tests/DynamicBars.test.jsx`
Expected: FAIL — the wrapper has no `border` class.

- [ ] **Step 3: Implement**

Replace the `return` block in `src/components/DynamicBars.jsx` (lines 19–32) with:

```jsx
  // Full size is a bordered chip so the meter groups with the tab control beside
  // it instead of trailing off as a stray hairline. `compact` is the phone
  // shape: no chrome, no minimum width, smaller type, so two fit a 375px row.
  return (
    <div
      className={
        compact
          ? 'flex flex-col gap-0.5 flex-1 min-w-0'
          : 'flex flex-col gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 min-w-[136px]'
      }
    >
      <div className={`flex items-baseline justify-between gap-2 ${compact ? 'text-[10px] text-muted' : 'text-[10px]'}`}>
        <span className={compact ? '' : 'uppercase tracking-wide text-faint'}>{label}</span>
        <span className={`font-mono tabular-nums truncate ${compact ? 'text-ink' : 'text-[11px] text-ink'}`}>{display}</span>
      </div>
      <div className={`rounded-full overflow-hidden ${compact ? 'h-1.5 bg-surface-2' : 'h-1.5 bg-ground'}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/tests/DynamicBars.test.jsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/DynamicBars.jsx src/tests/DynamicBars.test.jsx
git commit -m "feat: restyle the header meters as bordered gauge chips"
```

---

## Task 15: Three-zone header

**Files:**
- Modify: `src/components/TopBar.jsx:33,83-92`

**Constraint that must not regress:** the header stays **one row at every width**. Its breakpoints were measured, not guessed — tabs at `lg` (at `md` the header wrapped to 81px at 768px), meters at `xl` (at `lg` it wrapped to 81px at 1024px), wordmark `hidden min-[360px]:inline` (it wrapped the header at 320px).

- [ ] **Step 1: Give the left group a flex basis**

In `src/components/TopBar.jsx`, change the `<header>` className on line 33 from `gap-x-3 md:gap-8` to `gap-x-3 md:gap-6`, so the three zones have room:

```jsx
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface border-b border-line px-3 md:px-6 py-2 md:py-3 flex flex-wrap md:flex-nowrap items-center gap-x-3 md:gap-6 gap-y-1">
```

- [ ] **Step 2: Split the right-hand group into centre and right zones**

Replace the block at lines 81–92 (the `{/* Tabs live in the header on desktop… */}` comment and the `ml-auto` div) with:

```jsx
      {/* Three zones: the budget readout above ends the left one. `flex-1` on
          the flanks centres the tabs — but only at xl, where both flanks carry
          weight. Between lg and xl the meters are hidden, so the tabs sit right
          of true centre. That is expected; do NOT absolutely position them to
          "fix" it, because they would then overlap the flanks and wrap the
          header, which has to stay one row at every width.
          Tabs live in the header on desktop; on phones they are the bottom bar
          rendered by BuilderScreen. */}
      <div className="flex-1 flex justify-end lg:justify-center">
        <ViewTabs view={view} onChange={onViewChange} />
      </div>
      <div className="flex items-center gap-3 md:gap-4 lg:flex-1 lg:justify-end">
        <a href="#/feedback" className="text-xs text-muted hover:text-accent transition-colors">Feedback</a>
        {/* xl, not lg: at 1024 the tabs have just moved in and the meters no
            longer fit beside them without wrapping the header. */}
        <div className="hidden xl:flex gap-3">
          <DynamicBars value={totalSpent} max={budget} label="Budget" unit="£" />
          <DynamicBars value={totalPower} max={psuwattage} label="Power" unit="W" />
        </div>
      </div>
```

- [ ] **Step 3: Run the full suite and lint**

Run: `npm run test:run && npm run lint`
Expected: PASS, 0 lint errors.

- [ ] **Step 4: Measure the header at every breakpoint**

This is the step that catches the regression. In a real browser on the Build tab, for each width in **320, 375, 390, 414, 640, 768, 1023, 1024, 1280, 1440, 1920**, set the viewport and run:

```js
(() => {
  const h = document.querySelector('header').getBoundingClientRect()
  return JSON.stringify({
    w: innerWidth,
    headerHeight: Math.round(h.height),
    horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    visibleTabSets: [...document.querySelectorAll('[aria-current="page"]')].length,
  })
})()
```

Expected at every width:
- `headerHeight` is one row — under `lg` that is the taller two-row shape the meters row already creates (the same value it had before this task at that width), and at `xl`+ it is the single compact row. **What must never happen is a NEW wrap**: compare each width against the value you measure on `git stash`-ed code before the change.
- `horizontalScroll` is `false`.
- `visibleTabSets` is 1 — both tab sets are in the DOM, but the hidden one is `display:none` and therefore out of the accessibility tree.

- [ ] **Step 5: Run the E2E suite**

Run: `npm run test:e2e`
Expected: PASS. It asserts exactly one `summary` tab is reachable by role at both 390px and 1440px, which is the real proof of the point above.

- [ ] **Step 6: Commit**

```bash
git add src/components/TopBar.jsx
git commit -m "feat: lay the header out as three zones with centred tabs"
```

---

## Task 16: Full verification

**Files:** none — this task only runs things.

- [ ] **Step 1: Whole suite**

Run: `npm run test:run`
Expected: PASS. Roughly 490 tests (453 baseline + ~37 new). Record the exact number.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: succeeds, no warnings about unresolved imports.

- [ ] **Step 4: E2E**

Run: `npm run test:e2e`
Expected: PASS, both tests.

- [ ] **Step 5: Walk the app in a real browser**

Confirm each reported defect is gone. Use a fresh tab if the 3D canvas goes white.

1. Build tab at 1440×900 → zoom the browser to 50% and 67% with Ctrl+`-`. **No gap opens between the use-case chips and the rating panel.**
2. The parts area is headed "Your parts", with an `N of 9 essentials chosen` counter and a red `N missing` figure.
3. Empty essential slots are dashed and red with a `Missing` tag; thermal paste is dashed and neutral with the optional note; the next pick carries the accent `Pick one` pill.
4. Content reaches noticeably closer to the window edges and the 3D column is about two thirds of the width.
5. The 3D starts smaller than before and the wheel zooms much further in and out.
6. The header tabs read as one segmented control and the meters as bordered chips; the header is one row.
7. Peripherals tab: each of the four categories has its own money-labelled chips with counts, and filtering monitors leaves mice alone.
8. Feedback page asks a sum and refuses a wrong answer.
9. Temporarily add `throw new Error('boom')` to the top of `App()`, reload, confirm the crash page renders with all three actions, then remove it.

- [ ] **Step 6: Confirm the tree is clean**

Run: `git status -sb`
Expected: no modified or untracked source files. Untracked files under `docs/superpowers/` are normal on this repo.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| 1 — zoom gap | 10 (fix), 11 (E2E guard) |
| 2 — parts list reads as selected parts | 9 |
| 3 — missing parts obvious, paste explained | 7 (helpers), 8 (three states) |
| 4 — width and preview size | 10 |
| 5 — 3D zoom and starting scale | 12 |
| 6 — top bar: tabs, meters, three zones | 13, 14, 15 |
| 7 — crash page | 1 (storage key), 2 |
| 8 — human check on feedback | 3 (logic), 4 (wiring) |
| 9 — peripheral price filters | 5 (logic), 6 (wiring) |
| Testing section | Every task's test steps, plus 16 |

**Names used consistently across tasks:** `BUILDER_STORAGE_KEY` (Tasks 1, 2) · `makeChallenge` / `checkAnswer` / `submittedTooFast` / `SUBMIT_FLOOR_MS` (Tasks 3, 4) · `snapToLadder` / `priceBands` / `inBand` (Tasks 5, 6) · `ESSENTIALS` / `isOptional` / `countEssentials` (Tasks 7, 8, 9) · `emphasiseMissing` (Tasks 8, 9) · `.area-left` (Tasks 10, 11) · `SelectedPartsPanel` (Tasks 9, 10).

**Known interactions between tasks:**

- Task 9 and Task 10 both edit `BuilderScreen.jsx`. Task 10's replacement block already contains Task 9's `SelectedPartsPanel` call — do them in order.
- Task 11's guard queries `.area-left > *:first-child` and `:last-child`, which only exist after Task 10.
- Task 4 will break pre-existing `FeedbackPage` tests that submit the form. Fixing them by answering the challenge is correct; weakening the check to accommodate them is not.
- Task 6 deletes `BANDS` and `bandOf`; the old `PeripheralsPanel` tests that click `Value` / `High-end` radios are replaced in the same task.
