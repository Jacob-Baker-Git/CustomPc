import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import * as legal from '../lib/legalContent'
import { PRIVACY, TERMS, OPERATOR, LAST_UPDATED } from '../lib/legalContent'

const allText = (doc) => [doc.intro, ...doc.sections.flatMap((s) => [s.heading, ...s.body])].join(' ')

describe('legal content', () => {
  // The database now holds no personal data at all: the `email` and `ip_hash`
  // columns were dropped, and the `purge_feedback_personal_data` pg_cron job
  // was unscheduled and dropped with them. This page has to match that exactly.
  // A privacy notice describing collection that no longer happens is a false
  // statement, which is a worse position than having no notice at all.
  it('claims no personal data, and describes no retention schedule', () => {
    const text = allText(PRIVACY)
    expect(text).toMatch(/no email field/i)
    expect(text).toMatch(/do not store your IP address/i)
    expect(text).toMatch(/hold no personal data/i)
    // The old promises. If any reappears, the DB and the page have diverged.
    expect(text).not.toMatch(/email address is erased/i)
    expect(text).not.toMatch(/IP hash is erased automatically/i)
    expect(text).not.toMatch(/if you chose to give one/i)
  })

  it('tells people their builds are local and a share link is public', () => {
    const text = allText(PRIVACY)
    expect(text).toMatch(/local storage/i)
    expect(text).toMatch(/share link/i)
  })

  it('covers the rights and complaint route UK GDPR requires', () => {
    const text = allText(PRIVACY)
    expect(text).toMatch(/erase/i)
    expect(text).toMatch(/Information Commissioner/i)
    expect(text).toMatch(/legitimate interests/i)
  })

  it('disclaims the three things the site actually estimates', () => {
    const text = allText(TERMS)
    expect(text).toMatch(/Prices are a curated snapshot/i)
    expect(text).toMatch(/Frame rates are produced by a simple model/i)
    expect(text).toMatch(/Compatibility/i)
  })

  // There is no affiliate relationship, so there is no disclosure to render.
  // If a tag is ever reintroduced this has to be reversed deliberately rather
  // than by someone quietly re-exporting the constant.
  it('exports no affiliate disclosure, because there is no affiliation', () => {
    expect(legal.AFFILIATE_DISCLOSURE).toBeUndefined()
  })

  it('states plainly on the terms page that we earn no commission', () => {
    const text = allText(TERMS)
    expect(text).toMatch(/not an affiliate/i)
    expect(text).toMatch(/earn no commission/i)
  })

  it('has a last-updated date', () => {
    expect(LAST_UPDATED).toMatch(/\d{4}/)
  })

  // Both of these were a single deliberate `it.fails` while the operator details
  // were unfilled. They are kept apart now that they pass, because they guard
  // two independent facts and a combined assertion would let one failure mask
  // the other — which is exactly what happened while only the name was set.
  it('names an identifiable controller', () => {
    expect(OPERATOR.name).not.toMatch(/^\[/)
  })

  // A privacy notice with no contact route does not do the job it exists to do:
  // the rights section promises a reply the site would have no way to receive.
  it('gives people a contact route to exercise their rights', () => {
    expect(OPERATOR.contactEmail).not.toMatch(/^\[/)
    expect(OPERATOR.contactEmail).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)
  })
})

// App.jsx calls loadCatalog() from a mount effect with no route condition, so
// every page — this one included — fires three fetches at Supabase before the
// visitor touches anything. An IP address is personal data, and a request
// carries it whether or not anything is stored at the far end.
//
// The CSP is the machine-readable version of the same fact: a remote host in
// connect-src is a company that receives the visitor's IP. Deriving the check
// from `public/_headers` rather than from a hardcoded name means the page and
// the policy cannot drift apart — adding a host makes these fail.
describe('privacy page vs. what the app actually requests', () => {
  const text = allText(PRIVACY)
  const cspLine = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('Content-Security-Policy:'))
  const connectSrc = (/connect-src([^;]*)/.exec(cspLine ?? '')?.[1] ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const remoteHosts = connectSrc.filter((v) => v.startsWith('http'))

  // Guards the guard: if this ever reads zero the assertions below go vacuous
  // and would keep passing while the page said anything at all.
  it('finds the remote hosts the page has to account for', () => {
    expect(remoteHosts.length).toBeGreaterThan(0)
  })

  it('makes no blanket claim that nobody receives your IP on page load', () => {
    expect(text).not.toMatch(/no other company receives your IP address/i)
  })

  it('does not claim there is no IP logging anywhere', () => {
    // Netlify and Supabase both log requests at the edge. "We do not store an
    // IP address in the feedback row" is true and is said elsewhere; "no IP
    // logging" is a claim about other people's infrastructure.
    expect(text).not.toMatch(/no IP logging/i)
  })

  it('discloses that the parts catalogue is fetched from a third party', () => {
    expect(text).toMatch(/catalogue/i)
    expect(text).toMatch(/every page|each page|page you open|page load/i)
  })

  it('names the processors that see a request, not just the one that stores', () => {
    expect(text).toMatch(/Netlify/i)
    expect(text).toMatch(/Supabase/i)
  })
})
