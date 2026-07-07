import { SUPABASE_URL, SUPABASE_KEY } from './supabaseCatalog'

const TYPES = ['bug', 'idea', 'praise', 'other']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateFeedback({ rating, type, message, email } = {}) {
  const errors = {}
  if (!(Number.isInteger(rating) && rating >= 1 && rating <= 5)) errors.rating = 'Pick a rating from 1 to 5.'
  if (!TYPES.includes(type)) errors.type = 'Choose a category.'
  const msg = (message ?? '').trim()
  if (msg.length < 1) errors.message = 'Please write a short message.'
  else if (msg.length > 2000) errors.message = 'Keep it under 2000 characters.'
  if (email != null && email !== '') {
    if (!EMAIL_RE.test(email) || email.length > 200) errors.email = 'That email address looks off.'
  }
  return { ok: Object.keys(errors).length === 0, errors }
}

export async function submitFeedback(input) {
  if (!validateFeedback(input).ok) throw new Error('Invalid feedback')
  const email = input.email?.trim()
  const body = { rating: input.rating, type: input.type, message: input.message.trim(), email: email || null }
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
