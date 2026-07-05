import { useEffect } from 'react'
import BudgetEntry from './components/BudgetEntry'
import BuilderScreen from './screens/BuilderScreen'
import useBuilderStore from './store/useBuilderStore'
import { loadCatalog } from './store/useCatalogStore'

export default function App() {
  const budget    = useBuilderStore((s) => s.budget)
  const setBudget = useBuilderStore((s) => s.setBudget)

  useEffect(() => { loadCatalog() }, [])

  if (!budget) return <BudgetEntry onSubmit={setBudget} />
  return <BuilderScreen />
}
