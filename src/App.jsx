import { useEffect } from 'react'
import BudgetEntry from './components/BudgetEntry'
import BuilderScreen from './screens/BuilderScreen'
import MainMenu from './components/MainMenu'
import UpgradeWizard from './components/UpgradeWizard'
import SiteChrome from './components/SiteChrome'
import HelpPage from './components/HelpPage'
import PartsBrowser from './components/PartsBrowser'
import GlossaryPage from './components/GlossaryPage'
import FeedbackPage from './components/FeedbackPage'
import useBuilderStore from './store/useBuilderStore'
import { loadCatalog } from './store/useCatalogStore'
import { usePageRoute } from './hooks/usePageRoute'

const PAGES = { help: HelpPage, parts: PartsBrowser, glossary: GlossaryPage, feedback: FeedbackPage }

export default function App() {
  const budget    = useBuilderStore((s) => s.budget)
  const setBudget = useBuilderStore((s) => s.setBudget)
  const flow      = useBuilderStore((s) => s.flow)
  const setFlow   = useBuilderStore((s) => s.setFlow)
  const { page, navigate } = usePageRoute()

  useEffect(() => { loadCatalog() }, [])

  if (page) {
    const Page = PAGES[page]
    return <SiteChrome onBack={() => navigate(null)}><Page /></SiteChrome>
  }
  if (budget > 0) return <BuilderScreen />
  if (flow === 'new')     return <BudgetEntry onSubmit={setBudget} onBack={() => setFlow('menu')} />
  if (flow === 'upgrade') return <UpgradeWizard onBack={() => setFlow('menu')} />
  return <MainMenu onNew={() => setFlow('new')} onUpgrade={() => setFlow('upgrade')} />
}
