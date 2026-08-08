import { useEffect } from 'react'
import SetupFlow from './components/SetupFlow'
import BuilderScreen from './screens/BuilderScreen'
import MainMenu from './components/MainMenu'
import SavedBuilds from './components/SavedBuilds'
import SiteChrome from './components/SiteChrome'
import HelpPage from './components/HelpPage'
import PartsBrowser from './components/PartsBrowser'
import GlossaryPage from './components/GlossaryPage'
import FeedbackPage from './components/FeedbackPage'
import { PrivacyPage, TermsPage } from './components/LegalPage'
import useBuilderStore from './store/useBuilderStore'
import { loadCatalog } from './store/useCatalogStore'
import { usePageRoute } from './hooks/usePageRoute'
import { enterBuildTab } from './lib/enterBuildTab'

const PAGES = {
  help: HelpPage,
  parts: PartsBrowser,
  glossary: GlossaryPage,
  feedback: FeedbackPage,
  privacy: PrivacyPage,
  terms: TermsPage,
}

// Giving the pages their own URLs achieves nothing if all six then serve the
// root's title, description and canonical — to a crawler that is six addresses
// for one document, which is the problem hash routes had. index.html holds the
// root's copy; these override it per page and are restored on the way out.
const SITE = 'https://custompcbuilder.netlify.app'
const PAGE_META = {
  help: {
    title: 'Help & FAQ — Custom PC Builder',
    description: 'How to plan a build, read the CustomPC score, check compatibility and share what you have chosen.',
  },
  parts: {
    title: 'PC Parts Browser — Prices & Specifications',
    description: 'Browse processors, graphics cards, memory, storage and cases with specifications and curated UK price estimates.',
  },
  glossary: {
    title: 'PC Hardware Glossary — Custom PC Builder',
    description: 'Plain-English definitions of the PC building terms — sockets, chipsets, TDP, form factors, VRAM and the rest.',
  },
  feedback: {
    title: 'Feedback — Custom PC Builder',
    description: 'Tell us what worked, what did not, and what is missing.',
  },
  privacy: {
    title: 'Privacy Policy — Custom PC Builder',
    description: 'What this site stores about you, which is nothing personal, and why.',
  },
  terms: {
    title: 'Terms of Use — Custom PC Builder',
    description: 'The terms covering price estimates, compatibility checks and performance figures on this site.',
  },
}

const setMeta = (selector, attr, value) => {
  const el = document.head.querySelector(selector)
  if (el) el.setAttribute(attr, value)
}

// Captured on first use, BEFORE anything has overridden it, so index.html stays
// the single source of truth for the root's copy rather than it being written
// out a second time here and drifting.
let rootMeta = null
const captureRootMeta = () => (rootMeta ??= {
  title: document.title,
  description: document.head.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
})

export default function App() {
  const flow    = useBuilderStore((s) => s.flow)
  const setFlow = useBuilderStore((s) => s.setFlow)
  const { page, navigate } = usePageRoute()

  useEffect(() => { loadCatalog() }, [])

  useEffect(() => {
    const meta = PAGE_META[page] ?? captureRootMeta()
    document.title = meta.title
    setMeta('meta[name="description"]', 'content', meta.description)
    setMeta('meta[property="og:title"]', 'content', meta.title)
    setMeta('meta[property="og:description"]', 'content', meta.description)
    // A canonical still pointing at / would tell Google these pages are the
    // root, which is the exact instruction not to index them separately.
    setMeta('link[rel="canonical"]', 'href', page ? `${SITE}/${page}` : `${SITE}/`)
  }, [page])

  if (page) {
    const Page = PAGES[page]
    return <SiteChrome onBack={() => navigate(null)}><Page /></SiteChrome>
  }

  if (flow === 'builder') return <BuilderScreen />
  if (flow === 'setup')   return <SetupFlow onBack={() => setFlow('hub')} />
  if (flow === 'saved') {
    return (
      <SiteChrome onBack={() => setFlow('hub')}>
        <SavedBuilds onLoaded={() => { enterBuildTab(); setFlow('builder') }} />
      </SiteChrome>
    )
  }
  return (
    <MainMenu
      onStart={() => setFlow('setup')}
      onResume={() => { enterBuildTab(); setFlow('builder') }}
      onSaved={() => setFlow('saved')}
    />
  )
}
