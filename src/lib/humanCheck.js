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
