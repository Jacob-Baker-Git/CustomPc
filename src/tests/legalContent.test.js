import { describe, it, expect } from 'vitest'
import { PRIVACY, TERMS, OPERATOR, AFFILIATE_DISCLOSURE, LAST_UPDATED } from '../lib/legalContent'

const allText = (doc) => [doc.intro, ...doc.sections.flatMap((s) => [s.heading, ...s.body])].join(' ')

describe('legal content', () => {
  it('states the retention periods the database actually enforces', () => {
    // These numbers are the ones in the `purge_feedback_personal_data` pg_cron
    // job (ip_hash at 30 days, email at 90). If someone changes the job without
    // changing the page, the privacy notice becomes a false statement — which is
    // a worse position than having no notice at all.
    const text = allText(PRIVACY)
    expect(text).toMatch(/IP hash is erased automatically 30 days/)
    expect(text).toMatch(/email address is erased automatically 90 days/)
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

  it('says commission never changes the price or the recommendations', () => {
    expect(AFFILIATE_DISCLOSURE).toMatch(/commission/i)
    expect(AFFILIATE_DISCLOSURE).toMatch(/never changes the price/i)
    expect(AFFILIATE_DISCLOSURE).toMatch(/never affects which parts/i)
  })

  it('carries the affiliate disclosure into the terms page too', () => {
    expect(allText(TERMS)).toContain(AFFILIATE_DISCLOSURE)
  })

  it('has a last-updated date', () => {
    expect(LAST_UPDATED).toMatch(/\d{4}/)
  })

  // These were one test until the operator was named. Kept apart now because a
  // single assertion covering both would keep failing on the missing email and
  // silently stop guarding the name — one blocker hiding behind another.
  it('names an identifiable controller', () => {
    expect(OPERATOR.name).not.toMatch(/^\[/)
  })

  // Deliberately failing until the contact address is filled in. A privacy
  // notice with no contact route does not do the job it exists to do: the
  // rights section promises a reply the site has no way to receive. When this
  // is filled in, flip it to a normal `it` and the pages can go live.
  it.fails('gives people a contact route to exercise their rights', () => {
    expect(OPERATOR.contactEmail).not.toMatch(/^\[/)
  })
})
