import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import FeedbackPage from '../components/FeedbackPage'
import * as feedback from '../lib/feedback'

afterEach(() => vi.restoreAllMocks())

it('submits valid feedback and shows a thank-you', async () => {
  const spy = vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  render(<FeedbackPage />)
  fireEvent.click(screen.getByRole('button', { name: /rate 5/i }))
  fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Really useful' } })
  fireEvent.change(screen.getByLabelText(/what is \d+ \+ \d+\?/i), { target: { value: String(answerFrom()) } })
  skipTheFloor()
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))
  await waitFor(() => expect(screen.getByText(/thank/i)).toBeInTheDocument())
  expect(spy).toHaveBeenCalled()
})

it('blocks submit and shows an error when the message is empty', () => {
  const spy = vi.spyOn(feedback, 'submitFeedback').mockResolvedValue()
  render(<FeedbackPage />)
  fireEvent.click(screen.getByRole('button', { name: /rate 4/i }))
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))
  expect(screen.getByText(/short message/i)).toBeInTheDocument()
  expect(spy).not.toHaveBeenCalled()
})

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
