import { SUPABASE_URL, SUPABASE_KEY } from './supabaseCatalog'

const TYPES = ['bug', 'idea', 'praise', 'other']

// No email field, deliberately. Collecting one made this the only place on the
// site that took a piece of directly identifying personal data, in exchange for
// being able to reply to a handful of people. Not asking is a stronger privacy
// position than asking and then promising to delete it after 90 days.
//
// An email typed into `message` is not intercepted — we cannot reliably detect
// one, and silently rewriting what somebody wrote would be worse. It is their
// choice and the privacy page says so.
export function validateFeedback({ rating, type, message } = {}) {
  const errors = {}
  if (!(Number.isInteger(rating) && rating >= 1 && rating <= 5)) errors.rating = 'Pick a rating from 1 to 5.'
  if (!TYPES.includes(type)) errors.type = 'Choose a category.'
  const msg = (message ?? '').trim()
  if (msg.length < 1) errors.message = 'Please write a short message.'
  else if (msg.length > 2000) errors.message = 'Keep it under 2000 characters.'
  return { ok: Object.keys(errors).length === 0, errors }
}

export async function submitFeedback(input) {
  if (!validateFeedback(input).ok) throw new Error('Invalid feedback')
  // Never forward an email even if a caller passes one — the column is going
  // away and this is the only writer, so the payload is built explicitly.
  const body = { rating: input.rating, type: input.type, message: input.message.trim() }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Feedback failed: HTTP ${res.status}`)
}
