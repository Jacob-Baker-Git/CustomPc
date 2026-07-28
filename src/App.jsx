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
import useBuilderStore from './store/useBuilderStore'
import { loadCatalog } from './store/useCatalogStore'
import { usePageRoute } from './hooks/usePageRoute'
import { enterBuildTab } from './lib/enterBuildTab'

const PAGES = { help: HelpPage, parts: PartsBrowser, glossary: GlossaryPage, feedback: FeedbackPage }

export default function App() {
  const flow    = useBuilderStore((s) => s.flow)
  const setFlow = useBuilderStore((s) => s.setFlow)
  const { page, navigate } = usePageRoute()

  useEffect(() => { loadCatalog() }, [])

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
