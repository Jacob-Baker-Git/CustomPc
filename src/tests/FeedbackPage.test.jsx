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

// The hover/focus preview is the one substantial interactive piece here, and it
// is easy to get subtly wrong (e.g. leaking into the committed rating, or not
// reverting). Assert on the rendered svg classes rather than component state.
it('previews the rating on hover and focus, then reverts on leave/blur', () => {
  render(<FeedbackPage />)
  const star = (n) => screen.getByRole('button', { name: `Rate ${n}` })
  const isFilled = (n) => star(n).querySelector('svg').classList.contains('fill-accent')
  const isUnfilled = (n) => star(n).querySelector('svg').classList.contains('text-faint')
  const row = star(1).parentElement

  fireEvent.mouseEnter(star(3))
  expect([1, 2, 3].every(isFilled)).toBe(true)
  expect([4, 5].every(isUnfilled)).toBe(true)

  fireEvent.mouseLeave(row)
  expect([1, 2, 3, 4, 5].every(isUnfilled)).toBe(true) // no rating clicked, reverts to 0

  fireEvent.focus(star(4))
  expect([1, 2, 3, 4].every(isFilled)).toBe(true)
  expect(isUnfilled(5)).toBe(true)

  fireEvent.blur(star(4))
  expect([1, 2, 3, 4, 5].every(isUnfilled)).toBe(true)
})
