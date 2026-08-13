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
import PartPage from './components/PartPage'
import useBuilderStore from './store/useBuilderStore'
import useCatalogStore, { loadCatalog } from './store/useCatalogStore'
import { usePageRoute } from './hooks/usePageRoute'
import { enterBuildTab } from './lib/enterBuildTab'
import { partById, partPageMeta } from './lib/partPages'
import { PAGE_META, canonicalFor } from './lib/pageMeta'

const PAGES = {
  help: HelpPage,
  parts: PartsBrowser,
  glossary: GlossaryPage,
  feedback: FeedbackPage,
  privacy: PrivacyPage,
  terms: TermsPage,
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
  const parts   = useCatalogStore((s) => s.parts)
  const { page, partId, navigate } = usePageRoute()

  useEffect(() => { loadCatalog() }, [])

  useEffect(() => {
    // A part page's copy comes from the part itself. 540 pages sharing the parts
    // browser's title and canonical would be the hash-routing problem again, only
    // 90 times over — and a shared canonical is a direct instruction not to index
    // any of them separately.
    const part = partId ? partById(parts, partId) : null
    const meta = part ? partPageMeta(part) : (PAGE_META[page] ?? captureRootMeta())
    document.title = meta.title
    setMeta('meta[name="description"]', 'content', meta.description)
    setMeta('meta[property="og:title"]', 'content', meta.title)
    setMeta('meta[property="og:description"]', 'content', meta.description)
    // A canonical still pointing at / would tell Google these pages are the
    // root, which is the exact instruction not to index them separately.
    const path = part ? `parts/${part.id}` : page
    setMeta('link[rel="canonical"]', 'href', canonicalFor(path))
  }, [page, partId, parts])

  if (partId) {
    return (
      <SiteChrome onBack={() => navigate('parts')}>
        <PartPage partId={partId} onNavigate={navigate} />
      </SiteChrome>
    )
  }

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
