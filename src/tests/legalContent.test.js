import { describe, it, expect } from 'vitest'
import * as legal from '../lib/legalContent'
import { PRIVACY, TERMS, OPERATOR, LAST_UPDATED } from '../lib/legalContent'

const allText = (doc) => [doc.intro, ...doc.sections.flatMap((s) => [s.heading, ...s.body])].join(' ')

describe('legal content', () => {
  it('states the retention period the database actually enforces', () => {
    // This number is the one in the `purge_feedback_personal_data` pg_cron job
    // (ip_hash at 30 days). If someone changes the job without changing the
    // page, the privacy notice becomes a false statement — which is a worse
    // position than having no notice at all.
    const text = allText(PRIVACY)
    expect(text).toMatch(/IP hash is erased automatically 30 days/)
  })

  // The form collects no email address. These assertions are the whole reason
  // the ICO fee question is answerable, so they guard the claim from both
  // directions: the page must say we do not ask, and must not carry the old
  // "erased after 90 days" promise that implied we do.
  it('does not claim to collect or retain an email address', () => {
    const text = allText(PRIVACY)
    expect(text).toMatch(/no email field/i)
    expect(text).not.toMatch(/email address is erased/i)
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
