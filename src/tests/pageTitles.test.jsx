import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import HelpPage from '../components/HelpPage'
import GlossaryPage from '../components/GlossaryPage'
import { PrivacyPage, TermsPage } from '../components/LegalPage'
import FeedbackPage from '../components/FeedbackPage'
import PartsBrowser from '../components/PartsBrowser'
import PartPage from '../components/PartPage'
import SavedBuilds from '../components/SavedBuilds'
import partsData from '../data/partsData.json'

// Configurator redesign (spec 2026-10-16): every page titles itself in the wide
// display face, so the content pages read as the same site as the builder.
const PAGES = {
  help: <HelpPage />,
  glossary: <GlossaryPage />,
  privacy: <PrivacyPage />,
  terms: <TermsPage />,
  feedback: <FeedbackPage />,
  parts: <PartsBrowser />,
  part: <PartPage partId={partsData.find((p) => p.category === 'gpu').id} onNavigate={() => {}} />,
  saved: <SavedBuilds />,
}

describe('page titles', () => {
  it.each(Object.keys(PAGES))('%s uses the wide face for its h1', (name) => {
    const { container } = render(PAGES[name])
    const h1 = container.querySelector('h1')
    expect(h1, `${name} has no h1`).not.toBeNull()
    expect(h1.className).toMatch(/\bfont-wide\b/)
  })
})
