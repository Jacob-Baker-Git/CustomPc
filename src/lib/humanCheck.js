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
